import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

/**
 * Dois projects com custos muito diferentes, que precisam rodar separados:
 * `unit` é instantâneo e sem setup; `integration` sobe um Postgres real via
 * Testcontainers. Ver docs/testing-strategy.md §7.
 */
export default defineConfig({
	/**
	 * O alias `@/` do `apps/web`. O tsconfig do app já o conhece, mas o vitest
	 * roda da raiz e não lê `paths` — sem isto, o primeiro teste de um módulo do
	 * app falha no import, e o custo aparece justamente na hora de escrever o
	 * teste. Fica aqui, e não dentro de um project, para valer nos dois.
	 */
	resolve: {
		alias: {
			"@": fileURLToPath(new URL("./apps/web/src", import.meta.url)),
		},
	},
	test: {
		projects: [
			{
				extends: true,
				test: {
					name: "unit",
					environment: "node",
					include: ["**/tests/unit/**/*.test.ts"],
					setupFiles: ["./tests/setup/matchers.ts"],
				},
			},
			{
				extends: true,
				test: {
					name: "integration",
					environment: "node",
					include: ["**/tests/integration/**/*.test.ts"],
					setupFiles: ["./tests/setup/matchers.ts"],
					globalSetup: ["./tests/integration/global-setup.ts"],
					// Um container por execução, compartilhado entre arquivos: subir
					// container por teste é proibitivo. Sem paralelismo de arquivos
					// para não haver corrida sobre o mesmo banco.
					fileParallelism: false,
					hookTimeout: 120_000,
					testTimeout: 30_000,
				},
			},
		],
		coverage: {
			provider: "v8",
			reporter: ["text", "html"],
			exclude: [
				"**/prisma/generated/**",
				"**/*.config.*",
				"packages/ui/**",
				"**/tests/**",
				"**/index.ts",
				"**/.next/**",
				"**/dist/**",
			],
			// `fail-under` do domínio ligado na Fase 1 (docs/testing-strategy.md
			// §10): é a regra de negócio, onde uma linha não coberta é risco
			// direto. Aplicação (90%), infra (70%) e global (80%) entram quando
			// houver domínio/UI suficiente para o número não ser ruído.
			thresholds: {
				"packages/contexts/**/src/domain/**": {
					statements: 95,
					branches: 95,
					functions: 95,
					lines: 95,
				},
			},
		},
	},
});
