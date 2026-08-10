"use client";

import type { Block, EditorialStatus } from "@portal-app/editorial";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@portal-app/ui/components/alert";
import { Badge } from "@portal-app/ui/components/badge";
import { Button } from "@portal-app/ui/components/button";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
} from "@portal-app/ui/components/card";
import {
	Dialog,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@portal-app/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@portal-app/ui/components/select";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@portal-app/ui/components/tabs";
import { Textarea } from "@portal-app/ui/components/textarea";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@portal-app/ui/components/tooltip";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, ImageIcon, Loader2, Tag } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { StatusBadge } from "@/components/admin/status-badge";
import { BlockRenderer } from "@/components/editorial/block-renderer";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { trpc } from "@/utils/trpc";

// O TipTap não pode renderizar no servidor (hidratação divergente).
const ArticleBodyEditor = dynamic(
	() =>
		import("@/components/editorial/rich-text/article-body-editor").then(
			(m) => m.ArticleBodyEditor,
		),
	{
		ssr: false,
		loading: () => (
			<div className="min-h-[28rem] animate-pulse rounded-lg border bg-muted/30" />
		),
	},
);

const NO_SECTION = "__none__";

/** Faixas de tamanho que o Google usa como referência para título e descrição. */
function countHint(value: number, min: number, max: number) {
	if (value === 0) return "text-muted-foreground";
	return value >= min && value <= max
		? "text-emerald-600 dark:text-emerald-400"
		: "text-amber-600 dark:text-amber-400";
}

export function ArticleEditor({ id }: { id: string }) {
	const queryClient = useQueryClient();
	const article = useQuery(trpc.editorial.articles.get.queryOptions({ id }));
	const sections = useQuery(trpc.taxonomy.sections.list.queryOptions());
	const tags = useQuery(trpc.taxonomy.tags.list.queryOptions());
	const media = useQuery(trpc.media.library.queryOptions({}));

	const articleKey = trpc.editorial.articles.get.queryKey({ id });
	type ArticleDto = NonNullable<typeof article.data>;
	/** Depois de uma ação de workflow o servidor devolve o DTO novo — grava
	 * direto no cache em vez de refazer a query (o autosave dispara muito). */
	const applyResult = useCallback(
		(dto: ArticleDto) => queryClient.setQueryData(articleKey, dto),
		[queryClient, articleKey],
	);
	const onWorkflowError = (error: { message: string }) =>
		toast.error(error.message);

	const update = useMutation(trpc.editorial.articles.update.mutationOptions());
	const workflowOptions = {
		onSuccess: applyResult,
		onError: onWorkflowError,
	};
	const submit = useMutation(
		trpc.editorial.articles.submit.mutationOptions(workflowOptions),
	);
	const approve = useMutation(
		trpc.editorial.articles.approve.mutationOptions(workflowOptions),
	);
	const reject = useMutation(
		trpc.editorial.articles.reject.mutationOptions(workflowOptions),
	);
	const publish = useMutation(
		trpc.editorial.articles.publish.mutationOptions(workflowOptions),
	);
	const schedule = useMutation(
		trpc.editorial.articles.schedule.mutationOptions(workflowOptions),
	);
	const cancelSchedule = useMutation(
		trpc.editorial.articles.cancelSchedule.mutationOptions(workflowOptions),
	);
	const archive = useMutation(
		trpc.editorial.articles.archive.mutationOptions(workflowOptions),
	);

	const [headline, setHeadline] = useState("");
	const [kicker, setKicker] = useState("");
	const [standfirst, setStandfirst] = useState("");
	const [sectionId, setSectionId] = useState("");
	const [tagIds, setTagIds] = useState<string[]>([]);
	const [coverId, setCoverId] = useState("");
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [reason, setReason] = useState("");
	const [rejecting, setRejecting] = useState(false);
	const [at, setAt] = useState("");
	const [savedAt, setSavedAt] = useState<string | null>(null);
	const [saveError, setSaveError] = useState(false);
	const [pickingCover, setPickingCover] = useState(false);

	const loaded = useRef(false);
	const status = article.data?.status as EditorialStatus | undefined;

	useEffect(() => {
		if (article.data && !loaded.current) {
			loaded.current = true;
			setHeadline(article.data.headline);
			setKicker(article.data.kicker);
			setStandfirst(article.data.standfirst);
			setSectionId(article.data.sectionId ?? "");
			setTagIds([...article.data.tagIds]);
			setCoverId(article.data.cover?.mediaId ?? "");
			setBlocks([...article.data.body] as Block[]);
		}
	}, [article.data]);

	const mediaById = new Map((media.data ?? []).map((a) => [a.id, a]));
	const imageUrls: Record<string, string> = {};
	const mediaInfo: Record<string, { url: string; altText: string }> = {};
	for (const asset of media.data ?? []) {
		imageUrls[asset.id] = asset.url;
		mediaInfo[asset.id] = { url: asset.url, altText: asset.altText ?? "" };
	}

	// Autosave por debounce. Escreve o resultado no cache em vez de invalidar:
	// com o editor emitindo mudança a cada tecla, refazer a query inteira a cada
	// pausa custaria caro e faria a tela piscar.
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: dispara só no conteúdo
	useEffect(() => {
		if (!loaded.current) {
			return;
		}
		if (timer.current) {
			clearTimeout(timer.current);
		}
		timer.current = setTimeout(() => {
			update.mutate(
				{
					id,
					headline,
					kicker,
					standfirst,
					sectionId: sectionId || null,
					tagIds,
					cover: coverId
						? {
								mediaId: coverId,
								altText: mediaById.get(coverId)?.altText ?? "",
							}
						: null,
					body: blocks,
				},
				{
					onSuccess: (dto) => {
						setSaveError(false);
						setSavedAt(
							new Date().toLocaleTimeString("pt-BR", {
								hour: "2-digit",
								minute: "2-digit",
							}),
						);
						applyResult(dto);
					},
					onError: () => setSaveError(true),
				},
			);
		}, 1000);
		return () => {
			if (timer.current) {
				clearTimeout(timer.current);
			}
		};
	}, [headline, kicker, standfirst, sectionId, tagIds, coverId, blocks, id]);

	if (article.isLoading) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-10 w-2/3" />
				<Skeleton className="h-[28rem] w-full" />
			</div>
		);
	}
	if (!article.data) {
		return <p className="text-muted-foreground">Matéria não encontrada.</p>;
	}

	const pendencias = article.data.pendencias;
	const canPublish = pendencias.length === 0;
	const cover = coverId ? mediaById.get(coverId) : undefined;

	const publishButton = (
		<Button
			className="w-full bg-brand-red text-white hover:bg-brand-red-hover"
			disabled={!canPublish || publish.isPending}
			onClick={() => publish.mutate({ id })}
		>
			{publish.isPending ? "Publicando…" : "Publicar agora"}
		</Button>
	);

	return (
		<>
			<PageHeader
				title={headline || "Sem título"}
				description={
					article.data.slug ? `/${article.data.slug}` : "Rascunho sem endereço"
				}
				actions={
					<div className="flex items-center gap-3">
						<span className="text-muted-foreground text-xs">
							{update.isPending ? (
								<span className="flex items-center gap-1">
									<Loader2 className="size-3 animate-spin" />
									salvando…
								</span>
							) : saveError ? (
								<span className="text-destructive">erro ao salvar</span>
							) : savedAt ? (
								<span className="flex items-center gap-1">
									<Check className="size-3" />
									salvo às {savedAt}
								</span>
							) : null}
						</span>
						<StatusBadge status={status ?? "RASCUNHO"} />
					</div>
				}
			/>

			<div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
				{/* ---------------- Coluna do texto ---------------- */}
				<div className="min-w-0">
					<Tabs defaultValue="editar">
						<TabsList className="mb-4">
							<TabsTrigger value="editar">Editar</TabsTrigger>
							<TabsTrigger value="preview">Pré-visualizar</TabsTrigger>
						</TabsList>

						<TabsContent value="editar" className="flex flex-col gap-3">
							<Input
								value={kicker}
								onChange={(e) => setKicker(e.target.value)}
								placeholder="CHAPÉU"
								className="max-w-xs font-semibold text-xs uppercase tracking-wide"
							/>

							<div>
								<Textarea
									value={headline}
									onChange={(e) => setHeadline(e.target.value)}
									placeholder="Título da matéria"
									rows={2}
									className="resize-none font-bold text-2xl leading-tight"
								/>
								<p
									className={`mt-1 text-xs ${countHint(headline.length, 40, 70)}`}
								>
									{headline.length} caracteres — o ideal para busca fica entre
									40 e 70
								</p>
							</div>

							<div>
								<Textarea
									value={standfirst}
									onChange={(e) => setStandfirst(e.target.value)}
									placeholder="Linha fina: uma frase que resume a matéria"
									rows={2}
									className="resize-none"
								/>
								<p
									className={`mt-1 text-xs ${countHint(standfirst.length, 120, 160)}`}
								>
									{standfirst.length} caracteres — entre 120 e 160 aparece
									inteira no Google
								</p>
							</div>

							<ArticleBodyEditor
								articleId={id}
								initialBlocks={article.data.body as Block[]}
								media={mediaInfo}
								onChange={setBlocks}
							/>
						</TabsContent>

						<TabsContent value="preview">
							<article className="rounded-lg border p-6">
								{kicker ? (
									<p className="font-bold text-brand-red text-sm uppercase">
										{kicker}
									</p>
								) : null}
								<h1 className="font-bold text-3xl leading-tight">{headline}</h1>
								{standfirst ? (
									<p className="mt-2 text-lg text-muted-foreground">
										{standfirst}
									</p>
								) : null}
								<BlockRenderer blocks={blocks} imageUrls={imageUrls} />
							</article>
						</TabsContent>
					</Tabs>
				</div>

				{/* ---------------- Coluna da publicação ---------------- */}
				<aside className="flex flex-col gap-4 lg:sticky lg:top-20 lg:self-start">
					<Card>
						<CardHeader>
							<CardTitle className="text-base">Publicação</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							{pendencias.length > 0 ? (
								<Alert variant="destructive">
									<AlertTriangle className="size-4" />
									<AlertTitle>Falta para publicar</AlertTitle>
									<AlertDescription>
										<ul className="list-disc pl-4">
											{pendencias.map((p) => (
												<li key={p}>{p}</li>
											))}
										</ul>
									</AlertDescription>
								</Alert>
							) : null}

							{status === "RASCUNHO" ? (
								<Button
									className="w-full"
									disabled={submit.isPending}
									onClick={() => submit.mutate({ id })}
								>
									Enviar para revisão
								</Button>
							) : null}

							{status === "EM_REVISAO" ? (
								<>
									<Button
										className="w-full"
										disabled={approve.isPending}
										onClick={() => approve.mutate({ id })}
									>
										Aprovar
									</Button>
									<Button
										variant="outline"
										className="w-full"
										onClick={() => setRejecting(true)}
									>
										Devolver ao redator
									</Button>
								</>
							) : null}

							{status === "APROVADA" ? (
								<>
									{canPublish ? (
										publishButton
									) : (
										<Tooltip>
											<TooltipTrigger render={<span className="block" />}>
												{publishButton}
											</TooltipTrigger>
											<TooltipContent>
												Resolva as pendências acima primeiro
											</TooltipContent>
										</Tooltip>
									)}

									<div className="rounded-md border p-3">
										<Label htmlFor="agendar" className="text-xs">
											Ou agende (horário de Brasília)
										</Label>
										<Input
											id="agendar"
											type="datetime-local"
											value={at}
											onChange={(e) => setAt(e.target.value)}
											className="mt-1.5"
										/>
										<Button
											variant="outline"
											size="sm"
											className="mt-2 w-full"
											disabled={!at || !canPublish}
											onClick={() => schedule.mutate({ id, at: new Date(at) })}
										>
											Agendar publicação
										</Button>
									</div>
								</>
							) : null}

							{status === "AGENDADA" ? (
								<>
									<p className="text-muted-foreground text-sm">
										Agendada para{" "}
										<strong>
											{article.data.scheduledAt
												? new Date(article.data.scheduledAt).toLocaleString(
														"pt-BR",
													)
												: "—"}
										</strong>
									</p>
									{publishButton}
									<Button
										variant="outline"
										className="w-full"
										onClick={() => cancelSchedule.mutate({ id })}
									>
										Cancelar agendamento
									</Button>
								</>
							) : null}

							{status === "PUBLICADA" || status === "ATUALIZADA" ? (
								<Button
									variant="outline"
									className="w-full"
									onClick={() => archive.mutate({ id })}
								>
									Arquivar
								</Button>
							) : null}

							{article.data.rejectionReason ? (
								<Alert>
									<AlertTitle>Devolvida</AlertTitle>
									<AlertDescription>
										{article.data.rejectionReason}
									</AlertDescription>
								</Alert>
							) : null}
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Organização</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							<div>
								<Label className="text-xs">Editoria</Label>
								<Select
									items={[
										{ value: NO_SECTION, label: "— sem editoria —" },
										...(sections.data ?? []).map((section) => ({
											value: section.id,
											label: section.name,
										})),
									]}
									value={sectionId || NO_SECTION}
									onValueChange={(value) =>
										setSectionId(value === NO_SECTION ? "" : (value ?? ""))
									}
								>
									<SelectTrigger className="mt-1.5 w-full">
										<SelectValue placeholder="Escolha a editoria" />
									</SelectTrigger>
									<SelectContent>
										<SelectItem value={NO_SECTION}>— sem editoria —</SelectItem>
										{(sections.data ?? []).map((section) => (
											<SelectItem key={section.id} value={section.id}>
												{section.name}
											</SelectItem>
										))}
									</SelectContent>
								</Select>
							</div>

							<div>
								<Label className="text-xs">Assuntos</Label>
								<Popover>
									<PopoverTrigger
										render={
											<Button
												variant="outline"
												className="mt-1.5 w-full justify-start font-normal"
											/>
										}
									>
										<Tag className="size-4" />
										{tagIds.length === 0
											? "Nenhum assunto"
											: `${tagIds.length} assunto(s)`}
									</PopoverTrigger>
									<PopoverContent className="w-64 p-2">
										<div className="max-h-64 overflow-y-auto">
											{(tags.data ?? []).length === 0 ? (
												<p className="p-2 text-muted-foreground text-sm">
													Nenhuma tag cadastrada ainda.
												</p>
											) : (
												(tags.data ?? []).map((tag) => {
													const checked = tagIds.includes(tag.id);
													return (
														<button
															key={tag.id}
															type="button"
															onClick={() =>
																setTagIds((current) =>
																	checked
																		? current.filter((t) => t !== tag.id)
																		: [...current, tag.id],
																)
															}
															className="flex w-full items-center justify-between rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
														>
															{tag.name}
															{checked ? <Check className="size-4" /> : null}
														</button>
													);
												})
											)}
										</div>
									</PopoverContent>
								</Popover>

								{tagIds.length > 0 ? (
									<div className="mt-2 flex flex-wrap gap-1">
										{tagIds.map((tagId) => (
											<Badge key={tagId} variant="secondary">
												{tags.data?.find((t) => t.id === tagId)?.name ?? tagId}
											</Badge>
										))}
									</div>
								) : null}
							</div>
						</CardContent>
					</Card>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Imagem de capa</CardTitle>
						</CardHeader>
						<CardContent className="flex flex-col gap-3">
							{cover ? (
								<img
									src={cover.url}
									alt={cover.altText ?? ""}
									style={{
										objectPosition: `${(cover.focalPoint?.x ?? 0.5) * 100}% ${(cover.focalPoint?.y ?? 0.5) * 100}%`,
									}}
									className="aspect-video w-full rounded-md border object-cover"
								/>
							) : (
								<div className="flex aspect-video w-full items-center justify-center rounded-md border border-dashed text-muted-foreground">
									<ImageIcon className="size-6" />
								</div>
							)}
							<Button
								variant="outline"
								size="sm"
								onClick={() => setPickingCover(true)}
							>
								{cover ? "Trocar capa" : "Escolher capa"}
							</Button>
							{cover && !cover.altText ? (
								<p className="text-amber-600 text-xs dark:text-amber-400">
									Esta imagem está sem texto alternativo — corrija na Biblioteca
									de mídia.
								</p>
							) : null}
						</CardContent>
					</Card>

					<p className="text-muted-foreground text-xs">
						Assinada por {article.data.byline.name}
					</p>
				</aside>
			</div>

			<MediaPickerDialog
				open={pickingCover}
				onOpenChange={setPickingCover}
				onSelect={(mediaId) => {
					setCoverId(mediaId);
					setPickingCover(false);
				}}
				title="Escolher imagem de capa"
			/>

			<Dialog open={rejecting} onOpenChange={setRejecting}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Devolver ao redator</DialogTitle>
					</DialogHeader>
					<div className="py-2">
						<Label htmlFor="motivo">O que precisa ser ajustado?</Label>
						<Textarea
							id="motivo"
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							rows={4}
							className="mt-1.5"
							placeholder="Ex.: falta ouvir a prefeitura sobre o prazo das obras."
						/>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setRejecting(false)}>
							Cancelar
						</Button>
						<Button
							disabled={!reason.trim()}
							onClick={() => {
								reject.mutate({ id, reason: reason.trim() });
								setRejecting(false);
								setReason("");
							}}
						>
							Devolver
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
