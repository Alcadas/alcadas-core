# API em Produção — Segurança, Persistência e Operação (Checkpoint 3)

Guia de operação das entregas de backend do Gate 3. Nenhum valor real de variável de ambiente é
versionado: os segredos ficam no painel do Render (ver [`render.yaml`](../../render.yaml)).

| Issue | Entrega | Onde está |
| :--- | :--- | :--- |
| #34 | CORS restrito aos domínios da equipe | `apps/api/src/app/common/cors.ts` |

---

## CORS restrito aos domínios da equipe (#34)

Origens aceitas pela API:

1. as listadas em `WEB_URL` (separadas por vírgula) — em produção, só o domínio oficial do Firebase Hosting;
2. os canais de preview `https://<site>--<canal>.web.app` do site em `FIREBASE_HOSTING_SITE`
   (na falta dela vale `FIREBASE_PROJECT_ID`).

Qualquer outra origem fica sem `Access-Control-Allow-Origin`. Em produção `localhost` **não** é liberado.

| Variável | Exemplo | Para quê |
| :--- | :--- | :--- |
| `WEB_URL` | `https://alcadas-app.web.app` | Origem oficial do frontend |
| `FIREBASE_HOSTING_SITE` | `alcadas-app` | Site cujos canais de preview são aceitos |

```bash
curl -i -H "Origin: https://site-qualquer.com" https://<api>.onrender.com/api/healthz
# sem o cabeçalho Access-Control-Allow-Origin

curl -i -H "Origin: https://alcadas-app--pr12-abc123.web.app" https://<api>.onrender.com/api/healthz
# Access-Control-Allow-Origin: https://alcadas-app--pr12-abc123.web.app
```
