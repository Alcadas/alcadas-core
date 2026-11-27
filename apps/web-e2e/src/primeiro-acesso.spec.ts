import { expect, Page, test } from '@playwright/test';

/** O serviço do tour espera 600 ms antes de abrir o boas-vindas; damos folga para ele aparecer se fosse aparecer. */
const ESPERA_BOAS_VINDAS_MS = 1_500;

async function entrar(page: Page): Promise<void> {
  await page.locator('#email').fill('dev@alcadas.com');
  await page.locator('#password').fill('dev123456');
  await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
}

test.describe('#109 — Tutorial na primeira inicialização', () => {
  test('sem login, o boas-vindas e o tour não são exibidos', async ({ page }) => {
    const errosDeConsole: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errosDeConsole.push(msg.text());
    });

    await page.goto('/');
    await expect(page).toHaveURL(/\/login/);
    await page.waitForTimeout(ESPERA_BOAS_VINDAS_MS);

    await expect(page.locator('app-welcome-modal')).toHaveCount(0);
    await expect(page.locator('app-tour-overlay')).toHaveCount(0);
    await expect(page.getByText(/Bem-vindo ao Alçadas/)).toHaveCount(0);
    expect(errosDeConsole).toEqual([]);
  });

  test('após o primeiro login, o boas-vindas aparece e o tour funciona de ponta a ponta', async ({ page }) => {
    await page.goto('/login');
    await entrar(page);

    const boasVindas = page.getByRole('dialog', { name: /Bem-vindo ao Alçadas/ });
    await expect(boasVindas).toBeVisible();

    await boasVindas.getByRole('button', { name: 'Fazer Tour pelo App' }).click();
    await expect(boasVindas).toHaveCount(0);

    const tour = page.locator('.tour-overlay-wrapper');
    await expect(tour).toBeVisible();
    await expect(page.locator('#tour-step-title')).toHaveText('Menu Lateral de Operações');
    // O passo aponta para o menu lateral, que só existe com sessão ativa.
    await expect(page.locator('aside.sidebar')).toBeVisible();

    await tour.getByRole('button', { name: /Próximo/ }).click();
    await expect(page.locator('#tour-step-title')).toHaveText('Empresa & Tenant Ativo');
  });

  test('o boas-vindas já visto não reaparece no próximo acesso', async ({ page }) => {
    await page.goto('/login');
    await entrar(page);

    const boasVindas = page.getByRole('dialog', { name: /Bem-vindo ao Alçadas/ });
    await expect(boasVindas).toBeVisible();
    await boasVindas.getByRole('button', { name: 'Explorar sozinho' }).click();
    await expect(boasVindas).toHaveCount(0);

    await page.reload();
    await expect(page).toHaveURL(/\/dashboard/);
    await page.waitForTimeout(ESPERA_BOAS_VINDAS_MS);
    await expect(page.getByText(/Bem-vindo ao Alçadas/)).toHaveCount(0);
  });
});
