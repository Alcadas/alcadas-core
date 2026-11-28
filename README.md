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
- **Segregação de Funções (_SoD_):** Bloqueio estrito de autoaprovação e validação de conflito de papéis em delegações temporárias de competência (`RF04`, `RF12`).
- **Trilha de Auditoria Criptográfica:** Cadeia imutável de elos com _hashes_ SHA-256 encadeados, detectando qualquer tentativa de adulteração de dados em menos de 1 segundo (`RF07`, `RF08`).
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

2. **Suba o ambiente completo:**

   ```bash
   docker compose up -d --build
   ```

   > 💡 Na primeira execução, o Docker constrói as imagens otimizadas com dependências cacheadas. As inicializações subsequentes sobem em segundos com validação automática de saúde (_healthchecks_).

---

## 🌐 Portas e URLs de Acesso

| Serviço                  | URL / Porta                                            | Descrição                                     |
| :----------------------- | :----------------------------------------------------- | :-------------------------------------------- |
| **Frontend Web**         | [http://localhost:4200](http://localhost:4200)         | Interface do Solicitante, Aprovador e Auditor |
| **Backend API**          | [http://localhost:3000/api](http://localhost:3000/api) | Endpoints REST protegidos por RBAC e JWT      |
| **Firebase Emulator UI** | [http://localhost:4000](http://localhost:4000)         | Painel visual dos emuladores locais           |
| **Firestore Emulator**   | `localhost:8080`                                       | Banco NoSQL de documentos em tempo real       |
| **Auth Emulator**        | `localhost:9099`                                       | Emulador de identidade e tokens JWT           |

---

## 🔐 Acesso Imediato com Seed Automático (Zero Setup — Checkpoint 2)

O ecossistema conta com **carga de dados 100% automatizada** pelo serviço `seed` orquestrado no Docker Compose (`scripts/seed.ts`). Ao rodar `docker compose up`, o Firebase Auth Emulator e o Firestore Emulator são automaticamente populados com as duas empresas, usuários com suas respectivas claims RBAC, centros de custo, faixas de alçada e solicitações para teste de isolamento.

### Usuários Pré-Cadastrados para a Demonstração:

| Organização | Papel / Função | E-mail | Senha Padrão | Capacidade / Alçada |
| :--- | :--- | :--- | :--- | :--- |
| **Startop** | Administrador | `admin@startop.test` | `123456` | Gestão de Organização e Centros de Custo |
| **Startop** | Solicitante | `solicitante@startop.test` | `123456` | Criação e reenvio de solicitações |
| **Startop** | Gerente Aprovador (N2) | `gerente@startop.test` | `123456` | Aprovação/Rejeição/Ajuste até **R$ 5.000,00** |
| **Startop** | Auditor | `auditor@startop.test` | `123456` | Trilha de Auditoria SHA-256 e Motor de Riscos |
| **Empresa B** | Solicitante | `solicitante@empresab.test` | `123456` | Cenários de Isolamento Multi-Tenant |

### Passo a Passo da Demonstração (Sem Ajuste Manual):
1. Execute `docker compose up -d` (ou `npm run docker:up`).
2. Acesse [http://localhost:4200/login](http://localhost:4200/login).
3. Faça login diretamente com `solicitante@startop.test` e senha `123456` para submeter novos pedidos.
4. Faça logout e entre com `gerente@startop.test` para avaliar e aprovar solicitações pendentes.
5. Inspecione os emuladores visualmente na [Firebase Emulator UI](http://localhost:4000) (Auth e Firestore).

---

## 📜 Scripts Disponíveis

Os comandos abaixo podem ser executados via `npm run <script>` ou `npx nx <target> <project>`:

| Script                | Descrição                                                    |
| :-------------------- | :----------------------------------------------------------- |
| `npm run start:web`   | Inicia o servidor de desenvolvimento do Angular (`apps/web`) |
| `npm run start:api`   | Inicia o servidor da API NestJS em modo watch (`apps/api`)   |
| `npm run build`       | Compila todos os projetos da workspace                       |
| `npm run build:web`   | Compila o Frontend Angular para produção                     |
| `npm run build:api`   | Compila o Backend NestJS com webpack                         |
| `npm run test`        | Executa todos os testes unitários via Jest                   |
| `npm run test:web`    | Executa os testes unitários do Frontend Angular              |
| `npm run test:api`    | Executa os testes unitários da API NestJS                    |
| `npm run test:models` | Executa os testes da biblioteca de modelos compartilhados    |
| `npm run lint`        | Executa o ESLint em todos os apps e libs                     |
| `npm run lint:fix`    | Corrige problemas automáticos de linting                     |
| `npm run docker:up`   | Sobe todos os contêineres do Docker Compose em background    |
| `npm run docker:down` | Encerra e remove os contêineres do Docker Compose            |

---

## ☁️ Produção, Deploy, Monitoramento e Rollback (CP3)

A plataforma opera em nuvem sob a política de **Custo Zero (ADR-011)**, com frontend publicado no **Firebase Hosting (Plano Spark)** e API NestJS conteinerizada em **Docker multi-stage Alpine não-root** (`USER node`, UID 1000) no **Render (Plano Free)**.

### 🌐 Endereços Oficiais de Produção

| Componente | Endpoint | Finalidade |
| :--- | :--- | :--- |
| **Frontend Web (Firebase Hosting)** | [https://alcadas-producao-f40ec.web.app](https://alcadas-producao-f40ec.web.app) | Aplicação Angular SPA (canal `live`) |
| **Backend API (Render)** | [https://alcadas-core.onrender.com/api](https://alcadas-core.onrender.com/api) | API REST NestJS conectada ao Firestore real |
| **Liveness Probe** | `https://alcadas-core.onrender.com/api/healthz` | Verifica se o processo HTTP da API está vivo (usado pelo Render) |
| **Readiness Probe** | `https://alcadas-core.onrender.com/api/readyz` | Verifica API + conectividade com Cloud Firestore (usado pelo UptimeRobot) |

---

### 🚀 Como Funciona a Publicação em Produção

A branch `main` é protegida por **Branch Protection Rules** (proibido push direto; exige PR aprovado por outro desenvolvedor e CI verde com Gitleaks, lint, testes e build).

1. **Preview automático em Pull Requests ([`.github/workflows/preview.yml`](.github/workflows/preview.yml)):**
   - Ao abrir ou atualizar um PR para `develop` ou `main`, o GitHub Actions compila o frontend e publica um canal temporário no Firebase Hosting (`pr-<numero>`, com expiração automática de **7 dias**), comentando o link diretamente no PR.
2. **Deploy automático do Frontend em Produção ([`.github/workflows/deploy-prod.yml`](.github/workflows/deploy-prod.yml)):**
   - Ao realizar o merge na `main`, o GitHub Actions revalida testes/build e publica `dist/apps/web/browser` no canal **`live`** do Firebase Hosting.
   - **Deploy manual de emergência (Frontend e Regras do Firestore):**
     ```bash
     npx nx build web --configuration=production
     npx firebase-tools deploy --only firestore:rules,hosting
     ```
3. **Deploy automático do Backend no Render (Auto-Deploy nativo):**
   - O serviço `alcadas-core` no Render monitora a branch `main` e dispara o build e deploy automaticamente assim que os checks do GitHub Actions ficam verdes, utilizando o Dockerfile de produção **`docker/Dockerfile.api.prod`** (contexto `.`, raiz do monorepo Nx).
   - O Render injeta automaticamente `RENDER_GIT_COMMIT`, cujo SHA é registrado nos logs de inicialização para rastreabilidade.

#### Construção e Validação Local do Contêiner de Produção

```bash
# 1. Construir a imagem de produção da API
docker build -f docker/Dockerfile.api.prod -t alcadas-api:prod .

# 2. Validar que o contêiner roda como usuário não-root (USER node)
docker run --rm alcadas-api:prod whoami
# Saída esperada: node

docker run --rm alcadas-api:prod id
# Saída esperada: uid=1000(node) gid=1000(node)

# 3. Executar o contêiner localmente e validar o health check (HTTP 200)
docker run -d --name alcadas-api -p 3000:3000 -e NODE_ENV=production alcadas-api:prod
curl -i http://localhost:3000/api/healthz
# Resposta esperada: HTTP/1.1 200 OK {"status":"ok"}

# 4. Limpar o contêiner de teste
docker stop alcadas-api && docker rm alcadas-api
```

---

### 🔐 Onde Ficam as Variáveis de Ambiente e Segredos

Nenhum segredo ou chave privada é versionado no Git (bloqueado pelo **Gitleaks** no CI). Cada configuração reside no cofre do serviço responsável:

| Onde Configurar | Variável / Segredo | Obrigatória | Finalidade |
| :--- | :--- | :---: | :--- |
| **Render → Environment** | `NODE_ENV=production` | Sim | Ativa modo produção e exige Firestore real (sem fallback em memória) |
| **Render → Environment** | `PORT=3000` | Sim | Porta HTTP da API NestJS |
| **Render → Environment** | `WEB_URL` | Sim | Origem oficial liberada no CORS (`https://alcadas-producao-f40ec.web.app`) |
| **Render → Environment** | `FIREBASE_HOSTING_SITE` | Sim | Prefixo do site para liberar CORS de canais de preview (`alcadas-producao-f40ec`) |
| **Render → Environment** | `FIREBASE_PROJECT_ID` | Sim | ID do projeto Firebase (`alcadas-producao-f40ec`) |
| **Render → Environment** | `FIREBASE_SERVICE_ACCOUNT_JSON` | Sim | Credencial JSON (ou base64) de menor privilégio do Admin SDK (`roles/datastore.user`, `roles/firebaseauth.admin`) |
| **Render → Environment** | `FIREBASE_API_KEY` | Opcional | Chave Web pública para disparo do e-mail de definição de senha aos colaboradores |
| **Render → Environment** | `READYZ_CACHE_TTL_MS` | Opcional | Validade do cache do `/api/readyz` saudável em milissegundos (padrão: `60000`) |
| **GitHub → Settings → Secrets → Actions** | `FIREBASE_SERVICE_ACCOUNT` | Sim | Service Account com permissão de Hosting para os workflows `preview.yml` e `deploy-prod.yml` |
| **Firebase Hosting (Runtime)** | `/__/firebase/init.json` | Automático | Fornece a `apiKey` do Firebase Auth dinamicamente ao frontend em produção |

> Para detalhes de segurança, CORS e provisionamento da Service Account, consulte [`docs/cloud/api-producao-cp3.md`](docs/cloud/api-producao-cp3.md) e [`docs/cloud/credenciais-servico-gitleaks.md`](docs/cloud/credenciais-servico-gitleaks.md).

---

### 📡 Monitoramento Externo de Disponibilidade (UptimeRobot)

A disponibilidade da API e do Firestore em produção é monitorada externamente pelo **UptimeRobot** (plano gratuito):

- **Endpoint monitorado:** `https://alcadas-core.onrender.com/api/readyz` (retorna `HTTP 200 {"status":"ok","firestore":"ok"}` quando saudável e `HTTP 503` em caso de falha no banco).
- **Intervalo de checagem:** **30 minutos** (com timeout de **60 segundos** para absorver *cold starts* do plano Free do Render sem falsos positivos).
- **Alertas:** Notificação automática por e-mail para a equipe (*Alert Contacts*) em caso de indisponibilidade (`DOWN`) e recuperação (`UP`).
- **Governança FinOps (ADR-011):** Como o Render Free hiberna após 15 minutos de ociosidade, o intervalo de 30 minutos permite *spin-down* entre checagens, consumindo aproximadamente **~384 horas/mês** — bem abaixo da franquia gratuita de **750 horas mensais** do Render (com folga segura caso exista outro serviço na conta) — e apenas **48 leituras/dia** no Cloud Firestore (< 0,1% da cota de 50.000 leituras/dia do plano Spark).

> Consulte o passo a passo completo de configuração, cálculo FinOps e teste de alerta em [`docs/cloud/monitoramento-uptime-rollback.md`](docs/cloud/monitoramento-uptime-rollback.md).

---

### ⏪ Procedimento de Rollback (Voltar a uma Versão Anterior)

Em caso de regressão ou incidente em produção, execute o rollback na camada afetada e depois sincronize o Git para evitar que o próximo deploy reintroduza o problema.

#### 1. Rollback do Frontend — Firebase Hosting (Histórico de Versões)

**Via Console Web (Recomendado — menos de 1 minuto):**
1. Acesse o [Firebase Console](https://console.firebase.google.com/) e selecione o projeto **`alcadas-producao-f40ec`**.
2. No menu lateral esquerdo, vá em **Criação (Build) → Hosting**.
3. Na seção **Histórico de lançamentos (Release history)**, identifique a versão estável imediatamente anterior à publicação com erro.
4. Passe o mouse sobre a linha da versão estável, clique no menu **`⋮`** à direita e selecione **Reverter (Rollback)**.
5. Confirme a reversão. A versão anterior voltará a ser servida imediatamente em `https://alcadas-producao-f40ec.web.app`.

**Validação pós-rollback:** Acesse `https://alcadas-producao-f40ec.web.app` em janela anônima (ou com *hard reload* `Ctrl+Shift+R`) e verifique o funcionamento da tela afetada.

#### 2. Rollback do Backend — Render (Rollback de Deploy)

**Via Painel do Render (Imediato — 1 a 2 minutos):**
1. Acesse o [Render Dashboard](https://dashboard.render.com/) e abra o Web Service **`alcadas-core`**.
2. No menu lateral do serviço, clique em **Events** (ou **Deploys**).
3. Localize o último deploy estável (com status verde **Deploy live / Succeeded**) anterior ao commit defeituoso.
4. Clique no botão **Rollback to this deploy** (na linha do deploy escolhido ou dentro dos detalhes dele) e confirme.
5. Aguarde o serviço assumir o status **Live** e valide a saúde da API:
   ```bash
   curl -i https://alcadas-core.onrender.com/api/healthz
   curl -i https://alcadas-core.onrender.com/api/readyz
   # Esperado: HTTP/2 200 com {"status":"ok","firestore":"ok"}
   ```

#### 3. Sincronização Obrigatória no Git (Evitar Regressão no Próximo Deploy)

Após estabilizar a produção via painel, reverta o commit problemático no repositório para que o próximo merge na `main` não sobrescreva o rollback:

```bash
git checkout main
git pull origin main
git checkout -b fix/rollback-<descricao-curta>
git revert <SHA-DO-COMMIT-COM-ERRO>
git push origin fix/rollback-<descricao-curta>
# Abra um Pull Request para a branch main e aguarde revisão + CI verde
```

---

## 🤝 Como Contribuir

Antes de submeter código ou criar uma branch, leia atentamente nosso [**Guia de Contribuição (CONTRIBUTING.md)**](CONTRIBUTING.md) e o [**Código de Conduta (CODE_OF_CONDUCT.md)**](CODE_OF_CONDUCT.md).

### Resumo das Regras de Contribuição

1. **Nenhum commit direto na `main`:** Crie uma branch com o padrão `feat/#<issue>-nome`, `fix/#<issue>-descricao`, `docs/#<issue>-descricao` ou `chore/#<issue>-descricao`.
2. **Conventional Commits:** Escreva mensagens semânticas (ex.: `feat(api): adiciona rota de criacao de solicitacao`).
3. **Qualidade Garantida:** Certifique-se de que `npm run lint`, `npm run test` e `npm run build` passam com sucesso antes de abrir o PR.
4. **Pull Request:** Preencha o template de PR detalhando as alterações e referenciando a issue relacionada.

---

## 📚 Documentação Técnica Completa

Para aprofundamento na especificação do produto e operação em nuvem, consulte os seguintes artefatos:

- [**Arquitetura do Sistema**](docs/ARCHITECTURE.md): Diagramas de sequência, máquina de estados e trilha criptográfica.
- [**API em Produção — Segurança, Persistência e Operação (CP3)**](docs/cloud/api-producao-cp3.md): CORS, logs estruturados com `X-Request-Id`, Firestore real e seed de produção.
- [**Firebase Spark, Hosting SPA & Security Rules**](docs/cloud/firebase-spark-hosting.md): Rewrites de SPA, regras Deny-All e cotas do plano Spark.
- [**Credencial de Serviço (Menor Privilégio) & Gitleaks**](docs/cloud/credenciais-servico-gitleaks.md): Princípio do menor privilégio (PoLP) e prevenção de vazamento de segredos.
- [**Pipeline CI/CD com Preview em PRs e Proteção da Main**](docs/cloud/pipeline-cicd-preview-producao.md): Workflows de preview, deploy contínuo e Branch Protection Rules.
- [**Monitoramento com UptimeRobot & Runbook de Rollback**](docs/cloud/monitoramento-uptime-rollback.md): Configuração do monitor `/api/readyz`, análise FinOps (750h/mês) e runbook de reversão.
- [**Repositório de Documentação (`alcadas-docs`)**](https://github.com/Alcadas/alcadas-docs): Requisitos funcionais, regras de negócio e histórias de usuário mantidos no MkDocs.

---

## 👥 Integrantes & Equipe do Projeto

| Integrante                    | Papel Principal |
| :---------------------------- | :-------------- |
| **Matheus Ribeiro Szervinsk** | Project Owner   |
| **Henrique Schneider**        | Tech Lead       |
| **Pedro Henrique Gomes**      | DevOps          |
| **Luis**                      | Backend         |
| **Ana Clara**                 | Frontend        |
| **Leticia**                   | QA              |

---

**Alçadas** — _Laboratório Makers — Universidade de Brasília (UnB)_
