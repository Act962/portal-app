"use client";

import {
	type ArtContent,
	DESTINATION_LABEL,
	type SocialDestination,
} from "@portal-app/social";
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
import {
	AlertTriangle,
	ExternalLink,
	RotateCw,
	Share2,
	Trash2,
	Video,
	X,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { templatesFor } from "@/app/(app)/dashboard/social/post-art-model";
import {
	availableActions,
	canRetry,
	POST_STATUS_LABELS,
} from "@/app/(app)/dashboard/social/social-labels";
import { ArtCanvas } from "@/components/art/art-canvas";
import { trpc } from "@/utils/trpc";

import {
	ARTICLE_SOCIAL_DESTINATIONS,
	articleSocialState,
	contentInput,
	type InputsByDestination,
	initialDestinations,
	initialInputs,
	initialPicks,
	inputsInput,
	selectionForPick,
	type TemplatePicks,
	templatesInput,
} from "./article-social-model";
import { ArticleSocialPreviewDialog } from "./article-social-preview-dialog";

const NO_TEMPLATE = "__sem-padrao__";

/**
 * "Redes sociais" no editor da matéria (spec 09, F6): preparar a publicação
 * DESTA matéria — feed e/ou Stories, o padrão de cada um — sem sair dela, como
 * rascunho na fila ou já aprovada.
 *
 * O post é um só por matéria: se o gatilho já criou o rascunho, o cartão
 * mostra e ajusta ESSE. A arte é desenhada com a capa da matéria. "Visualizar e
 * editar" abre a prévia grande, onde a redação ajusta os textos da publicação.
 */
export function ArticleSocialCard({ articleId }: { articleId: string }) {
	const queryClient = useQueryClient();
	const info = useQuery(trpc.social.articlePost.queryOptions({ articleId }));
	const templates = useQuery(trpc.social.templates.list.queryOptions());

	const [destinations, setDestinations] = useState<SocialDestination[]>([]);
	const [picks, setPicks] = useState<TemplatePicks>({});
	const [inputs, setInputs] = useState<InputsByDestination>({});
	const [content, setContent] = useState<ArtContent | null>(null);
	const [caption, setCaption] = useState("");
	const [previewing, setPreviewing] = useState(false);
	const [deletionIntent, setDeletionIntent] = useState<
		"delete" | "republish" | null
	>(null);
	/** Em que destino o diálogo abre — o do cartão clicado, ou o primeiro. */
	const [focused, setFocused] = useState<SocialDestination | null>(null);
	const openPreview = (destination: SocialDestination | null) => {
		setFocused(destination);
		setPreviewing(true);
	};
	/** A pessoa já mexeu nos textos? Aí a matéria salva não os sobrescreve. */
	const textsTouched = useRef(false);

	// Marca destinos, padrões e campos quando os dados chegam — e de novo só se o
	// post da matéria mudar (criado agora, por exemplo), para não apagar a
	// escolha de quem está mexendo a cada atualização em segundo plano.
	const postKey = info.data ? (info.data.post?.id ?? "sem-post") : null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
	useEffect(() => {
		if (!info.data) {
			return;
		}
		setDestinations(initialDestinations(info.data.post));
		setPicks(initialPicks(info.data.post, info.data.defaults));
		setInputs(initialInputs(info.data.post));
		textsTouched.current = false;
	}, [postKey]);

	// Os textos seguem a matéria (título, capa…) enquanto ninguém os editou aqui.
	const textsKey = info.data
		? `${postKey}|${JSON.stringify(info.data.post?.artContentForDrawing ?? info.data.content)}|${info.data.caption}`
		: null;
	// biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
	useEffect(() => {
		if (!info.data || textsTouched.current) {
			return;
		}
		setContent(info.data.post?.artContentForDrawing ?? info.data.content);
		setCaption(info.data.caption);
	}, [textsKey]);

	const prepare = useMutation(
		trpc.social.prepareFromArticle.mutationOptions({
			onSuccess: async (_post, variables) => {
				toast.success(
					variables.approve
						? "Aprovado — a publicação entrou na fila de envio."
						: "Publicação salva como rascunho na fila de Redes sociais.",
				);
				setPreviewing(false);
				textsTouched.current = false;
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
	const refreshPost = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: trpc.social.articlePost.queryKey({ articleId }),
			}),
			queryClient.invalidateQueries({ queryKey: trpc.social.queue.queryKey() }),
		]);
	};
	const retry = useMutation(
		trpc.social.retry.mutationOptions({
			onSuccess: async () => {
				toast.success("Nova tentativa enviada para a fila.");
				await refreshPost();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remake = useMutation(
		trpc.social.remake.mutationOptions({
			onSuccess: async () => {
				toast.success("Postagem reaberta para edição.");
				await refreshPost();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const remove = useMutation(
		trpc.social.remove.mutationOptions({
			onSuccess: async () => {
				const republishing = deletionIntent === "republish";
				setDeletionIntent(null);
				toast.success(
					republishing
						? "Configure os destinos e aprove a nova publicação."
						: "Publicação apagada do portal.",
				);
				await refreshPost();
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

	const { published, coverMediaId, post, defaults } = info.data;
	const drawn = content ?? info.data.content;
	const state = articleSocialState(published, post);
	const busy =
		prepare.isPending ||
		retry.isPending ||
		remake.isPending ||
		remove.isPending;
	const templateList = templates.data ?? [];

	const submit = (approve: boolean) =>
		prepare.mutate({
			articleId,
			destinations,
			templates: templatesInput(destinations, picks),
			approve,
			captionText: caption.trim() === "" ? undefined : caption,
			artContent: contentInput(drawn),
			inputs: inputsInput(destinations, picks, inputs),
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

				{post?.deliveries
					.filter((delivery) => delivery.error)
					.map((delivery) => (
						<p
							key={delivery.destination}
							className="flex gap-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-destructive text-xs"
						>
							<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
							<span>
								{DESTINATION_LABEL[delivery.destination]}: {delivery.error}
							</span>
						</p>
					))}

				{post && canRetry(post.status, post.deliveries) ? (
					<Button
						variant="outline"
						disabled={busy}
						onClick={() => retry.mutate({ id: post.id })}
					>
						<RotateCw className="size-4" />
						Tentar novamente
					</Button>
				) : null}

				{post && (post.status === "FALHOU" || post.status === "CANCELADA") ? (
					<Button
						variant="secondary"
						disabled={busy}
						onClick={() => remake.mutate({ id: post.id })}
					>
						<RotateCw className="size-4" />
						Refazer postagem
					</Button>
				) : null}

				{post && availableActions(post.status).includes("apagar") ? (
					<div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-2">
						<Button
							variant="outline"
							className="min-w-0"
							disabled={busy}
							onClick={() => setDeletionIntent("delete")}
						>
							<Trash2 className="size-4" />
							Apagar
						</Button>
						<Button
							variant="secondary"
							className="min-w-0"
							disabled={busy}
							onClick={() => setDeletionIntent("republish")}
						>
							<RotateCw className="size-4" />
							Publicar novamente
						</Button>
					</div>
				) : null}

				<div className="flex flex-wrap gap-1.5">
					{ARTICLE_SOCIAL_DESTINATIONS.map((destination) => {
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
					const choices = templatesFor(destination, templateList);
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
					const selection = picked
						? selectionForPick(picked, inputs[destination])
						: null;
					const label = DESTINATION_LABEL[destination];
					return (
						// O cartão inteiro abre a prévia nesse destino; o teclado chega
						// pela miniatura, que é um botão de verdade. O seletor e o "x"
						// param o clique para não abrir o diálogo junto.
						// biome-ignore lint/a11y/noStaticElementInteractions: atalho do mouse, ver acima
						// biome-ignore lint/a11y/useKeyWithClickEvents: o teclado usa a miniatura
						<div
							key={destination}
							onClick={() => openPreview(destination)}
							className="relative flex cursor-pointer items-start gap-2 rounded-md border p-2 transition-colors hover:bg-accent/40"
						>
							{state.editable ? (
								<button
									type="button"
									aria-label={`Tirar ${label} desta publicação`}
									title={`Tirar ${label}`}
									disabled={busy}
									onClick={(event) => {
										event.stopPropagation();
										setDestinations(
											destinations.filter((item) => item !== destination),
										);
									}}
									className="absolute top-1 right-1 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-50"
								>
									<X className="size-3.5" />
								</button>
							) : null}
							<button
								type="button"
								className="w-16 shrink-0 cursor-zoom-in"
								aria-label={`Visualizar ${label}`}
								onClick={(event) => {
									event.stopPropagation();
									openPreview(destination);
								}}
							>
								{selection ? (
									<ArtCanvas
										format={selection.format}
										design={selection.design}
										content={drawn}
										inputs={{
											values: selection.values,
											texts: selection.texts,
										}}
										photoMediaId={coverMediaId}
										label={`Prévia de ${selection.templateName}`}
										className="rounded"
									/>
								) : (
									<div className="flex aspect-[4/5] w-full items-center justify-center rounded border border-dashed text-[10px] text-muted-foreground">
										foto
									</div>
								)}
							</button>
							<div className="flex min-w-0 flex-1 flex-col gap-1">
								<span className="pr-6 font-medium text-xs">{label}</span>
								{/* biome-ignore lint/a11y/noStaticElementInteractions: só impede que o clique no seletor abra a prévia */}
								{/* biome-ignore lint/a11y/useKeyWithClickEvents: idem */}
								<div onClick={(event) => event.stopPropagation()}>
									<Select
										items={options}
										value={pickedId ?? NO_TEMPLATE}
										disabled={!state.editable || busy}
										onValueChange={(value) => {
											if (!value) {
												return;
											}
											const next = value === NO_TEMPLATE ? null : value;
											setPicks({ ...picks, [destination]: next });
											// Outro padrão, outros campos: os preenchidos eram do anterior.
											if (next !== pickedId) {
												setInputs({ ...inputs, [destination]: undefined });
											}
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
						</div>
					);
				})}

				{/*
				  O caminho do VÍDEO (spec 12, F5). Fica aqui, e não como mais uma
				  caixinha de destino, porque a matéria tem foto de CAPA, não vídeo:
				  o arquivo é escolhido no editor, não herdado da matéria.

				  Com post já criado, o botão só ABRE o editor daquele post. Não
				  acrescenta o Reels aos destinos: a matéria aceita um post só
				  (`autoKey`), e mexer nos destinos de um post de foto por este
				  atalho transformaria calado uma publicação pronta numa quebrada.

				  Tomou o lugar do botão "Visualizar e editar textos". A prévia não
				  ficou órfã: ela continua abrindo ao clicar na arte de cada destino,
				  logo acima — que é de onde quase todo mundo já a abria.
				*/}
				<VideoShortcut
					articleId={articleId}
					postId={post?.id ?? null}
					clipCount={post?.clips.length ?? 0}
					disabled={busy}
				/>

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

			<ArticleSocialPreviewDialog
				open={previewing}
				onOpenChange={setPreviewing}
				active={focused}
				onActiveChange={setFocused}
				destinations={destinations}
				picks={picks}
				templates={templateList}
				inputs={inputs}
				onInputsChange={(next) => {
					textsTouched.current = true;
					setInputs(next);
				}}
				content={drawn}
				articleContent={info.data.content}
				onContentChange={(next) => {
					textsTouched.current = true;
					setContent(next);
				}}
				caption={caption}
				onCaptionChange={(next) => {
					textsTouched.current = true;
					setCaption(next);
				}}
				coverMediaId={coverMediaId}
				editable={state.editable}
				busy={busy}
				canApprove={state.canApprove}
				hasPost={post !== null}
				onSubmit={submit}
			/>

			<AlertDialog
				open={deletionIntent !== null}
				onOpenChange={(open) => !open && setDeletionIntent(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{deletionIntent === "republish"
								? "Preparar uma nova publicação?"
								: "Apagar esta publicação?"}
						</AlertDialogTitle>
						<AlertDialogDescription>
							{deletionIntent === "republish"
								? "O registro atual será apagado e a configuração será reaberta para você escolher Instagram, Stories ou ambos."
								: "O histórico e a fila desta publicação serão apagados. A matéria no portal não será alterada."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							disabled={remove.isPending}
							onClick={() => post && remove.mutate({ id: post.id })}
						>
							{deletionIntent === "republish" ? "Continuar" : "Apagar"}
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</Card>
	);
}

/**
 * O atalho da matéria para o editor de vídeo (spec 12, F5).
 *
 * Duas situações, e a diferença entre elas é a trava de um post por matéria:
 *
 * - **Sem post ainda:** cria o post da matéria já mirando o Reels — legenda,
 *   título e editoria vêm da matéria, como no post de foto — e abre o editor.
 * - **Com post:** só ABRE o editor daquele post. Acrescentar o Reels aos
 *   destinos de um post de foto o deixaria com um destino que recusa vídeo e
 *   outro que o exige; quem quiser trocar os destinos faz isso na fila, vendo o
 *   que está mudando.
 */
function VideoShortcut({
	articleId,
	postId,
	clipCount,
	disabled,
}: {
	articleId: string;
	postId: string | null;
	clipCount: number;
	disabled: boolean;
}) {
	const router = useRouter();
	const prepare = useMutation(
		trpc.social.prepareFromArticle.mutationOptions({
			onSuccess: (post) => {
				router.push(`/dashboard/social/videos/${post.id}` as Route);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (postId) {
		return (
			<Button
				variant="outline"
				nativeButton={false}
				render={<Link href={`/dashboard/social/videos/${postId}` as Route} />}
			>
				<Video className="size-4" />
				{clipCount > 0
					? `Editar vídeo (${clipCount} ${clipCount === 1 ? "trecho" : "trechos"})`
					: "Montar vídeo desta matéria"}
			</Button>
		);
	}

	return (
		<Button
			variant="outline"
			disabled={disabled || prepare.isPending}
			onClick={() =>
				prepare.mutate({
					articleId,
					destinations: ["INSTAGRAM_REELS"],
					approve: false,
				})
			}
		>
			<Video className="size-4" />
			Montar vídeo desta matéria
		</Button>
	);
}
