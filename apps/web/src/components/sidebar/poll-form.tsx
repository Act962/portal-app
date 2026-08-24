"use client";

import { cn } from "@portal-app/ui/lib/utils";
import { useState, useTransition } from "react";

import { submitVote } from "@/app/(site)/poll-actions";

type Option = { id: string; label: string; percentage: number | null };

/**
 * O único pedaço CLIENTE da enquete — e ele existe só para ter `onClick`.
 *
 * Nada de react-query aqui: o grupo `(site)` não tem `QueryClientProvider`
 * (regra do CLAUDE.md). O voto vai por Server Action, e o resultado volta
 * porque a action revalida a home — quem calcula porcentagem continua sendo o
 * servidor.
 */
export function PollForm({
	pollId,
	options,
	votedFor,
}: {
	pollId: string;
	options: Option[];
	votedFor: string | null;
}) {
	const [pending, startTransition] = useTransition();
	const [error, setError] = useState<string | null>(null);
	// Marca a opção clicada enquanto o servidor responde, para o botão não
	// ficar "morto" entre o clique e a revalidação.
	const [optimistic, setOptimistic] = useState<string | null>(null);

	const chosen = votedFor ?? optimistic;
	const hasVoted = votedFor !== null;

	const onVote = (optionId: string) => {
		if (hasVoted || pending) {
			return;
		}
		setOptimistic(optionId);
		setError(null);
		startTransition(async () => {
			const result = await submitVote(pollId, optionId);
			if (!result.ok) {
				setOptimistic(null);
				setError(result.message ?? "Não foi possível registrar seu voto.");
			}
		});
	};

	return (
		<>
			<div className="flex flex-col gap-1.5">
				{options.map((option) => (
					<button
						key={option.id}
						type="button"
						onClick={() => onVote(option.id)}
						disabled={hasVoted || pending}
						aria-pressed={chosen === option.id}
						className={cn(
							"flex min-h-11 items-center justify-between gap-3 rounded-control border px-3 font-semibold text-[13px] text-brand-ink transition-colors",
							chosen === option.id
								? "border-brand-accent-ink bg-surface-alt"
								: "border-hairline-strong",
							!hasVoted && !pending && "hover:border-brand-accent-ink",
							pending && "opacity-70",
						)}
					>
						<span>{option.label}</span>
						<span className="font-mono text-[11px] text-meta">
							{/* `percentage` só vem do servidor depois do voto; até lá é
							    null e o traço é a verdade que o leitor pode ver. */}
							{option.percentage !== null ? `${option.percentage}%` : "—"}
						</span>
					</button>
				))}
			</div>

			{error ? (
				<p role="alert" className="mt-2 text-[11px] text-brand-accent-ink">
					{error}
				</p>
			) : null}
		</>
	);
}
