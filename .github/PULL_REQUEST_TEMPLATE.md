## 📌 Tipo de Mudança
- [ ] Nova funcionalidade (`feat`)
- [ ] Correção de bug (`fix`)
- [ ] Documentação (`docs`)
- [ ] Refatoração ou ajuste técnico (`refactor` / `chore`)
- [ ] Testes automatizados (`test`)
- [ ] Ajuste de CI/CD (`ci`)

## 📝 Descrição das Alterações
Descreva de forma clara e concisa o que foi implementado, alterado ou corrigido.

## 🔗 Issues e Requisitos Relacionados
- Closes # (insira o número da issue)
- Rastreabilidade: (ex.: `RF03`, `RN05`, `US-02`, `CA-03.1`)

## 🧪 Como Testar?
1. Execute o comando `npm run ...`
2. Teste o endpoint ou tela: `...`
3. Valide o comportamento esperado: `...`

## 📸 Capturas de Tela / Logs (Se aplicável)
*Adicione prints, gifs da interface web ou logs da API, se houver.*

---

## ✅ Definition of Done
> Conforme a [Definition of Done](https://github.com/Alcadas/alcadas-docs/blob/main/docs/governanca/dod.md) (Caderno B2B v2, seção 1.6). Marque só o que for verdade; item que não se aplica fica com `N/A` ao lado.

**Autor**
- [ ] Branch no padrão `feat/#<issue>-nome` (ou `fix/`, `docs/`, `chore/`, `test/`) e commits no padrão [Conventional Commits](https://www.conventionalcommits.org/).
- [ ] `npm run lint`, `npm run test` e `npm run build` passaram localmente.
- [ ] Há **teste novo ligado a um critério de aceite** (cite o `CA-xx.y` no nome do teste ou na descrição).
- [ ] Nenhum segredo (senha, chave, token) no código ou no histórico do PR.
- [ ] Logs não registram dados pessoais (nome, e-mail, CPF, telefone) — `RNF09`.
- [ ] Telas novas ou alteradas tratam os estados **carregando, vazio, erro (com "Tentar novamente") e sucesso** — `RNF08`.
- [ ] Rota nova ou alterada está igual no [contrato OpenAPI](https://github.com/Alcadas/alcadas-docs/blob/main/docs/api/openapi.yaml).
- [ ] Nenhum recurso novo no GCP/Firebase sem ADR ou aprovação do Tech Lead.

**Revisor** (pessoa diferente do autor)
- [ ] Conferi que os testes cobrem a regra alterada e que o CI está verde.
- [ ] Conferi isolamento de tenant e papel (RBAC/SoD) nas rotas tocadas.
