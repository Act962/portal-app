"use client";

import {
	DESTINATION_LABEL,
	MAX_MEDIA_ITEMS,
	SOCIAL_DESTINATIONS,
	SOCIAL_PLATFORMS,
	type SocialDestination,
} from "@portal-app/social";
import { Button } from "@portal-app/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { Textarea } from "@portal-app/ui/components/textarea";
import { cn } from "@portal-app/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowLeft,
	ArrowRight,
	ImagePlus,
	Trash2,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { AssetImage } from "@/components/media/asset-image";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { trpc } from "@/utils/trpc";
import { PostArtSection } from "./post-art-section";
import { captionCounters, storyNotice } from "./social-labels";

type Form = {
	captionText: string;
	mediaIds: string[];
	platforms: SocialDestination[];
	linkUrl: string;
};

const EMPTY: Form = {
	captionText: "",
	mediaIds: [],
	// O feed das duas redes. Stories é escolha explícita: some em 24 h e não
	// leva legenda, então não é o padrão de uma notícia.
	platforms: [...SOCIAL_PLATFORMS],
	linkUrl: "",
};

/**
 * O editor do post — a tela onde a aprovação de fato acontece.
 *
 * A decisão de desenho que sustenta tudo: **os impedimentos ficam ACIMA do
 * botão, não depois do clique**. Os limites da Meta são conhecidos (2200
 * caracteres, 30 hashtags, 10 imagens) e o servidor já os devolve resolvidos em
 * `blockers`; mostrá-los só no erro significaria a redação escrever a legenda
 * inteira para perdê-la no envio.
 *
 * O botão principal é **"Aprovar e publicar"**, não "Salvar". Salvar rascunho é
 * o caminho raro (voltar depois); o comum é abrir, conferir e mandar — e o
 * botão primário deve ser o gesto comum.
 */
export function PostDialog({
	open,
	postId,
	onOpenChange,
	onSaved,
}: {
	open: boolean;
	postId: string | null;
	onOpenChange: (open: boolean) => void;
	onSaved: () => Promise<void> | void;
}) {
	const captionId = useId();
	const linkId = useId();
	const [form, setForm] = useState<Form>(EMPTY);
	const [picking, setPicking] = useState(false);

	const post = useQuery({
		...trpc.social.get.queryOptions({ id: postId ?? "" }),
		enabled: open && postId !== null,
	});

	// Carrega o post no formulário quando ele chega. A dependência é o ID e o
	// dado, não `post` inteiro: reagir ao objeto do React Query reescreveria o
	// que a pessoa está digitando a cada refetch em segundo plano.
	// biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
	useEffect(() => {
		if (!open) {
			return;
		}
		if (post.data) {
			setForm({
				captionText: post.data.caption,
				mediaIds: [...post.data.mediaIds],
				platforms: post.data.deliveries.map((d) => d.destination),
				linkUrl: post.data.linkUrl ?? "",
			});
		} else if (!postId) {
			setForm(EMPTY);
		}
	}, [open, postId, post.data?.id]);

	const payload = () => ({
		captionText: form.captionText,
		mediaIds: form.mediaIds,
		platforms: form.platforms,
		linkUrl: form.linkUrl.trim() === "" ? null : form.linkUrl.trim(),
	});

	const save = useMutation(
		trpc.social.update.mutationOptions({
			onSuccess: async () => {
				toast.success("Rascunho salvo.");
				await onSaved();
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const create = useMutation(
		trpc.social.createDraft.mutationOptions({
			onSuccess: async () => {
				toast.success("Rascunho criado.");
				await onSaved();
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	// Gravação SEM efeito colateral, usada logo antes de aprovar. A `save` acima
	// fecha o diálogo e avisa "Rascunho salvo" — ali isso anunciaria um passo
	// intermediário e fecharia a tela antes de a aprovação responder.
	const saveBeforeApprove = useMutation(trpc.social.update.mutationOptions());

	const approve = useMutation(
		trpc.social.approve.mutationOptions({
			onSuccess: async () => {
				// "Na fila", e não "Publicado": quem publica é a tarefa de envio, e
				// prometer o que ainda não aconteceu é o que faz alguém abrir o
				// Instagram para conferir e não achar nada.
				toast.success("Aprovado — entrou na fila de envio.");
				await onSaved();
				onOpenChange(false);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const busy =
		save.isPending ||
		create.isPending ||
		saveBeforeApprove.isPending ||
		approve.isPending;
	const counters = captionCounters(form.captionText, form.platforms);
	const notice = storyNotice(form.platforms, form.mediaIds.length);

	/**
	 * Os impedimentos vêm do SERVIDOR (`post.blockers`), que os calcula no
	 * agregado. A tela não os recalcula: duas listas de regras divergem no dia em
	 * que uma das duas for atualizada.
	 *
	 * O que a tela acrescenta é só o que ela sabe e o servidor ainda não: o que
	 * foi digitado agora e ainda não salvou.
	 */
	const localBlockers = [
		form.platforms.length === 0 ? "Escolha ao menos uma rede social." : null,
		form.mediaIds.length === 0
			? "A publicação precisa de ao menos uma imagem."
			: null,
		form.captionText.trim() === "" ? "A legenda está vazia." : null,
		...counters.map((counter) =>
			counter.over
				? `A legenda tem ${counter.length} caracteres e o ${counter.label} aceita ${counter.max}.`
				: null,
		),
		...counters.map((counter) =>
			counter.hashtagsOver
				? `São ${counter.hashtags} hashtags e o ${counter.label} aceita ${counter.hashtagMax}.`
				: null,
		),
	].filter((blocker): blocker is string => blocker !== null);

	const editable = !post.data || post.data.status === "RASCUNHO";

	function move(index: number, direction: -1 | 1) {
		const target = index + direction;
		if (target < 0 || target >= form.mediaIds.length) {
			return;
		}
		const mediaIds = [...form.mediaIds];
		const [moved] = mediaIds.splice(index, 1);
		if (moved) {
			mediaIds.splice(target, 0, moved);
		}
		setForm({ ...form, mediaIds });
	}

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
				<DialogHeader>
					<DialogTitle>
						{postId ? "Revisar publicação" : "Nova publicação"}
					</DialogTitle>
					<DialogDescription>
						{editable
							? "Confira a legenda e as imagens antes de aprovar. Depois de aprovado, o texto não muda mais."
							: "Esta publicação já foi aprovada — o texto está congelado."}
					</DialogDescription>
				</DialogHeader>

				<div className="flex flex-col gap-5">
					<div className="flex flex-col gap-2">
						<Label>Redes</Label>
						<div className="flex flex-wrap gap-2">
							{SOCIAL_DESTINATIONS.map((destination) => {
								const checked = form.platforms.includes(destination);
								return (
									<button
										key={destination}
										type="button"
										disabled={!editable || busy}
										onClick={() =>
											setForm({
												...form,
												platforms: checked
													? form.platforms.filter(
															(item) => item !== destination,
														)
													: [...form.platforms, destination],
											})
										}
										className={cn(
											"rounded-full border px-4 py-1.5 font-medium text-sm transition-colors",
											checked
												? "border-primary bg-primary text-primary-foreground"
												: "border-input bg-background text-muted-foreground hover:bg-accent",
											(!editable || busy) && "cursor-not-allowed opacity-60",
										)}
										aria-pressed={checked}
									>
										{DESTINATION_LABEL[destination]}
									</button>
								);
							})}
						</div>
						{notice ? (
							<p className="text-muted-foreground text-xs">{notice}</p>
						) : null}
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor={captionId}>Legenda</Label>
						<Textarea
							id={captionId}
							value={form.captionText}
							onChange={(event) =>
								setForm({ ...form, captionText: event.target.value })
							}
							rows={9}
							disabled={!editable || busy}
							className="resize-y font-normal"
						/>
						<div className="flex flex-wrap gap-x-4 gap-y-1 text-xs">
							{counters.map((counter) => (
								<span
									key={counter.destination}
									className={cn(
										"tabular-nums",
										counter.over || counter.hashtagsOver
											? "font-medium text-destructive"
											: "text-muted-foreground",
									)}
								>
									{counter.label}: {counter.length}/{counter.max}
									{counter.hashtags > 0
										? ` · ${counter.hashtags} hashtag${counter.hashtags > 1 ? "s" : ""}`
										: ""}
								</span>
							))}
						</div>
					</div>

					<div className="flex flex-col gap-2">
						<div className="flex items-center justify-between">
							<Label>
								Imagens{" "}
								<span className="font-normal text-muted-foreground">
									({form.mediaIds.length}/{MAX_MEDIA_ITEMS}
									{form.mediaIds.length > 1 ? " · carrossel" : ""})
								</span>
							</Label>
							<Button
								type="button"
								variant="outline"
								size="sm"
								disabled={
									!editable || busy || form.mediaIds.length >= MAX_MEDIA_ITEMS
								}
								onClick={() => setPicking(true)}
							>
								<ImagePlus className="size-4" />
								Adicionar
							</Button>
						</div>

						{form.mediaIds.length === 0 ? (
							<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
								Nenhuma imagem escolhida.
							</p>
						) : (
							<ul className="flex flex-col gap-2">
								{form.mediaIds.map((mediaId, index) => (
									<MediaRow
										key={mediaId}
										mediaId={mediaId}
										index={index}
										total={form.mediaIds.length}
										disabled={!editable || busy}
										onMove={move}
										onRemove={() =>
											setForm({
												...form,
												mediaIds: form.mediaIds.filter(
													(item) => item !== mediaId,
												),
											})
										}
									/>
								))}
							</ul>
						)}
						{form.mediaIds.length > 1 ? (
							<p className="text-muted-foreground text-xs">
								A primeira imagem é a capa do carrossel — é ela que aparece no
								feed.
							</p>
						) : null}
					</div>

					<div className="flex flex-col gap-2">
						<Label htmlFor={linkId}>Link da matéria</Label>
						<Input
							id={linkId}
							value={form.linkUrl}
							onChange={(event) =>
								setForm({ ...form, linkUrl: event.target.value })
							}
							placeholder="https://…"
							disabled={!editable || busy}
						/>
						<p className="text-muted-foreground text-xs">
							Vai para o Facebook, no fim da legenda. No Instagram o link não é
							clicável, então ele não entra lá.
						</p>
					</div>

					{/*
					  A arte de cada destino (spec 09, F5). Grava a cada escolha — é a
					  gravação que tira a cópia do padrão —, então só aparece num post
					  que já existe. `refetch` traz a arte e os avisos novos sem
					  recarregar o formulário: ele só se refaz quando muda o id.
					*/}
					<PostArtSection
						postId={postId}
						editable={editable}
						destinations={form.platforms}
						photoMediaId={form.mediaIds[0] ?? null}
						art={post.data?.art ?? {}}
						content={
							post.data?.artContentForDrawing ?? {
								headline: form.captionText.split("\n")[0] ?? "",
								kicker: null,
								sectionName: null,
							}
						}
						warnings={post.data?.artWarnings ?? {}}
						onChanged={async () => {
							await post.refetch();
						}}
					/>

					{localBlockers.length > 0 && editable ? (
						<div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
							<AlertTriangle className="mt-0.5 size-4 shrink-0" />
							<div>
								<p className="font-medium">Falta resolver antes de aprovar:</p>
								<ul className="mt-1 list-disc space-y-0.5 pl-4">
									{localBlockers.map((blocker) => (
										<li key={blocker}>{blocker}</li>
									))}
								</ul>
							</div>
						</div>
					) : null}
				</div>

				<DialogFooter className="gap-2">
					<Button
						variant="ghost"
						onClick={() => onOpenChange(false)}
						disabled={busy}
					>
						Fechar
					</Button>
					{editable ? (
						<>
							<Button
								variant="outline"
								disabled={busy}
								onClick={() => {
									if (postId) {
										save.mutate({ id: postId, ...payload() });
									} else {
										create.mutate(payload());
									}
								}}
							>
								Salvar rascunho
							</Button>
							<Button
								disabled={busy || localBlockers.length > 0}
								onClick={async () => {
									if (!postId) {
										toast.error("Salve o rascunho antes de aprovar.");
										return;
									}
									// Salva ANTES de aprovar: aprovar publica o que está no
									// banco, não o que está na tela. Sem isto, uma correção de
									// última hora na legenda simplesmente não iria ao ar.
									try {
										await saveBeforeApprove.mutateAsync({
											id: postId,
											...payload(),
										});
									} catch (error) {
										toast.error(
											error instanceof Error
												? error.message
												: "Não foi possível salvar.",
										);
										return;
									}
									approve.mutate({ id: postId });
								}}
							>
								Aprovar e publicar
							</Button>
						</>
					) : null}
				</DialogFooter>

				<MediaPickerDialog
					open={picking}
					onOpenChange={setPicking}
					title="Escolher imagem"
					onSelect={(mediaId) => {
						setPicking(false);
						if (form.mediaIds.includes(mediaId)) {
							toast.error("Essa imagem já está na publicação.");
							return;
						}
						setForm({ ...form, mediaIds: [...form.mediaIds, mediaId] });
					}}
				/>
			</DialogContent>
		</Dialog>
	);
}

function MediaRow({
	mediaId,
	index,
	total,
	disabled,
	onMove,
	onRemove,
}: {
	mediaId: string;
	index: number;
	total: number;
	disabled: boolean;
	onMove: (index: number, direction: -1 | 1) => void;
	onRemove: () => void;
}) {
	const asset = useQuery(trpc.media.get.queryOptions({ id: mediaId }));

	return (
		<li className="flex items-center gap-3 rounded-md border p-2">
			<div className="size-14 shrink-0 overflow-hidden rounded bg-muted">
				{asset.data ? (
					<AssetImage
						src={asset.data.url}
						alt={asset.data.altText ?? ""}
						className="size-full object-cover"
					/>
				) : null}
			</div>
			<div className="min-w-0 flex-1">
				<p className="truncate font-medium text-sm">
					{asset.data?.filename ?? "Carregando…"}
				</p>
				<p className="truncate text-muted-foreground text-xs">
					{index === 0 && total > 1
						? "Capa do carrossel"
						: `Posição ${index + 1}`}
				</p>
			</div>
			<div className="flex items-center gap-1">
				<Button
					type="button"
					variant="ghost"
					size="icon"
					disabled={disabled || index === 0}
					onClick={() => onMove(index, -1)}
					aria-label="Mover para trás"
				>
					<ArrowLeft className="size-4" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					disabled={disabled || index === total - 1}
					onClick={() => onMove(index, 1)}
					aria-label="Mover para frente"
				>
					<ArrowRight className="size-4" />
				</Button>
				<Button
					type="button"
					variant="ghost"
					size="icon"
					disabled={disabled}
					onClick={onRemove}
					aria-label="Remover imagem"
				>
					<Trash2 className="size-4" />
				</Button>
			</div>
		</li>
	);
}
