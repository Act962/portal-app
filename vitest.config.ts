import { defineConfig } from "vitest/config";

/**
 * Dois projects com custos muito diferentes, que precisam rodar separados:
 * `unit` é instantâneo e sem setup; `integration` sobe um Postgres real via
 * Testcontainers. Ver docs/testing-strategy.md §7.
 */
export default defineConfig({
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
			// Limiares de docs/testing-strategy.md §10 ficam CONFIGURADOS mas
			// DESLIGADOS nesta fase: com quase nenhum código de domínio, qualquer
			// percentual seria ruído. O `fail-under` liga na Fase 1, junto do
			// primeiro domínio real. Descomentar lá:
			//
			// thresholds: {
			//   "**/domain/**": { statements: 95, branches: 95, functions: 95, lines: 95 },
			//   "**/application/**": { statements: 90, branches: 90, functions: 90, lines: 90 },
			//   "**/infrastructure/**": { statements: 70, branches: 70, functions: 70, lines: 70 },
			//   global: { statements: 80, branches: 80, functions: 80, lines: 80 },
			// },
		},
	},
});
