/**
 * Cabeçalho de uma tela do painel. Substitui o
 * `<div className="mx-auto max-w-4xl p-6"><h1 className="mb-6 …">` que estava
 * copiado em todas as páginas.
 */
export function PageHeader({
	title,
	description,
	actions,
}: {
	title: string;
	description?: string;
	actions?: React.ReactNode;
}) {
	return (
		<div className="flex flex-wrap items-start justify-between gap-3">
			<div className="min-w-0">
				<h1 className="font-semibold text-2xl tracking-tight">{title}</h1>
				{description ? (
					<p className="mt-1 text-muted-foreground text-sm">{description}</p>
				) : null}
			</div>
			{actions ? (
				<div className="flex items-center gap-2">{actions}</div>
			) : null}
		</div>
	);
}
