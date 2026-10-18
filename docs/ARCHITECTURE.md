# Arquitetura do Sistema — Alçadas

A arquitetura do sistema **Alçadas** (Sistema de Workflow de Alçadas de Aprovação e Rastreabilidade Operacional) foi desenhada sob o paradigma **Cloud-Native**, priorizando alta disponibilidade, sincronização em tempo real e o rigor necessário para suportar regras estritas de governança financeira, segregação de funções (*SoD*) e auditoria imutável.

Para a documentação viva e completa de requisitos, visão de produto e histórias de usuário, consulte o repositório [`alcadas-docs`](../../alcadas-docs).

---

## 1. Visão Geral e Stack Tecnológica

O sistema adota **TypeScript de ponta a ponta** estruturado em um **monorepo gerenciado pelo Nx**, eliminando falhas de contrato entre *frontend* e *backend* e acelerando o ciclo de desenvolvimento.

```mermaid
flowchart LR
    subgraph Cliente["Camada de Apresentação (Frontend)"]
        UI["Angular (TypeScript)\nReactive Forms & Painéis"]
    end

    subgraph Seguranca["Identidade & Acesso"]
        Auth["Firebase Auth\n(Tokens JWT / RBAC)"]
    end

    subgraph Servidor["Camada de Aplicação (Backend)"]
        API["NestJS (TypeScript)\nGuards RBAC/SoD"]
        SM["Máquina de Estados\n(Transações Atômicas)"]
        RE["Motor de Riscos\n(Anti-Fracionamento / Duplicidade)"]
        HC["Cadeia Criptográfica\n(Hashes SHA-256)"]
    end

    subgraph Dados["Persistência & Tempo Real"]
        DB[("Google Cloud Firestore\n(NoSQL / Real-time Streams)")]
    end

    UI -->|"1. Login / Credenciais"| Auth
    Auth -->|"2. JWT Token"| UI
    UI -->|"3. Comandos REST + JWT"| API
    API -->|"Valida Token e Papel"| Auth
    API --> SM
    API --> RE
    SM --> HC
    HC -->|"Grava Transação + Elo SHA-256"| DB
    RE -->|"Consulta Janela Móvel (7d / 30d)"| DB
    DB -.->|"4. Atualização Instantânea (< 1,5s)"| UI
```

### Componentes da Arquitetura

| Camada | Tecnologia | Responsabilidades Principais |
| :--- | :--- | :--- |
| **Frontend (`apps/web`)** | **Angular** (TypeScript) | Interface reativa, formulários dinâmicos (*Reactive Forms*), validação em tela, tratamento explícito de estados (*loading*, *empty*, *error*) e consumo de *streams* em tempo real sem recarregar a página (`RNF01`, `RNF08`). |
| **Backend (`apps/api`)** | **NestJS** (TypeScript) | Arquitetura em camadas que centraliza e blinda operações críticas: máquina de estados concorrente, cálculo matemático anti-fracionamento, detecção de duplicidade e geração de selos criptográficos SHA-256 (`RF03`–`RF12`, `RNF02`). |
| **Modelos Comuns (`libs/shared/models`)** | **TypeScript** | Contratos de dados compartilhados, interfaces de domínio, DTOs e tipos de entidades (Solicitações, Centros de Custo, Alçadas, Elos de Auditoria). |
| **Persistência e Tempo Real** | **Google Cloud Firestore** | Banco NoSQL orientado a documentos em nuvem, responsável pela persistência transacional, isolamento lógico entre *tenants* (`RNF07`) e emissão nativa de eventos em tempo real para as interfaces ativas em menos de 1,5 s (`RNF01`). |
| **Autenticação e Identidade** | **Firebase Auth** | Validação segura de credenciais e emissão de tokens JWT. Integrado aos *Guards* do NestJS e do Angular, garante o Controle de Acesso Baseado em Papéis (**RBAC**) e a **Segregação de Funções (*SoD*)** (`RNF03`). |
| **Infraestrutura e Ambientes** | **Docker & Docker Compose** | Conteinerização imutável da aplicação e orquestração local com emuladores do Firebase (Auth e Firestore) via `docker compose up` (`RNF05`, `RNF10`). |

---

## 2. Máquina de Estados e Controle de Concorrência

O núcleo operacional do **Alçadas** é uma máquina de estados que controla o ciclo de vida de cada solicitação financeira (`RF03`, `RF10`, `RF11`).

```mermaid
stateDiagram-v2
    [*] --> PENDENTE : Submissão válida (US-02 / RF02)
    PENDENTE --> APROVADA : Aprovação dentro da alçada (US-03 / RF03)
    PENDENTE --> REJEITADA : Rejeição com motivo >= 10 chars (US-03 / RF03)
    PENDENTE --> EM_AJUSTE : Solicitação de ajuste >= 10 chars (US-03 / RF03)
    EM_AJUSTE --> PENDENTE : Edição pelo autor e reenvio (US-11 / RF10)
    APROVADA --> [*]
    REJEITADA --> [*]
```

### Decisões Concorrentes e Transações Atômicas (`RF11` / `RN11`)

Para impedir que dois aprovadores (ou um diretor titular e seu substituto delegado) registrem decisões simultâneas conflitantes sobre o mesmo pedido:

- Toda mudança de estado ocorre via **transação atômica** verificando a **versão atual** do documento;
- Caso duas requisições concorrentes cheguem para a mesma versão, exatamente **uma retorna sucesso** e a **segunda é recusada com `HTTP 409 Conflict`** (`US-05`);
- Solicitações em estados terminais (`APROVADA` ou `REJEITADA`) rejeitam qualquer nova tentativa de decisão com `HTTP 409` (`CA-03.4`).

---

## 3. Trilha de Auditoria Criptográfica (SHA-256)

Para garantir **imutabilidade e integridade criptográfica** (`RF07`, `RF08`, `RNF02`), cada evento ou transição de estado gera automaticamente um elo imutável encadeado ao evento anterior:

$$H_n = \text{SHA-256}(H_{n-1} \parallel \text{timestamp}_{\text{UTC}} \parallel \text{authorId} \parallel \text{payload})$$

```mermaid
flowchart LR
    G["Elo Gênese (H0)\nHash fixo documentado"] --> E1["Elo 1 (H1)\nCriação (PENDENTE)\nSHA-256(H0 + TS + Autor + Payload)"]
    E1 --> E2["Elo 2 (H2)\nSolicitação de Ajuste (EM_AJUSTE)\nSHA-256(H1 + TS + Autor + Payload)"]
    E2 --> E3["Elo 3 (H3)\nReenvio (PENDENTE)\nSHA-256(H2 + TS + Autor + Payload)"]
    E3 --> E4["Elo 4 (H4)\nAprovação (APROVADA)\nSHA-256(H3 + TS + Autor + Payload)"]
```

- **Proteção contra Adulteração (`RN08` / `US-08`):** Qualquer alteração direta de 1 byte no banco de dados, remoção ou inserção indevida de elos invalida o recálculo determinístico da cadeia e destaca o registro como `"Inconsistente / Adulterado"` em menos de **1 segundo** (para cadeias de até 1.000 elos).
- **Bloqueio de Mutação via API (`CA-07.3`):** Nenhuma rota permite edição ou exclusão de elos da trilha, retornando `HTTP 403` ou `HTTP 405` mesmo para o perfil Administrador.
- **Exportação Auditável (`RF09` / `US-13`):** Exportação em **CSV** ou **JSON** contendo 100% dos elos, *hashes* atuais, *hashes* anteriores e carimbo UTC ISO 8601 da extração para verificação externa independente.

---

## 4. Motor de Riscos, RBAC e Segregação de Funções (SoD)

### 4.1. Prevenção de Fracionamento e Duplicidade
- **Anti-Fracionamento (`RF05` / `RN05` / `US-06`):** Ao submeter uma solicitação, o backend soma os pedidos do mesmo **centro de custo e categoria** dentro de uma **janela móvel de 30 dias**. Se a soma ultrapassar o teto da alçada inferior (ex.: soma de R$ 5.000,01 para teto de R$ 5.000,00), o pedido é bloqueado para a alçada inferior e escalonado automaticamente ao nível superior.
- **Detecção de Duplicidade (`RF06` / `RN06` / `US-12`):** Lançamentos com correspondência exata de **valor, centro de custo e fornecedor** em intervalo **inferior a 7 dias** recebem alerta visual `"Suspeita de duplicidade"` no painel do aprovador em até 1,5 s.

### 4.2. Segregação de Funções (*SoD*) e Delegação Temporária
- **Bloqueio de Autoaprovação (`RN03` / `RN12` / `US-04`):** O solicitante jamais pode aprovar o próprio pedido (`HTTP 403`). Mesmo que um usuário receba uma delegação temporária ativa de um diretor, o sistema bloqueia (`HTTP 403`) qualquer tentativa de aprovar solicitações criadas por ele mesmo e registra o bloqueio na trilha com motivo `SOD`.
- **Vigência Automática de Delegação (`RF04` / `RN04` / `US-10`):** Toda delegação exige data/hora de início e término, expirando instantaneamente ao fim da vigência e gerando elos de criação e expiração na trilha de auditoria.
- **Isolamento Multi-tenant (`RNF07` / `US-15`):** Isolamento lógico estrito entre organizações/clínicas parceiras, retornando `HTTP 403` ou `404` em qualquer tentativa de acesso cruzado.

---

## 5. Ambientes e Emuladores Locais

O desenvolvimento local executa 100% com **Docker Compose** e emuladores do Firebase (Auth e Firestore), permitindo testar toda a lógica de negócio, autenticação e regras de segurança sem requisições à nuvem e com custo zero:

- **Firebase Emulator UI:** `http://localhost:4000`
- **Firestore Emulator:** `localhost:8080`
- **Firebase Auth Emulator:** `localhost:9099`
- **NestJS API:** `http://localhost:3000`
- **Angular Web:** `http://localhost:4200`
