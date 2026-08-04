/**
 * Regras de dependência de docs/architecture.md §4 e docs/testing-strategy.md
 * §12, executadas no CI (Fase 0 Etapa 5).
 *
 * Parte das regras é LATENTE: mira `packages/contexts/*`, que só nasce na Fase
 * 1. Elas ficam escritas de forma genérica e passam a valer no instante em que
 * o primeiro contexto aparecer — sem código morto no meio-tempo. As regras
 * `sem-ciclos` e as de `shared-kernel` já valem hoje.
 *
 * O scan cobre `packages/` por enquanto; `apps/web` (que usa o alias `@/`) e os
 * contextos entram na Fase 1, junto da resolução de alias.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
	forbidden: [
		// ── Ativas hoje ────────────────────────────────────────────────
		{
			name: "sem-ciclos",
			comment: "Dependência circular entre módulos.",
			severity: "error",
			from: {},
			to: { circular: true },
		},
		{
			name: "shared-kernel-puro",
			comment:
				"O shared-kernel tem zero dependências externas por regra: mantém o domínio testável em milissegundos e imune a quebra de biblioteca. Nada de npm aqui.",
			severity: "error",
			from: { path: "^packages/shared-kernel/src" },
			to: {
				dependencyTypes: [
					"npm",
					"npm-dev",
					"npm-optional",
					"npm-peer",
					"npm-bundled",
				],
			},
		},
		{
			name: "shared-kernel-isolado",
			comment:
				"O shared-kernel é a base de todos os contextos — não importa nenhum outro pacote do monorepo.",
			severity: "error",
			from: { path: "^packages/shared-kernel/src" },
			to: { path: "^(packages|apps)/", pathNot: "^packages/shared-kernel/" },
		},

		// ── Latentes: valem quando packages/contexts/* existir (Fase 1) ──
		{
			name: "dominio-nao-importa-camadas",
			comment: "domain/ não pode importar application/ nem infrastructure/.",
			severity: "error",
			from: { path: "^packages/contexts/[^/]+/src/domain/" },
			to: {
				path: "^packages/contexts/[^/]+/src/(application|infrastructure)/",
			},
		},
		{
			name: "dominio-sem-deps-externas",
			comment:
				"domain/ é TypeScript puro (nem Prisma, nem Next, nem Zod). Só o shared-kernel — que é local e sem deps — é permitido.",
			severity: "error",
			from: { path: "^packages/contexts/[^/]+/src/domain/" },
			to: {
				dependencyTypes: [
					"npm",
					"npm-dev",
					"npm-optional",
					"npm-peer",
					"npm-bundled",
				],
			},
		},
		{
			name: "aplicacao-nao-importa-infra",
			comment:
				"application/ depende só de domain/ e do shared-kernel; nunca de infrastructure/.",
			severity: "error",
			from: { path: "^packages/contexts/[^/]+/src/application/" },
			to: { path: "^packages/contexts/[^/]+/src/infrastructure/" },
		},
		{
			name: "infra-nao-vaza",
			comment:
				"A camada de interface (apps/web) não importa infrastructure/ de um contexto — só casos de uso.",
			severity: "error",
			from: { path: "^apps/web" },
			to: { path: "^packages/contexts/[^/]+/src/infrastructure/" },
		},
		{
			name: "contextos-isolados",
			comment:
				"Um contexto só enxerga outro pela interface publicada (o índice do pacote), nunca por caminhos internos (domain/application/infrastructure).",
			severity: "error",
			from: { path: "^packages/contexts/([^/]+)/src/" },
			to: {
				path: "^packages/contexts/[^/]+/src/(domain|application|infrastructure)/",
				pathNot: "^packages/contexts/$1/src/",
			},
		},
	],
	options: {
		tsPreCompilationDeps: true,
		// tsconfig mínimo (só o alias `@/` do apps/web) — o do app não serve
		// porque seus globs de include quebram fora do diretório dele.
		tsConfig: { fileName: "tsconfig.depcruise.json" },
		exclude: {
			path: "node_modules|/prisma/generated/|\\.next/|/dist/|/tests/|\\.css$|\\.config\\.(ts|js|cjs|mjs)$",
		},
		doNotFollow: { path: "node_modules" },
		enhancedResolveOptions: {
			exportsFields: ["exports"],
			conditionNames: ["import", "require", "node", "default"],
		},
	},
};
