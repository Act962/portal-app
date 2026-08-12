import { cn } from "@portal-app/ui/lib/utils";

import type { PollView } from "@/data/polls";

/**
 * Uma enquete ENCERRADA, com o resultado aberto.
 *
 * Server component, e sem `PollForm`: não há mais o que votar, então nem o
 * botão nem o JavaScript dele fazem sentido aqui. Mostrar botões desabilitados
 * seria pior — convidam ao clique e não respondem.
 *
 * Aqui cabe a barra que o card da barra lateral não comporta: nesta página há
 * largura, e proporção se lê melhor em comprimento do que em número.
 */
export function PollResultCard({ poll }: { poll: PollView }) {
	// O empate tem MAIS DE UM vencedor. Comparar com o `[0]` de uma lista
	// ordenada destacaria só o primeiro, e o leitor entenderia que houve um
	// ganhador onde houve empate.
	const top = Math.max(...poll.options.map((option) => option.percentage ?? 0));

	return (
		<article className="rounded-card border border-hairline bg-surface p-4 md:p-5">
			<h2 className="mb-3 text-pretty font-bold text-[17px] text-brand-navy leading-snug md:text-lg">
				{poll.question}
			</h2>

			<ul className="flex flex-col gap-2.5">
				{poll.options.map((option) => {
					const percentage = option.percentage ?? 0;
					const isTop = poll.totalVotes > 0 && percentage === top;

					return (
						<li key={option.id}>
							<div className="mb-1 flex items-baseline justify-between gap-3">
								<span
									className={cn(
										"text-[13px] text-brand-navy",
										isTop ? "font-bold" : "font-medium",
									)}
								>
									{option.label}
								</span>
								<span className="shrink-0 font-mono text-[11px] text-meta">
									{percentage}%
								</span>
							</div>

							{/*
							  A barra é decorativa: o número ao lado já é o dado, e um
							  `role="meter"` faria o leitor de tela anunciar a mesma
							  informação duas vezes.
							*/}
							<div
								aria-hidden
								className="h-1.5 overflow-hidden rounded-full bg-surface-alt"
							>
								<div
									className={cn(
										"poll-bar h-full rounded-full",
										isTop ? "bg-brand-red" : "bg-brand-navy/35",
									)}
									style={{ width: `${percentage}%` }}
								/>
							</div>
						</li>
					);
				})}
			</ul>

			<p className="mt-3 font-mono text-[9.5px] text-meta">
				ENCERRADA · {poll.totalVotes} {poll.totalVotes === 1 ? "VOTO" : "VOTOS"}
			</p>
		</article>
	);
}
