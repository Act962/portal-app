import { Badge } from "@portal-app/ui/components/badge";

/**
 * O selo de estado da campanha.
 *
 * As cores têm SIGNIFICADO comercial, e não decorativo: verde é o que está
 * rendendo agora, âmbar é o que ainda vai render, azul é o que foi interrompido
 * e cinza é o que acabou. Quem bate o olho na lista quer saber, antes de tudo,
 * o que está no ar.
 */
const STATES: Record<string, { label: string; className: string }> = {
	NO_AR: {
		label: "No ar",
		className:
			"border-emerald-600/30 bg-emerald-600/10 text-emerald-700 dark:text-emerald-400",
	},
	AGENDADA: {
		label: "Agendada",
		className:
			"border-amber-600/30 bg-amber-600/10 text-amber-700 dark:text-amber-400",
	},
	RASCUNHO: { label: "Rascunho", className: "" },
	PAUSADA: {
		label: "Pausada",
		className: "border-sky-600/30 bg-sky-600/10 text-sky-700 dark:text-sky-400",
	},
	ENCERRADA: { label: "Encerrada", className: "text-muted-foreground" },
};

export function CampaignStateBadge({ state }: { state: string }) {
	const item = STATES[state] ?? { label: state, className: "" };
	return (
		<Badge variant="outline" className={item.className}>
			{item.label}
		</Badge>
	);
}
