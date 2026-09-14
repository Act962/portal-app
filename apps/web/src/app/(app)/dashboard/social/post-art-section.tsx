"use client";

import {
	type ArtContent,
	type ArtSelection,
	DESTINATION_LABEL,
	type SocialDestination,
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
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertTriangle, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

import {
	artPreviewInput,
	artTextFields,
	overridesAfterEdit,
	templatesFor,
} from "./post-art-model";

const NO_TEMPLATE = "__sem-padrao__";

/**
 * A seção "Arte" do editor do post (spec 09, F5): para cada destino, o padrão
 * — ou nenhum, e sai a foto cortada —, os textos que vão nas caixas e a prévia
 * REAL, desenhada pelo servidor com a primeira foto do post.
 *
 * Grava a cada escolha, e não no "Salvar rascunho": a arte vive no post
 * gravado, e é a gravação que tira a cópia do padrão (D9). Por isso a seção só
 * aparece num post que já existe.
 */
export function PostArtSection({
	postId,
	editable,
	destinations,
	photoMediaId,
	art,
	content,
	warnings,
	onChanged,
}: {
	postId: string | null;
	editable: boolean;
	destinations: readonly SocialDestination[];
	/** A primeira foto do post — a que a arte desenha. */
	photoMediaId: string | null;
	art: Readonly<Partial<Record<SocialDestination, ArtSelection>>>;
	/** O conteúdo com que a arte é desenhada. */
	content: ArtContent;
	warnings: Readonly<Record<string, readonly string[]>>;
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
					Com padrão, a rede recebe uma imagem só: a arte, desenhada com a
					primeira foto. Sem padrão, as fotos saem cortadas, como antes.
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
					editable={editable}
					warnings={warnings[destination] ?? []}
					onChanged={onChanged}
				/>
			))}
		</div>
	);
}

/** Título, chapéu e editoria que as caixas da arte usam. */
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
		save.mutate({
			id: postId,
			content: {
				headline: draft.headline,
				kicker: draft.kicker?.trim() ? draft.kicker : null,
				sectionName: draft.sectionName?.trim() ? draft.sectionName : null,
			},
		});
	};

	return (
		<div className="grid gap-2 rounded-md border p-3 sm:grid-cols-[2fr_1fr_1fr]">
			<div className="flex flex-col gap-1">
				<Label htmlFor={`arte-titulo-${postId}`} className="text-xs">
					Título da matéria
				</Label>
				<Input
					id={`arte-titulo-${postId}`}
					value={draft.headline}
					disabled={!editable}
					onChange={(event) =>
						setDraft({ ...draft, headline: event.target.value })
					}
					onBlur={commit}
				/>
			</div>
			<div className="flex flex-col gap-1">
				<Label htmlFor={`arte-chapeu-${postId}`} className="text-xs">
					Chapéu
				</Label>
				<Input
					id={`arte-chapeu-${postId}`}
					value={draft.kicker ?? ""}
					disabled={!editable}
					onChange={(event) =>
						setDraft({ ...draft, kicker: event.target.value })
					}
					onBlur={commit}
				/>
			</div>
			<div className="flex flex-col gap-1">
				<Label htmlFor={`arte-editoria-${postId}`} className="text-xs">
					Editoria
				</Label>
				<Input
					id={`arte-editoria-${postId}`}
					value={draft.sectionName ?? ""}
					disabled={!editable}
					onChange={(event) =>
						setDraft({ ...draft, sectionName: event.target.value })
					}
					onBlur={commit}
				/>
			</div>
		</div>
	);
}

function DestinationArt({
	postId,
	destination,
	selection,
	content,
	photoMediaId,
	editable,
	warnings,
	onChanged,
}: {
	postId: string;
	destination: SocialDestination;
	selection: ArtSelection | null;
	content: ArtContent;
	photoMediaId: string | null;
	editable: boolean;
	warnings: readonly string[];
	onChanged: () => Promise<void> | void;
}) {
	const templates = useQuery(trpc.social.templates.list.queryOptions());
	const choices = templatesFor(destination, templates.data ?? []);

	const choose = useMutation(
		trpc.social.chooseArt.mutationOptions({
			onSuccess: async () => {
				await onChanged();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const setOverrides = useMutation(
		trpc.social.setArtOverrides.mutationOptions({
			onSuccess: async () => {
				await onChanged();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const options = [
		{ value: NO_TEMPLATE, label: "Sem padrão — fotos cortadas" },
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

			{selection ? (
				<div className="grid gap-3 sm:grid-cols-[180px_minmax(0,1fr)]">
					<ArtPreview
						selection={selection}
						content={content}
						photoMediaId={photoMediaId}
					/>
					<div className="flex flex-col gap-2">
						{artTextFields(selection, content).map((field) => (
							<ArtTextInput
								key={`${selection.templateId}-${field.layerId}`}
								postId={postId}
								label={field.label}
								value={field.value}
								overridden={field.overridden}
								disabled={!editable || setOverrides.isPending}
								onCommit={(value) => {
									const next = overridesAfterEdit(
										selection,
										content,
										field.layerId,
										value,
									);
									if (
										JSON.stringify(next) !== JSON.stringify(selection.overrides)
									) {
										setOverrides.mutate({
											id: postId,
											destination,
											overrides: next,
										});
									}
								}}
							/>
						))}
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

function ArtTextInput({
	postId,
	label,
	value,
	overridden,
	disabled,
	onCommit,
}: {
	postId: string;
	label: string;
	value: string;
	overridden: boolean;
	disabled: boolean;
	onCommit: (value: string) => void;
}) {
	const [draft, setDraft] = useState(value);
	useEffect(() => {
		setDraft(value);
	}, [value]);
	const id = `arte-${postId}-${label.replace(/\W+/g, "-")}`;
	return (
		<div className="flex flex-col gap-1">
			<Label htmlFor={id} className="text-xs">
				{label}
				{overridden ? (
					<span className="ml-1 font-normal text-muted-foreground">
						(trocado neste post)
					</span>
				) : null}
			</Label>
			<Input
				id={id}
				value={draft}
				disabled={disabled}
				onChange={(event) => setDraft(event.target.value)}
				onBlur={() => onCommit(draft)}
			/>
		</div>
	);
}

/** A arte real, pedida ao servidor sempre que o desenho, o texto ou a foto mudam. */
function ArtPreview({
	selection,
	content,
	photoMediaId,
}: {
	selection: ArtSelection;
	content: ArtContent;
	photoMediaId: string | null;
}) {
	const preview = useMutation(trpc.social.templates.preview.mutationOptions());
	const key = JSON.stringify({ selection, content, photoMediaId });
	// biome-ignore lint/correctness/useExhaustiveDependencies: redesenha pela chave, não a cada render
	useEffect(() => {
		preview.mutate(artPreviewInput({ selection, content, photoMediaId }));
	}, [key]);

	const ratio =
		selection.format === "9:16"
			? "9 / 16"
			: selection.format === "1:1"
				? "1 / 1"
				: "4 / 5";

	return (
		<div
			className="relative w-full overflow-hidden rounded border bg-muted"
			style={{ aspectRatio: ratio }}
		>
			{preview.data?.image ? (
				<img
					src={preview.data.image}
					alt={`Prévia da arte "${selection.templateName}"`}
					className="size-full object-cover"
				/>
			) : (
				<Skeleton className="size-full rounded-none" />
			)}
			{preview.isPending ? (
				<span className="absolute top-1 right-1 rounded bg-black/60 p-1 text-white">
					<Loader2 className="size-3 animate-spin" />
				</span>
			) : null}
		</div>
	);
}
