# Guia de Contribuição — Alçadas 🚀

Obrigado por contribuir com o projeto **Alçadas** (Sistema de Workflow de Alçadas de Aprovação e Rastreabilidade Operacional), desenvolvido no âmbito do **Laboratório Makers — Universidade de Brasília (UnB)** em parceria com a **Startop LTDA**.

Para manter o repositório organizado, seguro e com qualidade profissional de código, todas as contribuições devem seguir as diretrizes descritas neste documento.

---

## 🌿 1. Padrão de Branches

Nunca faça commits diretos na branch `main`. Crie branches a partir da `main` (ou `develop`, caso esteja ativa no ciclo) seguindo o padrão semântico com o número da issue:

- `feat/#<issue>-nome-da-feature` — Para desenvolvimento de novas funcionalidades (ex.: `feat/#4-maquina-de-estados`, `feat/#6-anti-fracionamento`).
- `fix/#<issue>-descricao-do-bug` — Para correção de problemas e defeitos (ex.: `fix/#11-concorrencia-409`).
- `docs/#<issue>-alteracao-doc` — Para atualizações em documentação técnica ou manuais (ex.: `docs/#1-arquitetura-e-requisitos`).
- `chore/#<issue>-task-tecnica` — Para tarefas de infraestrutura, atualização de dependências, Nx ou Docker (ex.: `chore/#3-checkpoint-devops`).
- `test/#<issue>-descricao-teste` — Para criação e aprimoramento de suítes de testes unitários ou E2E (ex.: `test/#8-testes-integridade-sha256`).

---

## 📝 2. Padrão de Commits (Conventional Commits)

Adotamos a convenção do [Conventional Commits](https://www.conventionalcommits.org/pt-br/v1.0.0/). As mensagens de commit devem ser claras, em português ou inglês padronizado, no modo imperativo:

```text
<tipo>(<escopo opcional>): <descrição sucinta da alteração>
```

### Tipos Permitidos:
- **`feat`**: Implementação de nova funcionalidade.
  - *Exemplo:* `feat(api): implementa validação de janela móvel de 30 dias para anti-fracionamento`
- **`fix`**: Correção de bug.
  - *Exemplo:* `fix(api): retorna HTTP 409 Conflict em tentativas de decisão concorrente`
- **`docs`**: Alteração ou inclusão de documentação.
  - *Exemplo:* `docs: atualiza instruções de setup no README e CONTRIBUTING`
- **`style`**: Ajustes de formatação ou linter que não alteram a lógica do código.
  - *Exemplo:* `style: alinha indentação de regras do eslint`
- **`refactor`**: Refatoração de código que não corrige bug nem adiciona funcionalidade.
  - *Exemplo:* `refactor(web): reorganiza componentes do painel de aprovações em tempo real`
- **`test`**: Adição ou ajuste de testes automatizados.
  - *Exemplo:* `test(models): adiciona casos de teste para cálculo de elo SHA-256`
- **`chore`**: Atualizações de tarefas de build, gerenciador de pacotes, configs de ambiente.
  - *Exemplo:* `chore: adiciona scripts de inicialização rápida no package.json`
- **`ci`**: Alterações nos arquivos de configuração do GitHub Actions ou pipelines.
  - *Exemplo:* `ci: inclui etapa de testes automatizados no workflow de validação`

---

## 🛠️ 3. Fluxo de Trabalho com Nx Monorepo

O repositório é gerenciado pelo **Nx**. Antes de abrir um Pull Request, certifique-se de executar e validar os comandos abaixo localmente:

### Comandos do Dia a Dia:

```bash
# Instalar dependências exatas
npm ci

# Rodar a API NestJS localmente
npm run start:api

# Rodar o Frontend Angular localmente
npm run start:web

# Executar linter em todos os projetos
npm run lint

# Corrigir automaticamente problemas de linting
npm run lint:fix

# Executar todos os testes unitários
npm run test

# Executar o build completo (Frontend e Backend)
npm run build
```

### Comandos de Afetação (`nx affected`):
Ao trabalhar em branches de funcionalidade, utilize os comandos do Nx para rodar tarefas apenas no que foi alterado em relação à `main`:

```bash
npm run affected:lint
npm run affected:test
npm run affected:build
```

---

## 🔀 4. Processo de Pull Request (PR)

1. **Atualize sua branch:** Antes de abrir o PR, sincronize sua branch com a `main` mais recente (`git pull origin main`).
2. **Valide a saúde do código:** O PR só será aceito se passar localmente em:
   - `npm run lint` (0 erros)
   - `npm run test` (100% dos testes passando)
   - `npm run build` (build do web e da api sem falhas)
3. **Abra o Pull Request:**
   - Preencha o template de PR detalhando as alterações e o passo a passo de como testar.
   - Vincule a issue correspondente (ex.: `Closes #12`).
4. **Revisão de Código (Code Review):**
   - Solicite review do **Tech Lead** e/ou de membros do time.
   - Feedbacks do Code Review devem ser tratados com empatia e agilidade.
5. **Integração e Merge:**
   - Com o workflow do GitHub Actions (CI) aprovado e o Code Review aceito, o merge será realizado preferencialmente via **Squash and Merge**.

---

## 🔒 5. Boas Práticas e Governança

- **Segregação de Responsabilidades:** Modelos compartilhados e contratos de interface devem residir em `libs/shared/models`, mantendo `apps/api` e `apps/web` desacoplados.
- **Segurança da Informação e LGPD:** Nunca faça commit de senhas, chaves de API, credenciais de produção ou dados pessoais identificáveis (PII).
- **Tratamento de Erros:** Siga as convenções de erros da arquitetura (ex.: `HTTP 409` para concorrência, `HTTP 403` para violação de alçada/SoD).
- **Consulte a Documentação Técnica:** Para especificações completas de regras de negócio (`RN01` a `RN12`) e arquitetura, consulte o repositório [`alcadas-docs`](../alcadas-docs) ou [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md).