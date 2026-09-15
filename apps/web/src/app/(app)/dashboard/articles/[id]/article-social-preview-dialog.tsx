"use client";

import {
	type ArtContent,
	artFields,
	DESTINATION_LABEL,
	inputsAfterTextEdit,
	inputsAfterVariableEdit,
	PLATFORM_LIMITS,
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
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { useId, useState } from "react";

import { captionCounters } from "@/app/(app)/dashboard/social/social-labels";
import { ArtCanvas } from "@/components/art/art-canvas";
import { AssetImage } from "@/components/media/asset-image";
import { trpc } from "@/utils/trpc";

import {
	type InputsByDestination,
	relevantContentFields,
	selectionForPick,
	type TemplatePicks,
	type TemplateSummary,
} from "./article-social-model";

const CONTENT_FIELDS: readonly {
	key: keyof ArtContent;
	label: string;
	multiline: boolean;
}[] = [
	{ key: "headline", label: "Título", multiline: true },
	{ key: "subtitle", label: "Subtítulo", multiline: true },
	{ key: "kicker", label: "Chapéu", multiline: false },
	{ key: "sectionName", label: "Editoria", multiline: false },
];

/**
 * "Visualizar e editar" da publicação da matéria: a prévia grande de cada
 * destino, como vai sair, e os textos que a redação pode mexer — os da matéria
 * na arte, os campos que o padrão libera e a legenda do feed.
 *
 * Tudo aqui é rascunho da TELA: vale para esta publicação, não muda a matéria,
 * e só grava com "Salvar como rascunho" ou "Aprovar". A prévia é a mesma cena
 * que o servidor publica (spec 10, D9), atualizada a cada tecla.
 */
export function ArticleSocialPreviewDialog({
	open,
	onOpenChange,
	active,
	onActiveChange,
	destinations,
	picks,
	templates,
	inputs,
	onInputsChange,
	content,
	articleContent,
	onContentChange,
	caption,
	onCaptionChange,
	coverMediaId,
	editable,
	busy,
	canApprove,
	hasPost,
	onSubmit,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	/** A aba aberta. `null`: o primeiro destino marcado. Quem abre o diálogo
	 * pelo cartão de um destino já o abre nele. */
	active: SocialDestination | null;
	onActiveChange: (destination: SocialDestination) => void;
	destinations: readonly SocialDestination[];
	picks: TemplatePicks;
	templates: readonly TemplateSummary[];
	inputs: InputsByDestination;
	onInputsChange: (inputs: InputsByDestination) => void;
	content: ArtContent;
	/** O conteúdo como está na matéria — para "voltar ao da matéria". */
	articleContent: ArtContent;
	onContentChange: (content: ArtContent) => void;
	caption: string;
	onCaptionChange: (caption: string) => void;
	coverMediaId: string | null;
	editable: boolean;
	busy: boolean;
	canApprove: boolean;
	hasPost: boolean;
	onSubmit: (approve: boolean) => void;
}) {
	const baseId = useId();
	// Por destino: trocar de aba não pode mostrar o aviso da arte do outro.
	const [warningsBy, setWarningsBy] = useState<
		Partial<Record<SocialDestination, string[]>>
	>({});

	// Abre no primeiro destino marcado; se o ativo for desmarcado, volta a ele.
	const current =
		active && destinations.includes(active)
			? active
			: (destinations[0] ?? null);

	const template = current
		? templates.find((item) => item.id === picks[current])
		: undefined;
	const selection =
		current && template ? selectionForPick(template, inputs[current]) : null;
	const fields = selection ? artFields(selection, content) : null;
	const showsCaption = current
		? PLATFORM_LIMITS[current].publishesCaption
		: false;
	const [counter] = current ? captionCounters(caption, [current]) : [];
	const contentChanged =
		JSON.stringify(content) !== JSON.stringify(articleContent);
	const warnings = (selection && current && warningsBy[current]) || [];
	// Os textos da matéria valem para TODAS as artes marcadas: a relevância olha
	// os padrões de todos os destinos, não só o da aba aberta.
	const relevant = relevantContentFields(
		destinations.flatMap((destination) => {
			const picked = templates.find((item) => item.id === picks[destination]);
			return picked ? [picked.design] : [];
		}),
	);
	const contentFields = CONTENT_FIELDS.filter((field) =>
		relevant.includes(field.key),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-4xl">
				<DialogHeader>
					<DialogTitle>Como vai sair nas redes</DialogTitle>
					<DialogDescription>
						Ajuste os textos desta publicação. A matéria no portal não muda.
					</DialogDescription>
				</DialogHeader>

				{destinations.length === 0 || !current ? (
					<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
						Marque ao menos um destino no cartão.
					</p>
				) : (
					<div className="flex flex-col gap-4">
						{destinations.length > 1 ? (
							<div className="flex gap-1.5" role="tablist">
								{destinations.map((destination) => (
									<button
										key={destination}
										type="button"
										role="tab"
										aria-selected={destination === current}
										onClick={() => onActiveChange(destination)}
										className={cn(
											"rounded-full border px-3 py-1 font-medium text-xs transition-colors",
											destination === current
												? "border-primary bg-primary text-primary-foreground"
												: "border-input bg-background text-muted-foreground hover:bg-accent",
										)}
									>
										{DESTINATION_LABEL[destination]}
									</button>
								))}
							</div>
						) : null}

						<div className="grid gap-5 md:grid-cols-[minmax(0,300px)_minmax(0,1fr)]">
							<div className="flex flex-col gap-2">
								{selection ? (
									<ArtCanvas
										format={selection.format}
										design={selection.design}
										content={content}
										inputs={{
											values: selection.values,
											texts: selection.texts,
										}}
										photoMediaId={coverMediaId}
										onWarnings={(found) =>
											setWarningsBy((all) => ({ ...all, [current]: found }))
										}
										label={`Prévia de ${DESTINATION_LABEL[current]}`}
										className="w-full rounded-md border"
									/>
								) : (
									<CoverPreview
										mediaId={coverMediaId}
										story={PLATFORM_LIMITS[current].imageAspect === "9:16"}
									/>
								)}
								<p className="text-muted-foreground text-xs">
									{selection
										? `Padrão "${selection.templateName}".`
										: "Sem padrão: sai a capa cortada."}
								</p>
								{warnings.length > 0 ? (
									<p className="flex gap-2 text-amber-700 text-xs dark:text-amber-300">
										<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
										{warnings.join(" ")}
									</p>
								) : null}
							</div>

							<div className="flex min-w-0 flex-col gap-4">
								{selection && contentFields.length > 0 ? (
									<section className="flex flex-col gap-2">
										<div className="flex items-center justify-between gap-2">
											<p className="font-medium text-sm">Textos da matéria</p>
											{contentChanged && editable ? (
												<Button
													variant="ghost"
													size="sm"
													onClick={() => onContentChange(articleContent)}
												>
													<RotateCcw className="size-3.5" />
													Voltar aos da matéria
												</Button>
											) : null}
										</div>
										<p className="text-muted-foreground text-xs">
											Aparecem nas caixas fixas do padrão e valem para todos os
											destinos desta publicação.
										</p>
										{contentFields.map((field) => (
											<TextField
												key={field.key}
												id={`${baseId}-${field.key}`}
												label={field.label}
												value={content[field.key] ?? ""}
												multiline={field.multiline}
												disabled={!editable || busy}
												onChange={(value) =>
													onContentChange({ ...content, [field.key]: value })
												}
											/>
										))}
									</section>
								) : null}

								{selection &&
								fields &&
								(fields.texts.length > 0 || fields.variables.length > 0) ? (
									<section className="flex flex-col gap-2">
										<p className="font-medium text-sm">
											Textos da arte — {DESTINATION_LABEL[current]}
										</p>
										{fields.texts.map((field) => (
											<TextField
												key={`${selection.templateId}-${field.elementId}`}
												id={`${baseId}-t-${field.elementId}`}
												label={field.label}
												hint={
													field.overridden ? "trocado nesta publicação" : null
												}
												value={field.value}
												multiline
												disabled={!editable || busy}
												onChange={(value) =>
													onInputsChange({
														...inputs,
														[current]: inputsAfterTextEdit(
															selection,
															content,
															field.elementId,
															value,
														),
													})
												}
											/>
										))}
										{fields.variables.map((field) => (
											<TextField
												key={`${selection.templateId}-v-${field.key}`}
												id={`${baseId}-v-${field.key}`}
												label={field.label}
												hint={field.changed ? null : "valor padrão"}
												value={field.value}
												multiline={field.multiline}
												disabled={!editable || busy}
												onChange={(value) =>
													onInputsChange({
														...inputs,
														[current]: inputsAfterVariableEdit(
															selection,
															field.key,
															value,
														),
													})
												}
											/>
										))}
									</section>
								) : null}

								{showsCaption ? (
									<section className="flex flex-col gap-2">
										<Label htmlFor={`${baseId}-caption`} className="text-sm">
											Legenda
										</Label>
										<Textarea
											id={`${baseId}-caption`}
											rows={7}
											value={caption}
											disabled={!editable || busy}
											onChange={(event) => onCaptionChange(event.target.value)}
										/>
										{counter ? (
											<p
												className={cn(
													"text-xs tabular-nums",
													counter.over || counter.hashtagsOver
														? "font-medium text-destructive"
														: "text-muted-foreground",
												)}
											>
												{counter.length}/{counter.max} caracteres ·{" "}
												{counter.hashtags}/{counter.hashtagMax} hashtags
											</p>
										) : null}
									</section>
								) : (
									<p className="text-muted-foreground text-xs">
										Nos Stories não há legenda: o que se lê é o que está na
										arte.
									</p>
								)}
							</div>
						</div>
					</div>
				)}

				<DialogFooter className="gap-2">
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Fechar
					</Button>
					{editable ? (
						<>
							<Button
								variant="outline"
								disabled={busy || destinations.length === 0}
								onClick={() => onSubmit(false)}
							>
								{hasPost ? "Atualizar rascunho" : "Salvar como rascunho"}
							</Button>
							<Button
								disabled={
									busy ||
									destinations.length === 0 ||
									!canApprove ||
									caption.trim() === ""
								}
								onClick={() => onSubmit(true)}
							>
								Aprovar e publicar nas redes
							</Button>
						</>
					) : null}
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

function TextField({
	id,
	label,
	hint = null,
	value,
	multiline,
	disabled,
	onChange,
}: {
	id: string;
	label: string;
	hint?: string | null;
	value: string;
	multiline: boolean;
	disabled: boolean;
	onChange: (value: string) => void;
}) {
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
					value={value}
					disabled={disabled}
					onChange={(event) => onChange(event.target.value)}
				/>
			) : (
				<Input
					id={id}
					value={value}
					disabled={disabled}
					onChange={(event) => onChange(event.target.value)}
				/>
			)}
		</div>
	);
}

/** Sem padrão, a rede recebe a capa: no feed quadrada, no story inteira. */
function CoverPreview({
	mediaId,
	story,
}: {
	mediaId: string | null;
	story: boolean;
}) {
	const asset = useQuery({
		...trpc.media.get.queryOptions({ id: mediaId ?? "" }),
		enabled: mediaId !== null,
	});
	return (
		<div
			className={cn(
				"w-full overflow-hidden rounded-md border bg-muted",
				story ? "aspect-[9/16]" : "aspect-square",
			)}
		>
			{asset.data ? (
				<AssetImage
					src={asset.data.url}
					alt={asset.data.altText ?? ""}
					className={cn("size-full", story ? "object-contain" : "object-cover")}
				/>
			) : (
				<p className="flex size-full items-center justify-center p-4 text-center text-muted-foreground text-xs">
					{mediaId ? "Carregando a capa…" : "A matéria não tem capa."}
				</p>
			)}
		</div>
	);
}
