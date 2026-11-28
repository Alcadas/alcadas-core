import { expect, Page, test } from '@playwright/test';

/** O serviço do tour espera 600 ms antes de abrir o boas-vindas; damos folga para ele aparecer se fosse aparecer. */
const ESPERA_BOAS_VINDAS_MS = 1_500;

const JULIA = 'julia.santana@startop.com.br';
const MARIANA = 'mariana.alves@startop.com.br';
const DEV = 'dev@alcadas.com';

async function entrar(page: Page, email: string, senha = '123456'): Promise<void> {
  await page.goto('/login');
  await page.locator('#email').fill(email);
  await page.locator('#password').fill(senha);
  await page.getByRole('button', { name: 'Entrar na plataforma' }).click();
  await expect(page).not.toHaveURL(/\/login/);
  await expect(page.locator('aside.sidebar')).toBeVisible();
}

/** Encerra a sessão (guardada no sessionStorage) mantendo o localStorage, como outra pessoa no mesmo navegador. */
async function sair(page: Page): Promise<void> {
  await page.evaluate(() => sessionStorage.clear());
  await page.goto('/login');
}

function boasVindas(page: Page) {
  return page.getByRole('dialog', { name: /Bem-vindo ao Alçadas/ });
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

  test('o acesso de desenvolvedor não recebe o tutorial', async ({ page }) => {
    await entrar(page, DEV, 'dev123456');
    await page.waitForTimeout(ESPERA_BOAS_VINDAS_MS);
    await expect(page.getByText(/Bem-vindo ao Alçadas/)).toHaveCount(0);
  });

  test('no primeiro login, o boas-vindas aparece e o tour funciona de ponta a ponta', async ({ page }) => {
    await entrar(page, JULIA);

    await expect(boasVindas(page)).toBeVisible();
    await boasVindas(page).getByRole('button', { name: 'Fazer Tour pelo App' }).click();
    await expect(boasVindas(page)).toHaveCount(0);

    const tour = page.locator('.tour-overlay-wrapper');
    await expect(tour).toBeVisible();
    await expect(page.locator('#tour-step-title')).toHaveText('Menu Lateral de Operações');

    await tour.getByRole('button', { name: /Próximo/ }).click();
    await expect(page.locator('#tour-step-title')).toHaveText('Empresa & Tenant Ativo');
  });

  test('cada pessoa recebe o seu boas-vindas, e quem já viu não vê de novo', async ({ page }) => {
    await entrar(page, JULIA);
    await expect(boasVindas(page)).toBeVisible();
    await boasVindas(page).getByRole('button', { name: 'Explorar sozinho' }).click();
    await expect(boasVindas(page)).toHaveCount(0);

    // Recarregar não traz de volta para a mesma pessoa.
    await page.reload();
    await page.waitForTimeout(ESPERA_BOAS_VINDAS_MS);
    await expect(page.getByText(/Bem-vindo ao Alçadas/)).toHaveCount(0);

    // Outra pessoa no mesmo navegador recebe o seu.
    await sair(page);
    await entrar(page, MARIANA);
    await expect(boasVindas(page)).toBeVisible();
    await boasVindas(page).getByRole('button', { name: 'Explorar sozinho' }).click();

    // A primeira pessoa voltando continua sem o boas-vindas.
    await sair(page);
    await entrar(page, JULIA);
    await page.waitForTimeout(ESPERA_BOAS_VINDAS_MS);
    await expect(page.getByText(/Bem-vindo ao Alçadas/)).toHaveCount(0);
  });
});
