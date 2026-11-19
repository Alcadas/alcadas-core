import { expect, Page, test } from '@playwright/test';

async function entrar(page: Page): Promise<void> {
  // Marca o modal de boas-vindas como já visto, para ele não cobrir a tela durante o teste.
  await page.addInitScript(() => {
    window.localStorage.setItem('alcadas_has_seen_welcome_v1', 'true');
  });
  await page.goto('/login');
  await page.locator('#email').fill('dev@alcadas.com');
  await page.locator('#password').fill('dev123456');
  await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

/** Token de administrador da startop para criar dados direto na API (fora de produção a API aceita JWT sem assinatura). */
function tokenAdminStartop(): string {
  const base64 = (obj: object) =>
    btoa(JSON.stringify(obj)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const payload = {
    uid: 'e2e-admin-startop',
    tenantId: 'startop',
    role: 'ADMIN',
    roles: ['ADMIN'],
    exp: Math.floor(Date.now() / 1000) + 3600,
  };
  return `${base64({ alg: 'none', typ: 'JWT' })}.${base64(payload)}.assinatura`;
}

test.describe('US-01 — Configurar centros de custo (tela)', () => {
  test('CA-01.3: centro de custo recém-criado aparece no formulário de solicitação em até 1,5 s, sem recarregar', async ({
    page,
    request,
  }) => {
    await entrar(page);
    await page.goto('/solicitacoes');
    await expect(page.getByText('Carregando…')).toHaveCount(0);

    const nome = `Centro E2E ${Date.now()}`;
    const criado = await request.post('http://localhost:3000/api/centros-custo', {
      headers: { Authorization: `Bearer ${tokenAdminStartop()}` },
      data: { name: nome, code: `E2E${Date.now() % 100000}` },
    });
    expect(criado.status()).toBe(201);

    // Sem recarregar a página: abre o formulário e procura o centro de custo novo na lista.
    await page.locator('[data-tour="btn-new-request"]').click();
    const opcao = page.locator('#createCcSelect option', { hasText: nome });
    await expect(opcao).toHaveCount(1, { timeout: 1_500 });
  });
});

test.describe('US-02 — Criar solicitação (tela)', () => {
  test('CA-02.4: após o envio, a solicitação aparece na lista como PENDENTE em até 1,5 s', async ({ page }) => {
    await entrar(page);
    await page.goto('/solicitacoes');
    await expect(page.getByText('Carregando…')).toHaveCount(0);

    await page.locator('[data-tour="btn-new-request"]').click();
    const modal = page.getByRole('dialog', { name: /Nova Solicitação de Compra/ });
    await expect(modal).toBeVisible();

    // Código único no início da justificativa: a tabela usa o começo dela como título da linha.
    const codigo = `E2E-${Date.now()}`;
    await modal.locator('#createTituloInput').fill(`Teste ${codigo}`);
    await modal.locator('#createCategoriaSelect').selectOption('MATERIAL_ESCRITORIO');
    await modal.locator('#createJustificativaInput').fill(`${codigo} compra de material de escritório para o teste de tela`);
    await modal.locator('#createValorInput').pressSequentially('40000'); // R$ 400,00

    await modal.getByRole('button', { name: 'Submeter para Aprovação' }).click();

    const linha = page.locator('tr.request-table-row', { hasText: codigo });
    await expect(linha).toBeVisible({ timeout: 1_500 });
    // A tela exibe o status PENDENTE da API como "Em análise" (requests.mapper.ts).
    await expect(linha).toContainText('Em análise');
  });
});
