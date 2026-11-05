# Relatório FinOps e Controle de Gastos — Checkpoint 2 (DevOps)

> **Documento de Conformidade:** Issue #10 (`Alcadas/alcadas-core`) e Issue #15 (`Alcadas/alcadas-docs`).  
> **Responsáveis:** DevOps & Tech Lead  
> **Data:** Novembro de 2026  
> **Teto Orçamentário Máximo do Checkpoint:** US$ 5,00

---

## 1. Sumário Executivo

Durante o ciclo do **Checkpoint 2 (Núcleo Funcional)**, a arquitetura adotada priorizou o princípio de **Custo Zero em Nuvem** através do uso integral de:
- **Firebase Emulators locais** (Firestore na porta `8080`, Firebase Authentication na porta `9099`, Emulator UI na porta `4000`).
- **Docker Compose orquestrado** para subida autônoma da API NestJS, Web Angular e carga de dados (`seed`).
- **Execução de CI com emuladores via runner local do GitHub Actions (`ubuntu-latest`)**, dispensando qualquer infraestrutura em nuvem provisionada na GCP para os testes automatizados.

Como resultado, o consumo financeiro acumulado no Google Cloud Platform permanece em **US$ 0,00**, plenamente abaixo do teto de US$ 5,00 estipulado pelo laboratório.

---

## 2. Evidência do Painel de Faturamento (Billing GCP)

- **Projeto GCP:** `demo-alcadas` (ou projeto acadêmico vinculado).
- **Período de Apuração:** Checkpoint 2 (Outubro - Novembro).
- **Gasto Real Acumulado:** **US$ 0,00** (Zero Dólares).

### Como extrair o print para o PO:
1. Acesse o [Console do Google Cloud](https://console.cloud.google.com/).
2. No menu lateral, navegue até **Faturamento (Billing) → Relatórios**.
3. Filtre pelo projeto correspondente e agrupe por **Serviço**.
4. Capture o print da tela demonstrando que a fatura do período está em **US$ 0,00** (ou $\le$ US$ 5,00).

---

## 3. Estimativa de Custos Futuros (Calculadora Google Cloud)

Para fins de planejamento do Checkpoint 3 e transição para ambiente de homologação (Cloud Run + Firestore):

| Recurso / Serviço | Estimativa de Uso Mensal | Nível Gratuito (Free Tier) | Custo Estimado (US$) |
| :--- | :--- | :--- | :--- |
| **Cloud Firestore** | ~50.000 leituras / 20.000 escritas | 50.000 leituras/dia, 20.000 escritas/dia | **US$ 0,00** |
| **Cloud Run (API NestJS)** | 1 serviço (1 vCPU, 512 MB, sob demanda) | 2 milhões de requisições/mês gratuitas | **US$ 0,00** |
| **Firebase Hosting (Frontend Web)** | Armazenamento de 50 MB, tráfego < 1 GB | Até 10 GB/mês gratuitos | **US$ 0,00** |
| **Total Mensal Estimado** | — | — | **US$ 0,00** (até US$ 2,50 com margem) |

*Link da Calculadora GCP:* [Google Cloud Pricing Calculator](https://cloud.google.com/products/calculator)

---

## 4. Plano de Contenção

Caso no futuro algum recurso de nuvem venha a ultrapassar a meta de US$ 5,00:
1. **Alertas de Orçamento (Budget Alerts):** Configuração de alertas em 50% (US$ 2,50), 80% (US$ 4,00) e 100% (US$ 5,00) com disparo automático para os e-mails do time de DevOps e Tech Lead.
2. **Desligamento Imediato:** Qualquer instância não gerenciada ou recurso esquecido deve ser desalocado imediatamente via Terraform/Console.
3. **Registro Obrigatório:** Registrar no arquivo `docs/finops/estouro-cpX.md` o motivo, impacto e ações preventivas adotadas.
