/**
 * Estados do workflow editorial. As transições válidas vivem no agregado
 * `Article` (máquina de estados); aqui está só o conjunto de estados.
 *
 * O fluxo foi simplificado a pedido dos clientes: o usuário enxerga só duas
 * posições — **Não publicado** (`RASCUNHO`, ou `AGENDADA` com hora marcada) e
 * **Publicado** (`PUBLICADA`). Saíram os passos intermediários `EM_REVISAO` e
 * `APROVADA`: publicar exige a permissão `article:publish` (editor/admin), não
 * mais um vai-e-volta de revisão.
 *
 * RASCUNHO ⇄ PUBLICADA (publicar / despublicar), RASCUNHO ⇄ AGENDADA
 * (agendar / cancelar), AGENDADA → PUBLICADA (poller), PUBLICADA → ATUALIZADA
 * (editar no ar; interno, para SEO), qualquer um → ARQUIVADA.
 *
 * `ATUALIZADA` continua existindo por baixo — é só o sinal de que uma matéria
 * no ar foi editada (SEO/`lastmod`); o painel a rotula como "Publicada".
 */
export const EDITORIAL_STATUSES = [
	"RASCUNHO",
	"AGENDADA",
	"PUBLICADA",
	"ATUALIZADA",
	"ARQUIVADA",
] as const;

export type EditorialStatus = (typeof EDITORIAL_STATUSES)[number];
