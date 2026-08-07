"use client";

import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@portal-app/ui/components/alert-dialog";
import { Badge } from "@portal-app/ui/components/badge";
import { Button } from "@portal-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@portal-app/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { BarChart3, Plus, Trash2, X } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

const STATUS_LABEL: Record<string, string> = {
	RASCUNHO: "Rascunho",
	PUBLICADA: "No ar",
	FECHADA: "Encerrada",
};

export function PollsManager() {
	const queryClient = useQueryClient();
	const polls = useQuery(trpc.polls.list.queryOptions());

	const [creating, setCreating] = useState(false);
	const [question, setQuestion] = useState("");
	const [options, setOptions] = useState<string[]>(["", ""]);
	const [confirming, setConfirming] = useState<string | null>(null);
	const [showingResult, setShowingResult] = useState<string | null>(null);

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: trpc.polls.list.queryKey() });
	const onError = (error: { message: string }) => toast.error(error.message);

	const create = useMutation(
		trpc.polls.create.mutationOptions({
			onSuccess: () => {
				invalidate();
				setCreating(false);
				setQuestion("");
				setOptions(["", ""]);
			},
			onError,
		}),
	);
	const publish = useMutation(
		trpc.polls.publish.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Enquete no ar. A anterior foi encerrada.");
			},
			onError,
		}),
	);
	const close = useMutation(
		trpc.polls.close.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Enquete encerrada.");
			},
			onError,
		}),
	);
	const remove = useMutation(
		trpc.polls.delete.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Enquete excluída.");
			},
			onError,
		}),
	);

	const list = polls.data ?? [];
	const target = list.find((poll) => poll.id === confirming);

	const canSubmit =
		question.trim() !== "" &&
		options.filter((option) => option.trim() !== "").length >= 2;

	return (
		<div className="flex flex-col gap-4">
			<Dialog open={creating} onOpenChange={setCreating}>
				<div className="flex justify-end">
					<DialogTrigger render={<Button type="button" />}>
						<Plus className="size-4" />
						Nova enquete
					</DialogTrigger>
				</div>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Nova enquete</DialogTitle>
						<DialogDescription>
							Ela nasce como rascunho. As opções não mudam depois de publicada —
							os votos já registrados perderiam o sentido.
						</DialogDescription>
					</DialogHeader>
					<PollForm
						question={question}
						options={options}
						onQuestionChange={setQuestion}
						onOptionsChange={setOptions}
						onSubmit={(event) => {
							event.preventDefault();
							create.mutate({
								question: question.trim(),
								options: options
									.map((option) => option.trim())
									.filter((option) => option !== ""),
							});
						}}
					>
						<Button type="submit" disabled={!canSubmit || create.isPending}>
							Criar rascunho
						</Button>
					</PollForm>
				</DialogContent>
			</Dialog>

			{polls.isLoading ? (
				<Skeleton className="h-32 w-full" />
			) : list.length === 0 ? (
				<Card>
					<CardContent className="py-12 text-center">
						<p className="font-medium">Nenhuma enquete ainda.</p>
						<p className="mt-1 text-muted-foreground text-sm">
							O bloco de enquete só aparece no portal quando houver uma no ar.
						</p>
					</CardContent>
				</Card>
			) : (
				<div className="flex flex-col gap-3">
					{list.map((poll) => (
						<Card key={poll.id}>
							<CardHeader>
								<div className="flex items-start justify-between gap-3">
									<div className="min-w-0">
										<CardTitle className="text-base">{poll.question}</CardTitle>
										<CardDescription>
											{poll.options.map((option) => option.label).join(" · ")}
										</CardDescription>
									</div>
									<Badge
										variant="secondary"
										className={
											poll.status === "PUBLICADA"
												? "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
												: undefined
										}
									>
										{STATUS_LABEL[poll.status] ?? poll.status}
									</Badge>
								</div>
							</CardHeader>
							<CardContent className="flex flex-wrap gap-2">
								{poll.status === "RASCUNHO" ? (
									<Button
										size="sm"
										disabled={publish.isPending}
										onClick={() => publish.mutate({ id: poll.id })}
									>
										Publicar
									</Button>
								) : null}
								{poll.status === "PUBLICADA" ? (
									<Button
										size="sm"
										variant="outline"
										disabled={close.isPending}
										onClick={() => close.mutate({ id: poll.id })}
									>
										Encerrar
									</Button>
								) : null}
								{poll.status !== "RASCUNHO" ? (
									<Button
										size="sm"
										variant="outline"
										onClick={() =>
											setShowingResult(
												showingResult === poll.id ? null : poll.id,
											)
										}
									>
										<BarChart3 className="size-4" />
										{showingResult === poll.id ? "Ocultar" : "Ver resultado"}
									</Button>
								) : null}
								<Button
									size="sm"
									variant="ghost"
									aria-label={`Excluir ${poll.question}`}
									onClick={() => setConfirming(poll.id)}
								>
									<Trash2 className="size-4 text-destructive" />
								</Button>
							</CardContent>
							{showingResult === poll.id ? <PollResult id={poll.id} /> : null}
						</Card>
					))}
				</div>
			)}

			<AlertDialog
				open={confirming !== null}
				onOpenChange={(open) => !open && setConfirming(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir esta enquete?</AlertDialogTitle>
						<AlertDialogDescription>
							“{target?.question}” e todos os votos dela somem. Não há como
							desfazer — para tirar do ar sem perder o resultado, encerre em vez
							de excluir.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (target) {
									remove.mutate({ id: target.id });
								}
								setConfirming(null);
							}}
						>
							Excluir
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

/** Resultado de uma enquete. O painel vê sempre — não precisa votar. */
function PollResult({ id }: { id: string }) {
	const result = useQuery(trpc.polls.result.queryOptions({ id }));

	if (result.isLoading) {
		return (
			<CardContent>
				<Skeleton className="h-16 w-full" />
			</CardContent>
		);
	}
	if (!result.data) {
		return null;
	}

	const { totalVotes, options } = result.data;

	return (
		<CardContent className="flex flex-col gap-3 border-t pt-4">
			{options.map((option) => {
				const percentage =
					totalVotes === 0 ? 0 : Math.round((option.votes / totalVotes) * 100);
				return (
					<div key={option.id} className="flex flex-col gap-1">
						<div className="flex items-baseline justify-between gap-3 text-sm">
							<span className="min-w-0 truncate">{option.label}</span>
							<span className="shrink-0 font-medium tabular-nums">
								{percentage}%{" "}
								<span className="font-normal text-muted-foreground">
									({option.votes})
								</span>
							</span>
						</div>
						<div className="h-2 w-full rounded-full bg-muted">
							<div
								className="h-2 rounded-full bg-chart-3"
								style={{ width: `${percentage}%` }}
							/>
						</div>
					</div>
				);
			})}
			<p className="text-muted-foreground text-xs">
				{totalVotes} {totalVotes === 1 ? "voto" : "votos"} no total.
			</p>
		</CardContent>
	);
}

function PollForm({
	question,
	options,
	onQuestionChange,
	onOptionsChange,
	onSubmit,
	children,
}: {
	question: string;
	options: string[];
	onQuestionChange: (value: string) => void;
	onOptionsChange: (value: string[]) => void;
	onSubmit: (event: React.FormEvent) => void;
	children: React.ReactNode;
}) {
	const questionId = useId();

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={questionId}>Pergunta</Label>
				<Input
					id={questionId}
					required
					value={question}
					onChange={(event) => onQuestionChange(event.target.value)}
					placeholder="Você aprova a nova faixa de ônibus?"
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label>Opções</Label>
				{options.map((option, index) => (
					<div
						// biome-ignore lint/suspicious/noArrayIndexKey: a opção é texto
						// livre e ainda não tem id — o índice é a identidade que existe.
						key={index}
						className="flex items-center gap-2"
					>
						<Input
							value={option}
							aria-label={`Opção ${index + 1}`}
							onChange={(event) => {
								const next = [...options];
								next[index] = event.target.value;
								onOptionsChange(next);
							}}
						/>
						{options.length > 2 ? (
							<Button
								type="button"
								variant="ghost"
								size="icon"
								aria-label={`Remover opção ${index + 1}`}
								onClick={() =>
									onOptionsChange(options.filter((_, i) => i !== index))
								}
							>
								<X className="size-4" />
							</Button>
						) : null}
					</div>
				))}
				<Button
					type="button"
					variant="outline"
					size="sm"
					className="self-start"
					onClick={() => onOptionsChange([...options, ""])}
				>
					<Plus className="size-4" />
					Adicionar opção
				</Button>
			</div>

			<DialogFooter>{children}</DialogFooter>
		</form>
	);
}
