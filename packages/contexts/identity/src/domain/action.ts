/**
 * Ações autorizáveis do sistema. Um papel pode ou não realizar cada uma delas —
 * ver `can()` em `authorization.ts` e a matriz em features.md §3.4.
 *
 * As ações `article:*` referenciam matérias, cujo agregado nasce só na Fase 3.
 * O domínio de identidade não depende dele: a autorização recebe um
 * `ResourceRef` mínimo (autor/editoria), não o `Article`.
 */
export const ACTIONS = [
	"article:create",
	"article:edit-own",
	"article:edit-any",
	"article:submit",
	"article:approve",
	"article:publish",
	"article:unpublish",
	"taxonomy:manage",
	"user:manage",
	"settings:manage",
	"audit:view",
] as const;

export type Action = (typeof ACTIONS)[number];
