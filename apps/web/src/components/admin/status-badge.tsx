import type { EditorialStatus } from "@portal-app/editorial";
import { Badge } from "@portal-app/ui/components/badge";

/**
 * O estado editorial como o leitor da redação o entende. O fluxo simplificado só
 * tem "Rascunho", "Agendada", "Publicada" e "Arquivada"; `ATUALIZADA` é interno
 * (SEO) e aparece como "Publicada" — para a redação, matéria no ar é publicada.
 */
export const STATUS_LABELS: Record<EditorialStatus, string> = {
	RASCUNHO: "Rascunho",
	AGENDADA: "Agendada",
	PUBLICADA: "Publicada",
	ATUALIZADA: "Publicada",
	ARQUIVADA: "Arquivada",
};

/** A cor carrega significado: no ar (verde), a caminho (azul), parada (cinza). */
const STATUS_CLASSES: Record<EditorialStatus, string> = {
	RASCUNHO: "bg-muted text-muted-foreground",
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
