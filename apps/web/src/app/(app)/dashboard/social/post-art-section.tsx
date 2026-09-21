"use client";

import {
	type ArtContent,
	type ArtSelection,
	artFields,
	DESTINATION_LABEL,
	inputsAfterTextEdit,
	inputsAfterVariableEdit,
	type SocialDestination,
	type VideoSequence,
} from "@portal-app/social";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@portal-app/ui/components/select";
import { Textarea } from "@portal-app/ui/components/textarea";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { ArtCanvas } from "@/components/art/art-canvas";
import { VideoArtPreview } from "@/components/art/video-art-preview";
import { trpc } from "@/utils/trpc";

import { templatesFor } from "./post-art-model";

const NO_TEMPLATE = "__sem-padrao__";

/**
 * A seção "Arte" do editor do post (specs 09 e 10): para cada destino, o padrão
 * — ou nenhum, e sai a foto cortada —, os campos que o padrão deixou preencher
 * (variáveis do padrão e caixas Editáveis) e a prévia desenhada ao vivo, com a
 * mesma cena que o servidor publica.
 *
 * Grava a cada escolha: a arte vive no post gravado, e é a gravação que tira a
 * cópia do padrão (09, D9). Por isso a seção só aparece num post que já existe.
 */
export function PostArtSection({
	postId,
	editable,
	destinations,
	photoMediaId,
	clips = [],
	art,
	content,
	onChanged,
}: {
	postId: string | null;
	editable: boolean;
	destinations: readonly SocialDestination[];
	/** A primeira foto do post — a que a arte desenha. */
	photoMediaId: string | null;
	/** Os trechos do post, quando há: a prévia toca no lugar da foto (spec 12). */
	clips?: VideoSequence;
	art: Readonly<Partial<Record<SocialDestination, ArtSelection>>>;
	/** O conteúdo com que a arte é desenhada. */
	content: ArtContent;
	onChanged: () => Promise<void> | void;
}) {
	if (!postId) {
		return (
			<div className="flex flex-col gap-2">
				<Label>Arte</Label>
				<p className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
					Salve o rascunho para escolher o padrão de arte de cada rede.
				</p>
			</div>
		);
	}

	return (
		<div className="flex flex-col gap-3">
			<div>
				<Label>Arte</Label>
				<p className="mt-1 text-muted-foreground text-xs">
					{clips.length > 0
						? "Com padrão, o vídeo entra no lugar da foto e o desenho é queimado por cima. Sem padrão, ele sai enquadrado no formato da rede."
						: "Com padrão, a rede recebe uma imagem só: a arte, desenhada com a primeira foto. Sem padrão, as fotos saem cortadas, como antes."}
				</p>
			</div>
			<ArtContentFields
				postId={postId}
				content={content}
				editable={editable}
				onChanged={onChanged}
			/>
			{destinations.map((destination) => (
				<DestinationArt
					key={destination}
					postId={postId}
					destination={destination}
					selection={art[destination] ?? null}
					content={content}
					photoMediaId={photoMediaId}
					clips={clips}
					editable={editable}
					onChanged={onChanged}
				/>
			))}
		</div>
	);
}

/** O que as variáveis da matéria usam: título, subtítulo, chapéu, editoria. */
function ArtContentFields({
	postId,
	content,
	editable,
	onChanged,
}: {
	postId: string;
	content: ArtContent;
	editable: boolean;
	onChanged: () => Promise<void> | void;
}) {
	const baseId = useId();
	const [draft, setDraft] = useState(content);
	// Recarrega quando o servidor devolve outro conteúdo — mas não enquanto a
	// pessoa digita (a chave é o conteúdo salvo, não o do campo).
	const savedKey = JSON.stringify(content);
	// biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
	useEffect(() => {
		setDraft(content);
	}, [savedKey]);

	const save = useMutation(
		trpc.social.setArtContent.mutationOptions({
			onSuccess: async () => {
				await onChanged();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const commit = () => {
		if (JSON.stringify(draft) === savedKey) {
			return;
		}
		const clean = (value: string | null) => (value?.trim() ? value : null);
		save.mutate({
			id: postId,
			content: {
				...draft,
				subtitle: clean(draft.subtitle),
				kicker: clean(draft.kicker),
				sectionName: clean(draft.sectionName),
			},
		});
	};

	const fields: readonly [keyof ArtContent, string, string][] = [
		["headline", "Título da matéria", "sm:col-span-2"],
		["subtitle", "Subtítulo", "sm:col-span-2"],
		["kicker", "Chapéu", ""],
		["sectionName", "Editoria", ""],
	];

	return (
		<div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
			<p className="text-muted-foreground text-xs sm:col-span-2">
				Variáveis da matéria — valem para as artes de todos os destinos.
			</p>
			{fields.map(([key, label, span]) => (
				<div key={key} className={`flex flex-col gap-1 ${span}`}>
					<Label htmlFor={`${baseId}-${key}`} className="text-xs">
						{label}
					</Label>
					<Input
						id={`${baseId}-${key}`}
						value={draft[key] ?? ""}
						disabled={!editable}
						onChange={(event) =>
							setDraft({ ...draft, [key]: event.target.value })
						}
						onBlur={commit}
					/>
				</div>
			))}
		</div>
	);
}

function DestinationArt({
	postId,
	destination,
	selection,
	content,
	photoMediaId,
	clips,
	editable,
	onChanged,
}: {
	postId: string;
	destination: SocialDestination;
	selection: ArtSelection | null;
	content: ArtContent;
	photoMediaId: string | null;
	clips: VideoSequence;
	editable: boolean;
	onChanged: () => Promise<void> | void;
}) {
	const templates = useQuery(trpc.social.templates.list.queryOptions());
	const choices = templatesFor(destination, templates.data ?? []);
	const [warnings, setWarnings] = useState<string[]>([]);

	const choose = useMutation(
		trpc.social.chooseArt.mutationOptions({
			onSuccess: async () => {
				await onChanged();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const setInputs = useMutation(
		trpc.social.setArtInputs.mutationOptions({
			onSuccess: async () => {
				await onChanged();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const options = [
		{
			value: NO_TEMPLATE,
			label:
				clips.length > 0
					? "Sem padrão — vídeo cru"
					: "Sem padrão — fotos cortadas",
		},
		...choices.map((template) => ({
			value: template.id,
			label: template.defaultFor.includes(destination)
				? `${template.name} (padrão)`
				: template.name,
		})),
	];
	// A cópia guardada pode ser de um padrão que não está mais na lista
	// (arquivado): ela continua valendo, e aparece com o nome da cópia.
	if (selection && !choices.some((t) => t.id === selection.templateId)) {
		options.push({
			value: selection.templateId,
			label: `${selection.templateName} (versão ${selection.version})`,
		});
	}

	const fields = selection ? artFields(selection, content) : null;
	const saveInputs = (next: {
		values: Record<string, string>;
		texts: Record<string, string>;
	}) => {
		if (
			selection &&
			(JSON.stringify(next.values) !== JSON.stringify(selection.values) ||
				JSON.stringify(next.texts) !== JSON.stringify(selection.texts))
		) {
			setInputs.mutate({ id: postId, destination, ...next });
		}
	};

	return (
		<div className="flex flex-col gap-3 rounded-md border p-3">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="font-medium text-sm">{DESTINATION_LABEL[destination]}</p>
				<div className="w-64">
					<Select
						items={options}
						value={selection?.templateId ?? NO_TEMPLATE}
						disabled={!editable || choose.isPending}
						onValueChange={(value) => {
							if (!value) {
								return;
							}
							choose.mutate({
								id: postId,
								destination,
								templateId: value === NO_TEMPLATE ? null : value,
							});
						}}
					>
						<SelectTrigger className="w-full">
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

			{selection && fields ? (
				<div className="grid gap-3 sm:grid-cols-[200px_minmax(0,1fr)]">
					{clips.length > 0 ? (
						<VideoArtPreviewCard
							selection={selection}
							content={content}
							clips={clips}
						/>
					) : (
						<ArtCanvas
							format={selection.format}
							design={selection.design}
							content={content}
							inputs={{ values: selection.values, texts: selection.texts }}
							photoMediaId={photoMediaId}
							onWarnings={setWarnings}
							label={`Prévia da arte "${selection.templateName}"`}
							className="rounded border"
						/>
					)}
					<div className="flex flex-col gap-2">
						{fields.texts.map((field) => (
							<ArtTextInput
								key={`${selection.templateId}-${field.elementId}`}
								label={field.label}
								hint={field.overridden ? "trocado neste post" : null}
								value={field.value}
								multiline
								disabled={!editable || setInputs.isPending}
								onCommit={(value) =>
									saveInputs(
										inputsAfterTextEdit(
											selection,
											content,
											field.elementId,
											value,
										),
									)
								}
							/>
						))}
						{fields.variables.map((field) => (
							<ArtTextInput
								key={`${selection.templateId}-var-${field.key}`}
								label={field.label}
								hint={field.changed ? null : "valor padrão"}
								value={field.value}
								multiline={field.multiline}
								disabled={!editable || setInputs.isPending}
								onCommit={(value) =>
									saveInputs(
										inputsAfterVariableEdit(selection, field.key, value),
									)
								}
							/>
						))}
						{fields.texts.length === 0 && fields.variables.length === 0 ? (
							<p className="text-muted-foreground text-xs">
								Este padrão não tem campos para preencher: a arte sai com as
								variáveis da matéria.
							</p>
						) : null}
						{warnings.length > 0 ? (
							<p className="flex gap-2 text-amber-700 text-xs dark:text-amber-300">
								<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
								{warnings.join(" ")}
							</p>
						) : null}
						<p className="text-muted-foreground text-xs">
							Desenho de "{selection.templateName}", versão {selection.version}.
							Escolher o padrão de novo traz a versão mais recente.
						</p>
					</div>
				</div>
			) : null}
		</div>
	);
}

/**
 * A prévia do vídeo dentro do padrão, com o botão de tocar.
 *
 * Nasce PARADA, no primeiro quadro do trecho. Três ou quatro destinos tocando
 * juntos ao abrir o diálogo seria um festival de vídeo e de processador — e
 * quem abre o post quer, primeiro, ver se o desenho está no lugar.
 */
function VideoArtPreviewCard({
	selection,
	content,
	clips,
}: {
	selection: ArtSelection;
	content: ArtContent;
	clips: VideoSequence;
}) {
	const [playing, setPlaying] = useState(false);
	const mediaIds = [...new Set(clips.map((clip) => clip.mediaId))];
	const assets = useQuery(trpc.media.library.queryOptions({ ids: mediaIds }));
	const items = assets.data?.items ?? [];
	const focal = items[0]?.focalPoint ?? undefined;

	return (
		<div className="flex flex-col gap-2">
			<VideoArtPreview
				format={selection.format}
				design={selection.design}
				content={content}
				inputs={{ values: selection.values, texts: selection.texts }}
				clips={clips}
				urlFor={(mediaId) =>
					items.find((item) => item.id === mediaId)?.url ?? null
				}
				focal={focal ?? undefined}
				playing={playing}
				onEnded={() => setPlaying(false)}
				label={`Prévia do vídeo no padrão "${selection.templateName}"`}
				className="rounded border"
			/>
			<button
				type="button"
				className="rounded border px-2 py-1 text-xs hover:bg-accent"
				onClick={() => setPlaying((value) => !value)}
			>
				{playing ? "Pausar prévia" : "Tocar prévia"}
			</button>
		</div>
	);
}

function ArtTextInput({
	label,
	hint,
	value,
	multiline,
	disabled,
	onCommit,
}: {
	label: string;
	hint: string | null;
	value: string;
	multiline: boolean;
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
				{hint ? (
					<span className="ml-1 font-normal text-muted-foreground">
						({hint})
					</span>
				) : null}
			</Label>
			{multiline ? (
				<Textarea
					id={id}
					rows={2}
					value={draft}
					disabled={disabled}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={() => onCommit(draft)}
				/>
			) : (
				<Input
					id={id}
					value={draft}
					disabled={disabled}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={() => onCommit(draft)}
				/>
			)}
		</div>
	);
}
