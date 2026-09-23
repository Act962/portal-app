"use client";

import {
	type ArtContent,
	type ArtSelection,
	acceptsVideo,
	artFields,
	DESTINATION_LABEL,
	formatSeconds,
	formatsFor,
	inputsAfterTextEdit,
	inputsAfterVariableEdit,
	MAX_CLIPS,
	type SocialDestination,
	sequenceDuration,
	type VideoSequence,
	wholeClip,
} from "@portal-app/social";
import { Button, buttonVariants } from "@portal-app/ui/components/button";
import { Label } from "@portal-app/ui/components/label";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@portal-app/ui/components/tabs";
import { Textarea } from "@portal-app/ui/components/textarea";
import { cn } from "@portal-app/ui/lib/utils";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowLeft,
	Check,
	Pause,
	Play,
	Volume2,
	VolumeX,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { VideoArtPreview } from "@/components/art/video-art-preview";
import { trpc } from "@/utils/trpc";

import { VideoPickerDialog } from "../video-picker-dialog";
import { VideoTrimBar } from "../video-trim-bar";
import { TemplateChoice } from "./template-choice";
import { allMuted, setAllMuted } from "./video-editor-model";
import { VideoTimeline } from "./video-timeline";

/**
 * O editor de vídeo em tela cheia (spec 12, F1–F3).
 *
 * Nasceu porque o corte dentro do diálogo do post não dava conta: com vários
 * trechos, a linha do tempo, a prévia e o painel do padrão não cabem num
 * diálogo de 600 px sem tudo virar uma tira de rolagem. Aqui cada coisa tem o
 * seu lugar — a prévia grande à esquerda, o padrão à direita, os trechos
 * embaixo — e é o mesmo arranjo do editor de padrões, que a redação já conhece.
 *
 * **Grava a cada gesto terminado**, não a cada pixel de arraste: soltar a alça,
 * tirar um trecho, trocar a ordem. O deslizador emite dezenas de mudanças por
 * segundo, e uma gravação por pixel encheria a fila de mutações sem ganho
 * nenhum.
 */
export function VideoEditor({
	id,
	canDesign,
	embedded = false,
}: {
	id: string;
	canDesign: boolean;
	/**
	 * Aberto dentro do diálogo da matéria (spec 12, F5): o próprio diálogo já dá
	 * título e o "x", então o cabeçalho de página — "Voltar à fila" e "Concluir" —
	 * sai, e no lugar fica só o aviso de gravação. Fora do diálogo (a página em
	 * tela cheia) segue igual.
	 */
	embedded?: boolean;
}) {
	const post = useQuery(trpc.social.get.queryOptions({ id }));

	const [clips, setClips] = useState<VideoSequence>([]);
	const [selected, setSelected] = useState(0);
	const [picking, setPicking] = useState(false);
	const [playing, setPlaying] = useState(false);
	const [at, setAt] = useState(0);
	const [destination, setDestination] = useState<SocialDestination | null>(
		null,
	);

	// Recarrega quando o servidor devolve outra montagem — mas não no meio de um
	// arraste (a chave é o que está SALVO, não o que está na alça).
	const savedKey = JSON.stringify(post.data?.clips ?? []);
	// biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
	useEffect(() => {
		setClips(post.data?.clips ?? []);
	}, [savedKey]);

	const targets = useMemo(
		() => (post.data?.deliveries ?? []).map((item) => item.destination),
		[post.data?.deliveries],
	);
	const videoTargets = targets.filter(acceptsVideo);
	const active = destination ?? videoTargets[0] ?? null;

	// Os arquivos dos trechos, para a prévia tocar. Uma consulta só, com todos
	// os ids — um `useQuery` por trecho seria uma requisição por corte.
	const mediaIds = useMemo(
		() => [...new Set(clips.map((clip) => clip.mediaId))],
		[clips],
	);
	const media = useQuery({
		...trpc.media.library.queryOptions({ ids: mediaIds }),
		enabled: mediaIds.length > 0,
	});
	const urlFor = (mediaId: string) =>
		media.data?.items.find((item) => item.id === mediaId)?.url ?? null;

	const save = useMutation(
		trpc.social.setVideo.mutationOptions({
			onSuccess: async () => {
				await post.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const chooseArt = useMutation(
		trpc.social.chooseArt.mutationOptions({
			onSuccess: async () => {
				await post.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const setInputs = useMutation(
		trpc.social.setArtInputs.mutationOptions({
			onSuccess: async () => {
				await post.refetch();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (post.isLoading) {
		return <Skeleton className="h-[calc(100dvh-8rem)] w-full" />;
	}
	if (!post.data) {
		return (
			<p className="p-6 text-muted-foreground text-sm">
				Publicação não encontrada.
			</p>
		);
	}

	const editable = post.data.status === "RASCUNHO";
	const busy = !editable || save.isPending;
	const content = post.data.artContentForDrawing;
	const selection: ArtSelection | null = active
		? ((post.data.art as Record<string, ArtSelection>)[active] ?? null)
		: null;
	const format = active ? (formatsFor(active)[0] ?? "9:16") : "9:16";
	const total = sequenceDuration(clips);

	const commit = (next: VideoSequence) => {
		if (JSON.stringify(next) === JSON.stringify(post.data?.clips ?? [])) {
			return;
		}
		save.mutate({ id, clips: [...next] });
	};

	const change = (next: VideoSequence) => {
		setClips(next);
		commit(next);
	};

	return (
		<div className="flex flex-col gap-4">
			{/*
			  `min-w-0` nos dois lugares é o que segura este cabeçalho.

			  Um filho de flex não encolhe abaixo do conteúdo por omissão, e a
			  legenda de um post é longa: sem isso, o `line-clamp-1` não tinha de
			  que largura se aproximar, o bloco da esquerda empurrava o da direita
			  para fora, e o `flex-wrap` jogava "salvo / Concluir" para baixo do
			  botão de voltar. O `truncate` só funciona depois que a caixa pode
			  encolher.
			*/}
			{embedded ? (
				<div className="flex items-center justify-end">
					<span className="text-muted-foreground text-xs tabular-nums">
						{save.isPending ? "gravando…" : "salvo"}
					</span>
				</div>
			) : (
				<header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
					<div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3">
						<Link
							href="/dashboard/social?tab=fila"
							className={cn(
								buttonVariants({ variant: "ghost", size: "sm" }),
								"shrink-0",
							)}
						>
							<ArrowLeft className="size-4" />
							<span className="hidden sm:inline">Voltar à fila</span>
							<span className="sr-only sm:hidden">Voltar à fila</span>
						</Link>
						<div className="min-w-0">
							<h1 className="truncate font-semibold text-base sm:text-lg">
								Editor de vídeo
							</h1>
							<p className="truncate text-muted-foreground text-xs">
								{post.data.caption || "Sem legenda"}
							</p>
						</div>
					</div>
					<div className="flex shrink-0 items-center gap-2">
						<span className="text-muted-foreground text-xs tabular-nums">
							{save.isPending ? "gravando…" : "salvo"}
						</span>
						<Link
							href="/dashboard/social?tab=fila"
							className={cn(buttonVariants({ size: "sm" }))}
						>
							<Check className="size-4" />
							Concluir
						</Link>
					</div>
				</header>
			)}

			{!editable ? (
				<p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
					Esta publicação já foi aprovada — o vídeo está congelado, como o
					texto.
				</p>
			) : null}

			<div className="grid gap-4 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
				{/*
				  A prévia é 9:16 e `w-full`: no celular ela vira 600 px de altura e
				  empurra o padrão e a linha do tempo para debaixo da dobra. O teto
				  é pela ALTURA da janela — `9/16` da altura disponível —, e não uma
				  largura fixa, porque o que incomoda é a altura, e ela depende da
				  tela. Em `lg` o teto sai: ali a prévia tem coluna própria.
				*/}
				<div className="mx-auto flex w-full max-w-[calc(46vh*9/16)] flex-col gap-2 sm:max-w-[calc(55vh*9/16)] lg:mx-0 lg:max-w-none">
					{active ? (
						<VideoArtPreview
							format={format}
							design={selection?.design ?? EMPTY}
							content={content as ArtContent}
							inputs={{
								values: selection?.values ?? {},
								texts: selection?.texts ?? {},
							}}
							clips={clips}
							urlFor={urlFor}
							playing={playing}
							onProgress={setAt}
							onEnded={() => setPlaying(false)}
							label={`Prévia do vídeo em ${DESTINATION_LABEL[active]}`}
							className="rounded border"
						/>
					) : (
						<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
							Este post não tem destino que aceite vídeo. Marque o Reels ou os
							Stories na fila.
						</p>
					)}
					<div className="flex flex-wrap items-center justify-between gap-2">
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={clips.length === 0}
							onClick={() => setPlaying((value) => !value)}
						>
							{playing ? (
								<Pause className="size-4" />
							) : (
								<Play className="size-4" />
							)}
							{playing ? "Pausar" : "Ver a montagem"}
						</Button>
						<span className="text-muted-foreground text-xs tabular-nums">
							{formatSeconds(at)} / {formatSeconds(total)}
						</span>
						<Button
							type="button"
							variant="outline"
							size="sm"
							disabled={busy || clips.length === 0}
							onClick={() => change(setAllMuted(clips, !allMuted(clips)))}
						>
							{allMuted(clips) ? (
								<VolumeX className="size-4" />
							) : (
								<Volume2 className="size-4" />
							)}
							{allMuted(clips) ? "Tudo mudo" : "Com som"}
						</Button>
					</div>
				</div>

				<div className="flex flex-col gap-4">
					{videoTargets.length > 1 && active ? (
						<Tabs
							value={active}
							onValueChange={(value) =>
								setDestination(value as SocialDestination)
							}
						>
							<TabsList className="max-w-full overflow-x-auto">
								{videoTargets.map((target) => (
									<TabsTrigger key={target} value={target}>
										{DESTINATION_LABEL[target]}
									</TabsTrigger>
								))}
							</TabsList>
						</Tabs>
					) : null}

					{active ? (
						<div className="flex flex-col gap-3 rounded-md border p-3">
							<Label>Padrão de arte</Label>
							<TemplateChoice
								destination={active}
								value={selection?.templateId ?? null}
								fallbackName={selection?.templateName ?? null}
								canDesign={canDesign}
								disabled={!editable || chooseArt.isPending}
								onChange={(templateId) =>
									chooseArt.mutate({ id, destination: active, templateId })
								}
							/>
							{selection ? (
								<ArtFields
									postId={id}
									destination={active}
									selection={selection}
									content={content as ArtContent}
									disabled={!editable || setInputs.isPending}
									onSave={(next) =>
										setInputs.mutate({ id, destination: active, ...next })
									}
								/>
							) : null}
						</div>
					) : null}

					{post.data.blockers.length > 0 && editable ? (
						<div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
							<AlertTriangle className="mt-0.5 size-4 shrink-0" />
							<div>
								<p className="font-medium">Falta resolver antes de aprovar:</p>
								<ul className="mt-1 list-disc space-y-0.5 pl-4">
									{post.data.blockers.map((blocker) => (
										<li key={blocker}>{blocker}</li>
									))}
								</ul>
							</div>
						</div>
					) : null}
				</div>
			</div>

			<div className="flex flex-col gap-3 rounded-md border p-3">
				<VideoTimeline
					clips={clips}
					selected={selected}
					onSelect={setSelected}
					onChange={change}
					onAdd={() => setPicking(true)}
					disabled={busy}
					playheadSeconds={at}
				/>

				{clips[selected] ? (
					<div className="flex flex-col gap-2 border-t pt-3">
						<p className="font-medium text-sm">Trecho {selected + 1} — corte</p>
						<VideoTrimBar
							clip={clips[selected]}
							disabled={busy}
							onChange={(clip) =>
								setClips(
									clips.map((current, index) =>
										index === selected ? clip : current,
									),
								)
							}
							onCommit={(clip) =>
								commit(
									clips.map((current, index) =>
										index === selected ? clip : current,
									),
								)
							}
						/>
					</div>
				) : null}
			</div>

			<VideoPickerDialog
				open={picking}
				onOpenChange={setPicking}
				onPicked={(mediaId, durationSeconds) => {
					if (clips.length >= MAX_CLIPS) {
						toast.error(`Um vídeo aceita até ${MAX_CLIPS} trechos.`);
						return;
					}
					const next = [...clips, wholeClip(mediaId, durationSeconds)];
					setPicking(false);
					setSelected(next.length - 1);
					change(next);
				}}
			/>
		</div>
	);
}

const EMPTY = { background: "#ffffff", elements: [], variables: [] };

/** Os campos que o padrão deixou a redação preencher. */
function ArtFields({
	selection,
	content,
	disabled,
	onSave,
}: {
	postId: string;
	destination: SocialDestination;
	selection: ArtSelection;
	content: ArtContent;
	disabled: boolean;
	onSave: (inputs: {
		values: Record<string, string>;
		texts: Record<string, string>;
	}) => void;
}) {
	const fields = artFields(selection, content);

	if (fields.texts.length === 0 && fields.variables.length === 0) {
		return (
			<p className="text-muted-foreground text-xs">
				Este padrão não tem campos para preencher: a arte sai com as variáveis
				da matéria.
			</p>
		);
	}

	return (
		<div className="flex flex-col gap-2">
			{fields.texts.map((field) => (
				<Field
					key={`${selection.templateId}-${field.elementId}`}
					label={field.label}
					value={field.value}
					disabled={disabled}
					onCommit={(value) =>
						onSave(
							inputsAfterTextEdit(selection, content, field.elementId, value),
						)
					}
				/>
			))}
			{fields.variables.map((field) => (
				<Field
					key={`${selection.templateId}-var-${field.key}`}
					label={field.label}
					value={field.value}
					disabled={disabled}
					onCommit={(value) =>
						onSave(inputsAfterVariableEdit(selection, field.key, value))
					}
				/>
			))}
		</div>
	);
}

function Field({
	label,
	value,
	disabled,
	onCommit,
}: {
	label: string;
	value: string;
	disabled: boolean;
	onCommit: (value: string) => void;
}) {
	const id = useId();
	const [draft, setDraft] = useState(value);
	useEffect(() => {
		setDraft(value);
	}, [value]);
	return (
		<div className="flex flex-col gap-1">
			<Label htmlFor={id} className="text-xs">
				{label}
			</Label>
			<Textarea
				id={id}
				rows={2}
				value={draft}
				disabled={disabled}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => onCommit(draft)}
			/>
		</div>
	);
}
