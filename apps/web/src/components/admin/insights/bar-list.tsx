/**
 * Barras horizontais com rótulo e valor — a forma certa quando as categorias
 * têm nome longo (autor, editoria, título de matéria) e o trabalho do leitor é
 * comparar magnitude.
 *
 * Série ÚNICA de propósito: uma cor só (`--chart-3`, validada ≥3:1 nas duas
 * superfícies), sem paleta categórica. Por isso também não há legenda — o
 * título do bloco já diz o que está plotado, e uma caixa com um swatch só
 * repetiria o título.
 *
 * A barra é o gráfico E a tabela ao mesmo tempo: rótulo e valor estão sempre
 * visíveis, então nada fica escondido atrás de hover.
 */
export function BarList({
	items,
	emptyLabel = "Sem dados no período.",
}: {
	items: Array<{ key: string; label: string; value: number; hint?: string }>;
	emptyLabel?: string;
}) {
	if (items.length === 0) {
		return <p className="py-6 text-center text-muted-foreground text-sm">{emptyLabel}</p>;
	}

	// Escala contra o MAIOR valor, não contra a soma: a leitura aqui é
	// "quem é maior que quem", não parte-de-um-todo.
	const max = Math.max(...items.map((item) => item.value), 1);

	return (
		<ul className="flex flex-col gap-3">
			{items.map((item) => (
				<li key={item.key} className="flex flex-col gap-1">
					<div className="flex items-baseline justify-between gap-3">
						<span className="min-w-0 truncate text-sm">{item.label}</span>
						<span className="shrink-0 font-medium text-sm tabular-nums">
							{item.hint ?? item.value.toLocaleString("pt-BR")}
						</span>
					</div>
					{/* Trilho recessivo + barra fina com ponta arredondada (4px), presa
					    à base à esquerda. Altura 8px: a barra é dado, não decoração. */}
					<div className="h-2 w-full rounded-full bg-muted">
						<div
							className="h-2 rounded-full bg-chart-3"
							style={{ width: `${Math.max((item.value / max) * 100, item.value > 0 ? 2 : 0)}%` }}
						/>
					</div>
				</li>
			))}
		</ul>
	);
}
