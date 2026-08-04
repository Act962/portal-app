import { defineConfig, devices } from "@playwright/test";

/**
 * E2E do portal. Aponta para o dev server do `apps/web`. Os seletores usam
 * papel acessível (getByRole/getByLabel), nunca classe CSS — quebram menos e
 * validam acessibilidade de graça (docs/testing-strategy.md §9).
 */
export default defineConfig({
	testDir: "./apps/web/tests/e2e",
	fullyParallel: true,
	forbidOnly: Boolean(process.env.CI),
	retries: process.env.CI ? 2 : 0,
	workers: process.env.CI ? 1 : undefined,
	reporter: process.env.CI ? [["html", { open: "never" }]] : "list",
	// Folga para o cold start do dev server do Next (lazy-compile + React
	// Compiler na primeira request). Ainda é espera por condição, não sleep fixo.
	expect: { timeout: 15_000 },
	use: {
		baseURL: "http://localhost:3001",
		trace: "on-first-retry",
		navigationTimeout: 30_000,
	},
	projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
	webServer: {
		command: "pnpm dev:web",
		url: "http://localhost:3001",
		reuseExistingServer: !process.env.CI,
		timeout: 120_000,
	},
});
