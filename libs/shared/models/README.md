# @alcadas-core/models

Biblioteca de modelos e contratos compartilhados (*shared models*) entre a API NestJS (`apps/api`) e a aplicação web Angular (`apps/web`).

---

## 🎯 Objetivo

Eliminar discrepâncias de contrato entre frontend e backend, centralizando:
- Interfaces e tipos de dados do domínio (**Solicitação**, **Centro de Custo**, **Faixa de Alçada**, **Aprovador**, **Delegação**).
- Estruturas de dados da **Trilha de Auditoria** e elos de *hash* criptográfico SHA-256.
- Tipos de eventos e estados da **Máquina de Estados** (`PENDENTE`, `APROVADA`, `REJEITADA`, `EM_AJUSTE`).
- DTOs (*Data Transfer Objects*) de requisição e resposta.

---

## 🧪 Testes Unitários

Para rodar os testes desta biblioteca:

```bash
npm run test:models
# ou
npx nx test models
```

---

## 📦 Como Importar

Esta biblioteca pode ser importada diretamente em qualquer aplicação ou biblioteca do monorepo:

```typescript
import { Solicitacao, StatusSolicitacao } from '@alcadas-core/models';
```
