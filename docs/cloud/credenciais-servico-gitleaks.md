# Credencial de Serviço com Menor Privilégio e Gitleaks no CI (Issue #51)

Este documento estabelece as diretrizes de segurança, governança e conformidade operacional para a **Conta de Serviço (Service Account)** do Google Cloud e a **Varredura Contínua contra Vazamento de Segredos (Gitleaks)** na plataforma Alçadas, em atendimento à **[Issue #51](https://github.com/Alcadas/alcadas-core/issues/51)**, ao **[Épico #42](https://github.com/Alcadas/alcadas-core/issues/42)**, aos requisitos **RNF09** (Segurança & LGPD) e à **ADR-011** (Plano Custo Zero).

---

## 1. Princípio do Menor Privilégio (PoLP) para a Conta de Serviço

A API NestJS (`apps/api`) utiliza o **Firebase Admin SDK** para persistência no Cloud Firestore e gestão de identidades no Firebase Authentication.

Para mitigar o impacto de um eventual comprometimento da credencial, a conta de serviço opera sob o **Princípio do Menor Privilégio** (*Principle of Least Privilege* — PoLP), possuindo **apenas** os papéis estritamente necessários para a execução das regras de negócio do sistema.

### Matriz de Papéis IAM no Google Cloud

| Papel IAM | Identificador Técnico | Finalidade no Alçadas | Status |
| :--- | :--- | :--- | :--- |
| **Cloud Datastore User** | `roles/datastore.user` | Leitura e escrita de documentos/coleções no Cloud Firestore via transações (`runTransaction`). | ✅ **Concedido** |
| **Firebase Authentication Admin** | `roles/firebaseauth.admin` | Criação de colaboradores, atribuição de custom claims (`tenantId`, `role`, `roles`, `limiteAlcada`) e envio de e-mails de redefinição de senha. | ✅ **Concedido** |
| **Owner (Proprietário)** | `roles/owner` | Acesso total irrestrito a todos os recursos da nuvem e faturamento. | ❌ **PROIBIDO** |
| **Editor** | `roles/editor` | Acesso de edição a recursos gerais da nuvem. | ❌ **PROIBIDO** |
| **Firebase Admin Geral** | `roles/firebase.admin` | Gestão de Hosting, Functions, regras de segurança e faturamento do Firebase. | ❌ **PROIBIDO** |

---

## 2. Guia de Provisionamento via Google Cloud CLI (`gcloud`)

Para provisionar ou reproduzir a Service Account com menor privilégio no projeto `demo-alcadas` (ou no projeto oficial de produção):

```bash
# 1. Definir o ID do projeto no Google Cloud
PROJECT_ID="alcadas-prod" # substitua pelo ID do projeto oficial

# 2. Criar a Service Account dedicada à API
gcloud iam service-accounts create alcadas-api-sa \
  --project="${PROJECT_ID}" \
  --display-name="Alçadas API Service Account (Menor Privilégio - PoLP)"

# 3. Atribuir o papel Cloud Datastore User
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:alcadas-api-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/datastore.user"

# 4. Atribuir o papel Firebase Authentication Admin
gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
  --member="serviceAccount:alcadas-api-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --role="roles/firebaseauth.admin"

# 5. Gerar a chave privada JSON (ARQUIVO NUNCA DEVE SER COMMITADO)
gcloud iam service-accounts keys create ./alcadas-api-key.json \
  --iam-account="alcadas-api-sa@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project="${PROJECT_ID}"
```

---

## 3. Armazenamento e Injeção Segura da Credencial

### Em Produção (Render)
A chave privada **nunca** é versionada no Git. Ela reside exclusivamente no painel do **Render** como variável de ambiente protegida:

- **Nome da Variável:** `FIREBASE_SERVICE_ACCOUNT_JSON`
- **Formatos Aceitos pela API (`apps/api/src/app/firebase/firebase-app.ts`):**
  1. **JSON puro (em uma única linha):**
     ```text
     {"type":"service_account","project_id":"...","private_key_id":"...","private_key":"-----BEGIN PRIVATE KEY-----\n..."}
     ```
  2. **Base64 (recomendado para colar facilmente sem quebra de linha):**
     ```bash
     base64 -w 0 alcadas-api-key.json
     ```
- **Sincronização no `render.yaml`:**
  ```yaml
  - key: FIREBASE_SERVICE_ACCOUNT_JSON
    sync: false
  ```
  O atributo `sync: false` garante que o Render preserve o valor configurado manualmente no painel, sem tentar sobrescrevê-lo pelo repositório Git.

### No Desenvolvimento Local e Testes
Localmente (`npm run docker:up`, `npx nx test`, `npx nx e2e`), a API conecta-se aos emuladores do Firebase (`FIREBASE_AUTH_EMULATOR_HOST=localhost:9099`, `FIRESTORE_EMULATOR_HOST=localhost:8080`) usando o projeto fictício `demo-alcadas`. **Nenhuma chave real é necessária para desenvolver ou testar o sistema.**

---

## 4. Prevenção e Detecção com Gitleaks no CI

Para proteger o repositório contra vazamento acidental de chaves de API, senhas ou tokens, o pipeline do GitHub Actions (`.github/workflows/ci.yml`) executa o **Gitleaks**:

### Arquitetura do Job no CI (`ci.yml`)
- **Job:** `gitleaks` (`Varredura de Segredos (Gitleaks)`)
- **Gatilho:** Executado em todo `pull_request` e `push` direcionado às branches `main` e `develop`.
- **Checkout:** Configurado com `fetch-depth: 0` para analisar todo o histórico do branch e o diff completo do PR.
- **Action Oficial:** `gitleaks/gitleaks-action@v2` com `GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}`.

### Configuração e Allowlist (`.gitleaks.toml`)
O arquivo `.gitleaks.toml` estende as regras padrão do Gitleaks (`useDefault = true`) e define allowlists para falso-positivos em fixtures sintéticas de teste:

```toml
[extend]
useDefault = true

[allowlist]
description = "Allowlist de falsos-positivos em fixtures de testes e templates legados"
paths = [
  '''apps/api/src/app/common/log-requisicoes\.spec\.ts''',
  '''backend/README\.md'''
]
```

### Como Executar o Gitleaks Localmente
Para verificar se o seu código ou histórico contém segredos antes de enviar um PR:

```bash
docker run --rm -v $(pwd):/path zricethezav/gitleaks:latest detect --source="/path" --verbose
```

---

## 5. Procedimento de Resposta a Incidentes (Vazamento Acidental)

Se uma chave privada ou segredo for commitada por engano:

1. **Revogação Imediata:**
   - Acesse o Google Cloud IAM e delete a chave comprometida imediatamente:
     ```bash
     gcloud iam service-accounts keys delete <KEY_ID> \
       --iam-account="alcadas-api-sa@${PROJECT_ID}.iam.gserviceaccount.com"
     ```
2. **Geração de Nova Credencial:**
   - Crie uma nova chave para a Service Account e atualize a variável `FIREBASE_SERVICE_ACCOUNT_JSON` no Render.
3. **Expurgo do Histórico Git:**
   - Utilize ferramentas como `git-filter-repo` ou BFG Repo-Cleaner para expurgar a chave do histórico do repositório antes de realizar novo push.
