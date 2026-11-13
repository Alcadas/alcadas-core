# API em Produção — Segurança, Persistência e Operação (Checkpoint 3)

Guia de operação das entregas de backend do Gate 3. Nenhum valor real de variável de ambiente é
versionado: os segredos ficam no painel do Render (ver [`render.yaml`](../../render.yaml)).

| Issue | Entrega | Onde está |
| :--- | :--- | :--- |
| #34 | CORS restrito aos domínios da equipe | `apps/api/src/app/common/cors.ts` |
| #35 | Logs JSON com `requestId`, sem dados pessoais | `apps/api/src/app/common/log-requisicoes.ts` |
| #29 | Firestore real via Admin SDK, sem fallback em memória, `/readyz` | `apps/api/src/app/database/firestore.service.ts` |

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

---

## Logs estruturados com `requestId` (#35 / RNF09)

Cada requisição gera **uma** linha JSON no stdout e a resposta leva o cabeçalho `X-Request-Id`:

```json
{"timestamp":"2026-11-13T12:00:00.000Z","severity":"INFO","requestId":"0b0e6f0c-…","metodo":"POST","rota":"/api/solicitacoes","status":201,"duracaoMs":85}
```

- `severity`: `INFO` (<400), `WARNING` (4xx), `ERROR` (5xx — acrescenta `erro` com o tipo da exceção, nunca a mensagem).
- A linha tem uma lista fechada de campos. Corpo, query string e cabeçalhos nunca são lidos; segmentos
  de rota com e-mail ou token viram `:email` / `:oculto`. Nomes, e-mails, tokens, senhas e
  justificativas não chegam ao log.
- Um `X-Request-Id` enviado pelo cliente é reaproveitado quando tem formato seguro
  (`[A-Za-z0-9._-]{8,64}`); caso contrário a API gera um UUID.
- Para investigar um erro, peça o `X-Request-Id` da resposta e filtre os logs do Render por ele.
- Em produção as mensagens do próprio NestJS também saem em JSON.

---

## Firestore real e `/api/readyz` (#29)

| Ambiente | Banco | Se o banco falhar |
| :--- | :--- | :--- |
| `NODE_ENV=production` | Firestore real (Admin SDK) | **HTTP 503** `FIRESTORE_INDISPONIVEL` — nada fica em memória |
| desenvolvimento / testes | Emulador (`FIRESTORE_EMULATOR_HOST`) | store em memória, só para desenvolver |

| Variável | Obrigatória | Para quê |
| :--- | :--- | :--- |
| `FIREBASE_PROJECT_ID` | sim | Projeto Firebase (Auth + Firestore) |
| `FIREBASE_SERVICE_ACCOUNT_JSON` | sim¹ | Conta de serviço do Admin SDK — JSON puro ou em base64. **Nunca versionar.** |
| `READYZ_CACHE_TTL_MS` | não | Validade do `/readyz` saudável (padrão `60000`) |

¹ Dispensável quando o ambiente já fornece credenciais padrão (`GOOGLE_APPLICATION_CREDENTIALS`).

**Boot resiliente:** o Firebase é inicializado na primeira operação, então a API sobe mesmo sem
credencial válida. Nesse caso `/api/healthz` responde 200 (processo vivo) e `/api/readyz` responde 503
até a credencial ser corrigida.

```bash
curl -i https://<api>.onrender.com/api/readyz
# 200 {"status":"ok","firestore":"ok"}
# 503 {"statusCode":503,"error":"NAO_PRONTO","message":"Firestore indisponível.", ...}
```

**Cotas (plano Spark):** cada verificação real custa 1 leitura. O resultado saudável é reaproveitado por
60 s, então um monitor batendo em `/readyz` gasta no máximo ~1.440 das 50.000 leituras diárias.
Falhas não são cacheadas e qualquer operação que falhe invalida o cache. O health check do Render
continua em `/api/healthz`, que não toca no banco.
