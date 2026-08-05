/**
 * Estados do workflow editorial. As transições válidas vivem no agregado
 * `Article` (máquina de estados); aqui está só o conjunto de estados.
 *
 * RASCUNHO → EM_REVISAO → APROVADA → AGENDADA → PUBLICADA → ATUALIZADA → ARQUIVADA
 * (+ EM_REVISAO → RASCUNHO na devolução com motivo).
 */
export const EDITORIAL_STATUSES = [
	"RASCUNHO",
	"EM_REVISAO",
	"APROVADA",
	"AGENDADA",
	"PUBLICADA",
	"ATUALIZADA",
	"ARQUIVADA",
] as const;

export type EditorialStatus = (typeof EDITORIAL_STATUSES)[number];
