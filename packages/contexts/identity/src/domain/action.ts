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
	"article:delete",
	"taxonomy:manage",
	"broadcast:manage",
	"columnists:manage",
	"polls:manage",
	// Publicidade é RECEITA, não redação: só ADMIN. Um editor não deve conseguir
	// subir um anúncio, nem por engano.
	"ads:manage",
	// Redes sociais em DUAS ações, e não uma, porque são dois riscos diferentes.
	// Aprovar um post é ato EDITORIAL — quem decide o que vai ao ar no portal
	// decide o que vai ao ar no Instagram, e concentrar isso no admin faria a
	// fila parar toda vez que ele estivesse fora. Conectar a conta é ato de
	// CREDENCIAL: quem conecta entrega à aplicação um token que fala em nome do
	// veículo, e trocar a conta conectada redireciona tudo que sai daqui.
	"social:publish",
	"social:manage",
	"user:manage",
	"settings:manage",
	"audit:view",
	"analytics:view",
] as const;

export type Action = (typeof ACTIONS)[number];
