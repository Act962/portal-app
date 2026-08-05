import type { EditorialStatus } from "@portal-app/editorial";
import { Badge } from "@portal-app/ui/components/badge";

/**
 * O estado editorial como o leitor da redação o entende. `EM_REVISAO` cru é
 * identificador de domínio, não texto de interface.
 */
export const STATUS_LABELS: Record<EditorialStatus, string> = {
	RASCUNHO: "Rascunho",
	EM_REVISAO: "Em revisão",
	APROVADA: "Aprovada",
	AGENDADA: "Agendada",
	PUBLICADA: "Publicada",
	ATUALIZADA: "Atualizada",
	ARQUIVADA: "Arquivada",
};

/** A cor carrega significado: no ar (verde), a caminho (azul), parada (cinza). */
const STATUS_CLASSES: Record<EditorialStatus, string> = {
	RASCUNHO: "bg-muted text-muted-foreground",
	EM_REVISAO:
		"bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
	APROVADA: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
	AGENDADA:
		"bg-violet-100 text-violet-900 dark:bg-violet-950 dark:text-violet-200",
	PUBLICADA:
		"bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
	ATUALIZADA:
		"bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
	ARQUIVADA: "bg-muted text-muted-foreground line-through",
};

export function StatusBadge({ status }: { status: EditorialStatus }) {
	return (
		<Badge variant="secondary" className={STATUS_CLASSES[status]}>
			{STATUS_LABELS[status]}
		</Badge>
	);
}
