# Alçadas — Repositório Core

> **Sistema de Workflow de Alçadas de Aprovação e Rastreabilidade Operacional**  
> Projeto desenvolvido no âmbito do **Laboratório Makers — Universidade de Brasília (UnB)** em parceria com a **Startop LTDA**.

[![CI Alçadas](https://github.com/Alcadas/alcadas-core/actions/workflows/ci.yml/badge.svg)](https://github.com/Alcadas/alcadas-core/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Nx](https://img.shields.io/badge/monorepo-Nx%2023-blueviolet.svg)](https://nx.dev)
[![Node](https://img.shields.io/badge/node-%3E%3D24-brightgreen.svg)](https://nodejs.org)
[![Angular](https://img.shields.io/badge/Angular-22-dd0031.svg)](https://angular.dev)
[![NestJS](https://img.shields.io/badge/NestJS-11-e0234e.svg)](https://nestjs.com)

---

## 🎯 Sobre o Projeto

O **Alçadas** é uma plataforma corporativa desenvolvida para estruturar, automatizar e blindar a governança de solicitações financeiras (compras, pagamentos e reembolsos). O sistema transforma aprovações informais e regras dispersas em dados auditáveis e rastreáveis, fornecendo:

- **Alçadas e Tetos Configuráveis:** Validação automática de limites de valor por cargo e centros de custo com escalonamento hierárquico (`RF01`, `RF02`).
- **Prevenção de Fraudes e Riscos:** Motor nativo de detecção de fracionamento de compras em janelas móveis de 30 dias e duplicidade de lançamentos em 7 dias (`RF05`, `RF06`).
- **Segregação de Funções (*SoD*):** Bloqueio estrito de autoaprovação e validação de conflito de papéis em delegações temporárias de competência (`RF04`, `RF12`).
- **Trilha de Auditoria Criptográfica:** Cadeia imutável de elos com *hashes* SHA-256 encadeados, detectando qualquer tentativa de adulteração de dados em menos de 1 segundo (`RF07`, `RF08`).
- **Sincronização em Tempo Real:** Atualizações instantâneas de status e pendências nos painéis operacionais sem recarregar a página (`RNF01`).

---

## 🏗️ Arquitetura e Monorepo

O repositório é configurado como um monorepo gerenciado pelo [Nx](https://nx.dev), utilizando TypeScript em todas as camadas para garantir consistência de contratos e produtividade:

```text
alcadas-core/
├── apps/
│   ├── api/             # Backend em NestJS (Regras de negócio, máquina de estados, auditoria)
│   ├── api-e2e/         # Testes de integração e E2E da API
│   ├── web/             # Frontend em Angular (Reactive Forms, painéis em tempo real)
│   └── web-e2e/         # Testes ponta a ponta com Playwright
├── libs/
│   └── shared/
│       └── models/      # Interfaces, DTOs e entidades compartilhadas (contratos)
├── docs/
│   └── ARCHITECTURE.md  # Detalhamento arquitetural técnico e diagramas
├── .github/
│   ├── workflows/       # Pipelines de Integração Contínua (CI) do GitHub Actions
│   └── ISSUE_TEMPLATE/  # Templates padronizados para Issues e Pull Requests
├── docker-compose.yml   # Orquestração local de API, Web e Emuladores Firebase
├── firebase.json        # Configurações das portas dos emuladores locais
└── package.json         # Dependências do monorepo e scripts unificados
```

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) `>= 24.x`
- [npm](https://www.npmjs.com/) `>= 11.x`
- [Docker](https://www.docker.com/) e Docker Compose (recomendado para emuladores)

---

### Opção 1: Execução com Docker Compose (Recomendada)

Com apenas um comando, todos os serviços (Firebase Emulators, NestJS API e Angular Web) são inicializados:

1. **Clone o repositório:**
   ```bash
   git clone https://github.com/Alcadas/alcadas-core.git
   cd alcadas-core
   ```

2. **Copie as variáveis de ambiente:**
   ```bash
   cp .env.example .env
   ```

3. **Suba o ambiente completo:**
   ```bash
   npm run docker:up
   ```

4. **Acompanhe os logs:**
   ```bash
   npm run docker:logs
   ```

---

### Opção 2: Execução Híbrida / Local

Caso queira rodar o frontend e backend diretamente na máquina física com recarregamento rápido:

1. **Instale as dependências:**
   ```bash
   npm ci
   ```

2. **Inicie os emuladores locais do Firebase:**
   ```bash
   # Utilizando docker apenas para os emuladores:
   docker compose up firebase -d
   ```

3. **Inicie a API NestJS:**
   ```bash
   npm run start:api
   ```

4. **Em outro terminal, inicie o Frontend Angular:**
   ```bash
   npm run start:web
   ```

---

## 🌐 Portas e URLs de Acesso

| Serviço | URL / Porta | Descrição |
| :--- | :--- | :--- |
| **Frontend Web** | [http://localhost:4200](http://localhost:4200) | Interface do Solicitante, Aprovador e Auditor |
| **Backend API** | [http://localhost:3000/api](http://localhost:3000/api) | Endpoints REST protegidos por RBAC e JWT |
| **Firebase Emulator UI** | [http://localhost:4000](http://localhost:4000) | Painel visual dos emuladores locais |
| **Firestore Emulator** | `localhost:8080` | Banco NoSQL de documentos em tempo real |
| **Auth Emulator** | `localhost:9099` | Emulador de identidade e tokens JWT |

---

## 📜 Scripts Disponíveis

Os comandos abaixo podem ser executados via `npm run <script>` ou `npx nx <target> <project>`:

| Script | Descrição |
| :--- | :--- |
| `npm run start:web` | Inicia o servidor de desenvolvimento do Angular (`apps/web`) |
| `npm run start:api` | Inicia o servidor da API NestJS em modo watch (`apps/api`) |
| `npm run build` | Compila todos os projetos da workspace |
| `npm run build:web` | Compila o Frontend Angular para produção |
| `npm run build:api` | Compila o Backend NestJS com webpack |
| `npm run test` | Executa todos os testes unitários via Jest |
| `npm run test:web` | Executa os testes unitários do Frontend Angular |
| `npm run test:api` | Executa os testes unitários da API NestJS |
| `npm run test:models`| Executa os testes da biblioteca de modelos compartilhados |
| `npm run lint` | Executa o ESLint em todos os apps e libs |
| `npm run lint:fix` | Corrige problemas automáticos de linting |
| `npm run docker:up` | Sobe todos os contêineres do Docker Compose em background |
| `npm run docker:down`| Encerra e remove os contêineres do Docker Compose |

---

## 🤝 Como Contribuir

Antes de submeter código ou criar uma branch, leia atentamente nosso [**Guia de Contribuição (CONTRIBUTING.md)**](CONTRIBUTING.md) e o [**Código de Conduta (CODE_OF_CONDUCT.md)**](CODE_OF_CONDUCT.md).

### Resumo das Regras de Contribuição:
1. **Nenhum commit direto na `main`:** Crie uma branch com o padrão `feat/#<issue>-nome`, `fix/#<issue>-descricao`, `docs/#<issue>-descricao` ou `chore/#<issue>-descricao`.
2. **Conventional Commits:** Escreva mensagens semânticas (ex.: `feat(api): adiciona rota de criacao de solicitacao`).
3. **Qualidade Garantida:** Certifique-se de que `npm run lint`, `npm run test` e `npm run build` passam com sucesso antes de abrir o PR.
4. **Pull Request:** Preencha o template de PR detalhando as alterações e referenciando a issue relacionada.

---

## 📚 Documentação Técnica Completa

Para aprofundamento na especificação do produto, consulte os seguintes artefatos:
- [**Arquitetura do Sistema**](docs/ARCHITECTURE.md): Diagramas de sequência, máquina de estados e trilha criptográfica.
- [**Repositório de Documentação (`alcadas-docs`)**](../alcadas-docs): Requisitos funcionais, regras de negócio e histórias de usuário mantidos no MkDocs.

---

## 👥 Integrantes & Equipe do Projeto

| Integrante | Papel Principal |
| :--- | :--- |
| **Matheus Ribeiro Szervinsk** | Project Owner |
| **Henrique Schneider** | Tech Lead |
| **Pedro Henrique Gomes** | DevOps |
| **Luis** | Backend |
| **Ana Clara** | Frontend |
| **Leticia** | QA |

---

**Alçadas** — *Laboratório Makers — Universidade de Brasília (UnB)*
