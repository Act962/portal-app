import { expect, test } from "@playwright/test";

/**
 * Fluxo real de autenticação contra o Postgres. Roda no CI contra o Postgres de
 * *service* container (banco dedicado), não contra o dev local.
 *
 * Na Fase 1 (Identidade & Acesso) o fluxo cadastro → sessão → dashboard passou
 * a existir de verdade: ao criar a conta, um `StaffMember` é provisionado (o
 * primeiro do sistema nasce ADMIN), e o `/dashboard` é guardado por staff ativo.
 *
 * Na Fase 5 a tela ganhou o painel novo e foi traduzida — e o padrão do `/login`
 * passou a ser ENTRAR (antes abria no formulário de cadastro), então o caminho
 * do cadastro começa clicando em "Criar conta".
 */
test("T09: cria conta, sai e entra novamente", async ({ page }) => {
	const email = `e2e-${Date.now()}@example.com`;
	const password = "senha-de-teste-123";
	const name = "Repórter de Teste";

	// Cadastro — a tela abre em "Entrar", então troca para o cadastro primeiro.
	await page.goto("/login");
	await page.getByRole("button", { name: "Criar conta" }).click();
	await page.getByLabel("Nome").fill(name);
	await page.getByLabel("E-mail").fill(email);
	await page.getByLabel("Senha").fill(password);
	await page
		.locator("form")
		.getByRole("button", { name: "Criar conta" })
		.click();

	await expect(page).toHaveURL(/\/dashboard/);

	// O menu do usuário vive no rodapé da sidebar e mostra nome + papel.
	const userMenu = page.getByRole("button", { name: new RegExp(name) });
	await expect(userMenu).toBeVisible();

	// Sair
	await userMenu.click();
	await page.getByRole("menuitem", { name: "Sair" }).click();
	await expect(page).toHaveURL(/\/login/);

	// Entrar de novo com as mesmas credenciais (a tela já abre em "Entrar").
	await page.getByLabel("E-mail").fill(email);
	await page.getByLabel("Senha").fill(password);
	await page.locator("form").getByRole("button", { name: "Entrar" }).click();

	await expect(page).toHaveURL(/\/dashboard/);
});
