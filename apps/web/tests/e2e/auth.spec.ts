import { expect, test } from "@playwright/test";

/**
 * Fluxo real de autenticação contra o Postgres. Roda no CI contra o Postgres de
 * *service* container (banco dedicado), não contra o dev local.
 *
 * Na Fase 1 (Identidade & Acesso) o fluxo cadastro → sessão → dashboard passou
 * a existir de verdade: ao criar a conta, um `StaffMember` é provisionado (o
 * primeiro do sistema nasce ADMIN), e o `/dashboard` é guardado por staff ativo.
 */
test("T09: cria conta, sai e entra novamente", async ({ page }) => {
	const email = `e2e-${Date.now()}@example.com`;
	const password = "senha-de-teste-123";
	const name = "Repórter de Teste";

	// Cadastro
	await page.goto("/login");
	await page.getByLabel("Name").fill(name);
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill(password);
	await page.getByRole("button", { name: "Sign Up" }).click();

	await expect(page).toHaveURL(/\/dashboard/);
	await expect(page.getByRole("button", { name })).toBeVisible();

	// Logout pelo menu do usuário
	await page.getByRole("button", { name }).click();
	await page.getByRole("menuitem", { name: "Sign Out" }).click();
	await expect(page).toHaveURL("http://localhost:3001/");

	// Login de novo com as mesmas credenciais
	await page.goto("/login");
	await page
		.getByRole("button", { name: "Already have an account? Sign In" })
		.click();
	await page.getByLabel("Email").fill(email);
	await page.getByLabel("Password").fill(password);
	// Escopado ao form: deslogado, o header também tem um botão "Sign In".
	await page.locator("form").getByRole("button", { name: "Sign In" }).click();

	await expect(page).toHaveURL(/\/dashboard/);
});
