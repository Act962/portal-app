"use client";

import {
	DESTINATION_LABEL,
	SOCIAL_DESTINATIONS,
	type SocialDestination,
} from "@portal-app/social";
import { Button } from "@portal-app/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@portal-app/ui/components/card";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@portal-app/ui/components/select";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { cn } from "@portal-app/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ExternalLink, Share2 } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { templatesFor } from "@/app/(app)/dashboard/social/post-art-model";
import { POST_STATUS_LABELS } from "@/app/(app)/dashboard/social/social-labels";
import { ArtCanvas } from "@/components/art/art-canvas";
import { trpc } from "@/utils/trpc";

import {
	articleSocialState,
	initialDestinations,
	initialPicks,
	type TemplatePicks,
	templatesInput,
} from "./article-social-model";

const NO_TEMPLATE = "__sem-padrao__";

/**
 * "Redes sociais" no editor da matéria (spec 09, F6): preparar a publicação
 * DESTA matéria — feed e/ou Stories, o padrão de cada um — sem sair dela, como
 * rascunho na fila ou já aprovada.
 *
 * O post é um só por matéria: se o gatilho já criou o rascunho, o cartão
 * mostra e ajusta ESSE. A arte é desenhada com a capa da matéria; a prévia é a
 * real, do servidor.
 */
export function ArticleSocialCard({ articleId }: { articleId: string }) {
	const queryClient = useQueryClient();
	const info = useQuery(trpc.social.articlePost.queryOptions({ articleId }));
	const templates = useQuery(trpc.social.templates.list.queryOptions());

	const [destinations, setDestinations] = useState<SocialDestination[]>([]);
	const [picks, setPicks] = useState<TemplatePicks>({});

	// Marca destinos e padrões quando os dados chegam — e de novo só se o post
	// da matéria mudar (criado agora, por exemplo), para não apagar a escolha de
	// quem está mexendo a cada atualização em segundo plano.
	const postKey = info.data ? (info.data.post?.id ?? "sem-post") : null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
	useEffect(() => {
		if (!info.data) {
			return;
		}
		setDestinations(initialDestinations(info.data.post));
		setPicks(initialPicks(info.data.post, info.data.defaults));
	}, [postKey]);

	const prepare = useMutation(
		trpc.social.prepareFromArticle.mutationOptions({
			onSuccess: async (_post, variables) => {
				toast.success(
					variables.approve
						? "Aprovado — a publicação entrou na fila de envio."
						: "Publicação salva como rascunho na fila de Redes sociais.",
				);
				await Promise.all([
					queryClient.invalidateQueries({
						queryKey: trpc.social.articlePost.queryKey({ articleId }),
					}),
					queryClient.invalidateQueries({
						queryKey: trpc.social.queue.queryKey(),
					}),
				]);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (info.isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle className="text-base">Redes sociais</CardTitle>
				</CardHeader>
				<CardContent>
					<Skeleton className="h-24 w-full" />
				</CardContent>
			</Card>
		);
	}
	if (!info.data) {
		return null;
	}

	const { published, coverMediaId, content, post, defaults } = info.data;
	const state = articleSocialState(published, post);
	const busy = prepare.isPending;

	const submit = (approve: boolean) =>
		prepare.mutate({
			articleId,
			destinations,
			templates: templatesInput(destinations, picks),
			approve,
		});

	return (
		<Card>
			<CardHeader>
				<CardTitle className="flex items-center gap-2 text-base">
					<Share2 className="size-4" />
					Redes sociais
				</CardTitle>
			</CardHeader>
			<CardContent className="flex flex-col gap-3">
				{post ? (
					<div className="flex items-center justify-between gap-2 text-xs">
						<span className="text-muted-foreground">
							{POST_STATUS_LABELS[post.status]}
						</span>
						<Button
							variant="ghost"
							size="sm"
							nativeButton={false}
							render={<Link href={"/dashboard/social" as Route} />}
						>
							<ExternalLink className="size-3.5" />
							Ver na fila
						</Button>
					</div>
				) : null}

				<div className="flex flex-wrap gap-1.5">
					{SOCIAL_DESTINATIONS.map((destination) => {
						const checked = destinations.includes(destination);
						return (
							<button
								key={destination}
								type="button"
								aria-pressed={checked}
								disabled={!state.editable || busy}
								onClick={() =>
									setDestinations(
										checked
											? destinations.filter((item) => item !== destination)
											: [...destinations, destination],
									)
								}
								className={cn(
									"rounded-full border px-2.5 py-1 font-medium text-xs transition-colors",
									checked
										? "border-primary bg-primary text-primary-foreground"
										: "border-input bg-background text-muted-foreground hover:bg-accent",
									(!state.editable || busy) && "cursor-not-allowed opacity-60",
								)}
							>
								{DESTINATION_LABEL[destination]}
							</button>
						);
					})}
				</div>

				{destinations.map((destination) => {
					const choices = templatesFor(destination, templates.data ?? []);
					const pickedId = picks[destination] ?? null;
					const picked = choices.find((template) => template.id === pickedId);
					const options = [
						{ value: NO_TEMPLATE, label: "Sem padrão — fotos cortadas" },
						...choices.map((template) => ({
							value: template.id,
							label:
								defaults[destination]?.id === template.id
									? `${template.name} (padrão)`
									: template.name,
						})),
					];
					return (
						<div
							key={destination}
							className="flex items-start gap-2 rounded-md border p-2"
						>
							<div className="w-16 shrink-0">
								{picked ? (
									<ArtCanvas
										format={picked.format}
										design={picked.design}
										content={content}
										photoMediaId={coverMediaId}
										label={`Prévia de ${picked.name}`}
										className="rounded"
									/>
								) : (
									<div className="flex aspect-[4/5] w-full items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground">
										foto
									</div>
								)}
							</div>
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<span className="font-medium text-xs">
									{DESTINATION_LABEL[destination]}
								</span>
								<Select
									items={options}
									value={pickedId ?? NO_TEMPLATE}
									disabled={!state.editable || busy}
									onValueChange={(value) => {
										if (!value) {
											return;
										}
										setPicks({
											...picks,
											[destination]: value === NO_TEMPLATE ? null : value,
										});
									}}
								>
									<SelectTrigger className="h-8 w-full text-xs">
										<SelectValue />
									</SelectTrigger>
									<SelectContent>
										{options.map((option) => (
											<SelectItem key={option.value} value={option.value}>
												{option.label}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>
						</div>
					);
				})}

				{!coverMediaId && destinations.length > 0 ? (
					<p className="text-amber-700 text-xs dark:text-amber-300">
						A matéria não tem capa: a publicação vai precisar de uma imagem,
						escolhida na fila.
					</p>
				) : null}

				{state.editable ? (
					<div className="flex flex-col gap-2">
						<Button
							variant="outline"
							disabled={busy || destinations.length === 0}
							onClick={() => submit(false)}
						>
							{post ? "Atualizar rascunho" : "Salvar como rascunho"}
						</Button>
						<Button
							disabled={busy || destinations.length === 0 || !state.canApprove}
							onClick={() => submit(true)}
						>
							Aprovar e publicar nas redes
						</Button>
					</div>
				) : null}

				{state.hint ? (
					<p className="text-muted-foreground text-xs">{state.hint}</p>
				) : null}
			</CardContent>
		</Card>
	);
}
