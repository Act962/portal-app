"use client";

import { cn } from "@portal-app/ui/lib/utils";
import { useState } from "react";

import type { Poll } from "@/data/types";

/**
 * Weekly poll. Percentages stay hidden until the reader answers, so the
 * existing result cannot bias the vote.
 *
 * Votes are local to the session — persistence arrives with the Engagement
 * context in Phase 6.
 */
export function PollCard({ poll }: { poll: Poll }) {
	const [votedFor, setVotedFor] = useState<string | null>(null);
	const hasVoted = votedFor !== null;

	return (
		<section className="rounded-card border border-hairline bg-surface p-4">
			<h2 className="mb-2 font-mono text-[9px] text-brand-red tracking-[0.14em]">
				ENQUETE DA SEMANA
			</h2>

			<p className="mb-3 text-pretty font-bold text-[17px] text-brand-navy leading-snug">
				{poll.question}
			</p>

			<div className="flex flex-col gap-1.5">
				{poll.options.map((option) => (
					<button
						key={option.id}
						type="button"
						onClick={() => setVotedFor(option.id)}
						aria-pressed={votedFor === option.id}
						className={cn(
							"flex min-h-11 items-center justify-between gap-3 rounded-control border px-3 font-semibold text-[13px] text-brand-navy transition-colors",
							votedFor === option.id
								? "border-brand-red bg-surface-alt"
								: "border-hairline-strong hover:border-brand-red",
						)}
					>
						<span>{option.label}</span>
						<span className="font-mono text-[11px] text-meta">
							{hasVoted ? `${option.percentage}%` : "—"}
						</span>
					</button>
				))}
			</div>

			<p aria-live="polite" className="mt-2.5 font-mono text-[9.5px] text-meta">
				{hasVoted
					? `Obrigado pelo voto · ${poll.totalVotes + 1} votos`
					: `${poll.totalVotes} votos · resultado parcial`}
			</p>
		</section>
	);
}
