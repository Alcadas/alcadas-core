# Configuração do Firebase no Plano Spark, Hosting SPA & Security Rules Deny-All (Issue #43)

Este documento registra os procedimentos técnicos, decisões de arquitetura e instruções de deploy para o frontend e segurança no **Firebase** (Google Cloud Platform), atendendo à **[Issue #43](https://github.com/Alcadas/alcadas-core/issues/43)**, ao **[Épico #42](https://github.com/Alcadas/alcadas-core/issues/42)** e à **ADR-011 (Plano Custo Zero)**.

---

## 🎯 1. Visão Geral e Plano Spark (Custo Zero)

Conforme estabelecido na **ADR-011**, o projeto opera sob a política de **Custo Zero**, utilizando o plano gratuito **Spark** do Firebase:
- **Ausência de Cobrança:** Sem cartão de crédito cadastrado na organização/projeto.
- **Limites Gratuitos do Spark:**
  - **Firebase Hosting:** 10 GB de armazenamento e 360 MB/dia de transferência de dados (suficiente para o SPA Angular).
  - **Firebase Authentication:** Até 50.000 usuários ativos mensais (MAU) gratuitos. Provedor nativo ativado: **Email/Password**.
  - **Cloud Firestore:** 1 GiB de armazenamento, 50.000 leituras/dia, 20.000 gravações/dia e 20.000 exclusões/dia.
  - **Localização do Banco:** `southamerica-east1` (São Paulo) ou `us-central1` (Iowa).

---

## 🌐 2. Firebase Hosting & Rewrites para SPA Angular

Aplicações de Página Única (SPA) com roteamento no lado do cliente (Angular Router com rotas como `/solicitacoes`, `/centros-custo`, `/login`) exigem que o servidor web redirecione todas as requisições de rotas desconhecidas para o arquivo raiz `index.html`. Sem essa configuração, recarregar o navegador ou acessar diretamente uma URL interna resulta em **HTTP 404 Not Found**.

### Configuração no [`firebase.json`](../../firebase.json)

```json
{
  "hosting": {
    "public": "dist/apps/web/browser",
    "ignore": [
      "firebase.json",
      "**/.*",
      "**/node_modules/**"
    ],
    "rewrites": [
      {
        "source": "**",
        "destination": "/index.html"
      }
    ]
  },
  "firestore": {
    "rules": "firestore.rules"
  }
}
```

### Validação dos Rewrites

Quando o emulador ou servidor de Hosting recebe requisições para rotas profundas:
- Requisição: `GET /solicitacoes`
- Resposta: `HTTP 200 OK`
- Conteúdo: `dist/apps/web/browser/index.html` (carregando o bootstrap do Angular via `<app-root>`).

---

## 🔒 3. Firestore Security Rules Deny-All

Para garantir a **Segregação de Funções (SoD)**, integridade da **Trilha Criptográfica SHA-256** e isolamento absoluto multi-tenant, nenhuma operação de leitura ou gravação direta é permitida a clientes web ou SDKs JavaScript do navegador:

### Configuração no [`firestore.rules`](../../firestore.rules)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

### Garantias de Segurança
1. **Bloqueio Total do Navegador:** Tentativas de clientes anônimos ou autenticados via Firebase Web SDK são rejeitadas imediatamente com erro `PERMISSION_DENIED`.
2. **Acesso Exclusivo via API:** Todas as consultas, transições de estado (OCC) e gravações na trilha de auditoria ocorrem estritamente através da API NestJS autenticada via Firebase Admin SDK com credenciais privilegiadas de serviço.
3. **Cobertura de Testes:** Suíte automatizada com `@firebase/rules-unit-testing` validada em [`apps/api-e2e/src/rules/firestore-rules.spec.ts`](../../apps/api-e2e/src/rules/firestore-rules.spec.ts).

---

## 🚀 4. Comandos de Build, Deploy e Verificação

### Compilação do Frontend
```bash
# Compilar a aplicação Angular em modo de produção
npx nx build web --configuration=production
```

### Deploy no Firebase
```bash
# Deploy exclusivo das regras de segurança do Firestore
npx firebase-tools deploy --only firestore:rules

# Deploy exclusivo do frontend no Hosting
npx firebase-tools deploy --only hosting

# Deploy completo dos recursos do Firebase
npx firebase-tools deploy
```

### Teste Local com Emulador de Hosting
```bash
# Iniciar o emulador de Hosting e testar a resolução de rotas SPA
npx firebase-tools emulators:exec --only hosting "curl -i http://localhost:5000/solicitacoes"
# Resposta esperada: HTTP 200 OK com o index.html
```
