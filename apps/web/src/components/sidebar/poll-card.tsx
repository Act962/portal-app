import type { PollView } from "@/data/polls";

import { PollForm } from "./poll-form";

/**
 * Enquete da semana. SERVER component: quem decide se o resultado aparece é o
 * servidor (as porcentagens só chegam depois do voto — ver `data/polls.ts`),
 * não o CSS. Só o botão de votar é cliente (`PollForm`).
 *
 * Sem enquete publicada, o bloco inteiro some — melhor do que um card vazio
 * dizendo "nenhuma enquete".
 */
export function PollCard({ poll }: { poll: PollView | null }) {
	if (!poll) {
		return null;
	}

	const hasVoted = poll.votedFor !== null;

	return (
		<section className="rounded-card border border-hairline bg-surface p-4">
			<h2 className="mb-2 font-mono text-[9px] text-brand-accent-ink tracking-[0.14em]">
				ENQUETE DA SEMANA
			</h2>

			<p className="mb-3 text-pretty font-bold text-[17px] text-brand-ink leading-snug">
				{poll.question}
			</p>

			<PollForm
				pollId={poll.id}
				options={poll.options}
				votedFor={poll.votedFor}
			/>

			<p aria-live="polite" className="mt-2.5 font-mono text-[9.5px] text-meta">
				{hasVoted
					? `Obrigado pelo voto · ${poll.totalVotes} ${plural(poll.totalVotes)}`
					: `${poll.totalVotes} ${plural(poll.totalVotes)} · vote para ver o resultado`}
			</p>
		</section>
	);
}

function plural(total: number): string {
	return total === 1 ? "voto" : "votos";
}
