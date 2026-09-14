"use client";

import {
	ART_FORMATS,
	type ArtFormat,
	type Box,
	canvasOf,
	DESTINATION_LABEL,
	formatServes,
	SOCIAL_DESTINATIONS,
	type SocialDestination,
	TEMPLATE_FONT_FAMILIES,
	TEMPLATE_FONTS,
	TEXT_SOURCES,
	type TemplateFontFamily,
	type TemplateLayer,
	type TextLayer,
	type TextSource,
	type TextStyle,
	templateProblems,
} from "@portal-app/social";
import { Button } from "@portal-app/ui/components/button";
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
import { Textarea } from "@portal-app/ui/components/textarea";
import { cn } from "@portal-app/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	ArrowDown,
	ArrowLeft,
	ArrowUp,
	Copy,
	ImageIcon,
	Loader2,
	Square,
	Trash2,
	Type,
	UserSquare,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import {
	type KeyboardEvent,
	type PointerEvent,
	useEffect,
	useRef,
	useState,
} from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { AssetImage } from "@/components/media/asset-image";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { trpc } from "@/utils/trpc";

import {
	addLayer,
	coversMostOfCanvas,
	duplicateLayer,
	fitScale,
	HANDLES,
	type Handle,
	LAYER_KIND_LABEL,
	type LayerKind,
	layerLabel,
	moveBox,
	moveLayer,
	newLayer,
	removeLayer,
	rescaleLayers,
	resizeBox,
	SAMPLE_CONTENT,
	SHORT_SAMPLE_HEADLINE,
	snapBox,
	TEXT_SOURCE_LABEL,
	toCanvas,
	updateLayer,
	withFontFamily,
} from "./template-editor-model";

/** A quantos pixels DE TELA da guia a caixa arrastada encosta nela. */
const SNAP_SCREEN_PIXELS = 8;

type Drag = {
	id: string;
	handle: Handle | null;
	startX: number;
	startY: number;
	startBox: Box;
};

type Picking =
	| { mode: "add-image" }
	| { mode: "replace-image"; layerId: string }
	| { mode: "sample-photo" }
	| null;

const newId = () => crypto.randomUUID().slice(0, 8);

/**
 * O editor visual de um padrão (spec 09, F4).
 *
 * **O quadro do meio é a prévia REAL** — o PNG que o servidor desenha com o
 * mesmo código da arte publicada (D5). Por cima dele, caixas HTML marcam onde
 * cada camada está e se arrastam e redimensionam. As caixas mexem na hora; a
 * prévia chega meio segundo depois de a mão parar. É a troca certa: arrastar
 * tem de ser imediato, e o desenho só vale quando é o de verdade.
 *
 * Os problemas do padrão são calculados AQUI, pelo mesmo `templateProblems` do
 * domínio, a cada mudança — aparecem enquanto se monta, não no clique de salvar.
 */
export function TemplateEditor({
	id,
	canDesign,
}: {
	id: string;
	canDesign: boolean;
}) {
	const queryClient = useQueryClient();
	const saved = useQuery(trpc.social.templates.get.queryOptions({ id }));

	const [loaded, setLoaded] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [name, setName] = useState("");
	const [format, setFormat] = useState<ArtFormat>("4:5");
	const [layers, setLayers] = useState<TemplateLayer[]>([]);
	const [selectedId, setSelectedId] = useState<string | null>(null);
	const [sample, setSample] = useState(SAMPLE_CONTENT);
	const [samplePhotoId, setSamplePhotoId] = useState<string | null>(null);
	const [picking, setPicking] = useState<Picking>(null);
	const [image, setImage] = useState<string | null>(null);
	const [warnings, setWarnings] = useState<string[]>([]);

	useEffect(() => {
		if (saved.data && !loaded) {
			setName(saved.data.name);
			setFormat(saved.data.format);
			setLayers([...saved.data.layers]);
			setLoaded(true);
		}
	}, [saved.data, loaded]);

	/** Toda mudança de desenho passa por aqui: marca que há o que salvar. */
	const changeLayers = (
		change: (current: TemplateLayer[]) => TemplateLayer[],
	) => {
		if (!canDesign) {
			return;
		}
		setLayers(change);
		setDirty(true);
	};

	const canvas = canvasOf(format);
	const problems = loaded
		? templateProblems({
				name,
				format,
				layers,
				defaultFor: saved.data?.defaultFor ?? [],
			})
		: [];
	const selected = layers.find((layer) => layer.id === selectedId) ?? null;

	// ── prévia ────────────────────────────────────────────────────────────────

	const preview = useMutation(trpc.social.templates.preview.mutationOptions());
	const previewKey = JSON.stringify({ format, layers, sample, samplePhotoId });

	// Redesenha meio segundo depois da última mudança. Depender da CHAVE e não
	// dos objetos é o que evita pedir um desenho a cada render.
	// biome-ignore lint/correctness/useExhaustiveDependencies: ver acima
	useEffect(() => {
		if (!loaded) {
			return;
		}
		const timer = setTimeout(() => {
			preview.mutate(
				{
					name,
					format,
					layers,
					content: sample,
					photoMediaId: samplePhotoId,
					width: 540,
				},
				{
					onSuccess: (data) => {
						// Padrão inválido não desenha: fica a última prévia boa, e os
						// problemas aparecem na lista.
						if (data.image) {
							setImage(data.image);
						}
						setWarnings(data.warnings);
					},
				},
			);
		}, 450);
		return () => clearTimeout(timer);
	}, [previewKey, loaded]);

	// ── salvar e padrão de destino ────────────────────────────────────────────

	const refresh = async () => {
		await queryClient.invalidateQueries({
			queryKey: trpc.social.templates.list.queryKey(),
		});
	};

	const update = useMutation(
		trpc.social.templates.update.mutationOptions({
			onSuccess: async (dto) => {
				queryClient.setQueryData(
					trpc.social.templates.get.queryKey({ id }),
					dto,
				);
				setDirty(false);
				toast.success(`Padrão salvo — versão ${dto.version}.`);
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const setDefaults = useMutation(
		trpc.social.templates.setDefaults.mutationOptions({
			onSuccess: async (dto) => {
				queryClient.setQueryData(
					trpc.social.templates.get.queryKey({ id }),
					dto,
				);
				toast.success("Padrão de destino atualizado.");
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	// ── arrastar e redimensionar ──────────────────────────────────────────────

	// A área é guardada em ESTADO (ref de callback), e não num `useRef`: o quadro
	// só aparece depois que o padrão carrega, e um efeito montado no primeiro
	// render encontraria o ref vazio e nunca mediria — o quadro sairia em escala
	// 1, com 1080 px de largura, por cima da página inteira.
	const [stageArea, setStageArea] = useState<HTMLDivElement | null>(null);
	const [available, setAvailable] = useState({ width: 0, height: 0 });
	useEffect(() => {
		if (!stageArea) {
			return;
		}
		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				setAvailable({
					width: entry.contentRect.width,
					height: entry.contentRect.height,
				});
			}
		});
		observer.observe(stageArea);
		return () => observer.disconnect();
	}, [stageArea]);
	// Sem medida ainda, escala zero: o quadro não aparece em vez de aparecer
	// gigante por um instante.
	const scale =
		available.width > 0 && available.height > 0
			? fitScale(canvas, available)
			: 0;

	const drag = useRef<Drag | null>(null);

	const startDrag = (
		event: PointerEvent<HTMLElement>,
		layer: TemplateLayer,
		handle: Handle | null,
	) => {
		setSelectedId(layer.id);
		if (!canDesign) {
			return;
		}
		event.stopPropagation();
		event.currentTarget.setPointerCapture(event.pointerId);
		drag.current = {
			id: layer.id,
			handle,
			startX: event.clientX,
			startY: event.clientY,
			startBox: layer.box,
		};
	};

	const onDrag = (event: PointerEvent<HTMLElement>) => {
		const current = drag.current;
		if (!current) {
			return;
		}
		const dx = toCanvas(event.clientX - current.startX, scale);
		const dy = toCanvas(event.clientY - current.startY, scale);
		const box = current.handle
			? resizeBox(current.startBox, current.handle, dx, dy)
			: snapBox(
					moveBox(current.startBox, dx, dy),
					canvas,
					toCanvas(SNAP_SCREEN_PIXELS, scale),
				);
		changeLayers((prev) =>
			updateLayer(
				prev,
				current.id,
				(layer) => ({ ...layer, box }) as TemplateLayer,
			),
		);
	};

	const endDrag = (event: PointerEvent<HTMLElement>) => {
		drag.current = null;
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
	};

	/** Setas movem 1 px (10 com Shift); Delete remove. */
	const onBoxKey = (
		event: KeyboardEvent<HTMLElement>,
		layer: TemplateLayer,
	) => {
		const step = event.shiftKey ? 10 : 1;
		const moves: Record<string, [number, number]> = {
			ArrowLeft: [-step, 0],
			ArrowRight: [step, 0],
			ArrowUp: [0, -step],
			ArrowDown: [0, step],
		};
		const move = moves[event.key];
		if (move) {
			event.preventDefault();
			changeLayers((prev) =>
				updateLayer(
					prev,
					layer.id,
					(item) =>
						({
							...item,
							box: moveBox(item.box, move[0], move[1]),
						}) as TemplateLayer,
				),
			);
		} else if (event.key === "Delete" || event.key === "Backspace") {
			event.preventDefault();
			changeLayers((prev) => removeLayer(prev, layer.id));
			setSelectedId(null);
		}
	};

	// ── camadas ───────────────────────────────────────────────────────────────

	const add = (kind: LayerKind, mediaId?: string) => {
		const layer = newLayer(kind, format, newId(), { mediaId });
		changeLayers((prev) => addLayer(prev, layer));
		setSelectedId(layer.id);
	};

	const patchSelected = (change: (layer: TemplateLayer) => TemplateLayer) => {
		if (!selected) {
			return;
		}
		changeLayers((prev) => updateLayer(prev, selected.id, change));
	};

	const patchStyle = (change: (style: TextStyle) => TextStyle) =>
		patchSelected((layer) =>
			layer.kind === "TEXT" ? { ...layer, style: change(layer.style) } : layer,
		);

	if (saved.isLoading) {
		return (
			<div className="flex flex-col gap-4">
				<Skeleton className="h-10 w-1/3" />
				<Skeleton className="h-[70vh] w-full" />
			</div>
		);
	}
	if (!saved.data) {
		return <p className="text-muted-foreground">Padrão não encontrado.</p>;
	}

	const hasPhoto = layers.some((layer) => layer.kind === "PHOTO");
	const stack = [...layers].reverse();

	return (
		<>
			<PageHeader
				title={name || "Padrão sem nome"}
				description={`Formato ${format} · ${canvas.width}×${canvas.height} px · versão ${saved.data.version}${saved.data.archived ? " · arquivado" : ""}`}
				actions={
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							nativeButton={false}
							render={<Link href={"/dashboard/social?aba=padroes" as Route} />}
						>
							<ArrowLeft className="size-4" />
							Padrões
						</Button>
						{canDesign ? (
							<Button
								disabled={
									!dirty ||
									problems.length > 0 ||
									update.isPending ||
									saved.data.archived
								}
								onClick={() => update.mutate({ id, name, format, layers })}
							>
								{update.isPending ? (
									<Loader2 className="size-4 animate-spin" />
								) : null}
								{dirty ? "Salvar padrão" : "Salvo"}
							</Button>
						) : null}
					</div>
				}
			/>

			<div className="grid gap-4 xl:grid-cols-[260px_minmax(0,1fr)_320px]">
				{/* ---------------- Camadas ---------------- */}
				<aside className="flex flex-col gap-3 rounded-lg border bg-card p-3">
					<p className="font-medium text-sm">Camadas</p>
					{canDesign ? (
						<div className="grid grid-cols-2 gap-2">
							<Button variant="outline" size="sm" onClick={() => add("TEXT")}>
								<Type className="size-4" />
								Texto
							</Button>
							<Button variant="outline" size="sm" onClick={() => add("SHAPE")}>
								<Square className="size-4" />
								Forma
							</Button>
							<Button
								variant="outline"
								size="sm"
								onClick={() => setPicking({ mode: "add-image" })}
							>
								<ImageIcon className="size-4" />
								Imagem
							</Button>
							<Button
								variant="outline"
								size="sm"
								disabled={hasPhoto}
								onClick={() => add("PHOTO")}
							>
								<UserSquare className="size-4" />
								Foto
							</Button>
						</div>
					) : null}

					{stack.length === 0 ? (
						<p className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-xs">
							Nenhuma camada. Comece pela foto e pela moldura.
						</p>
					) : (
						<ul className="flex flex-col gap-1">
							{stack.map((layer) => (
								<li
									key={layer.id}
									className={cn(
										"flex items-center gap-1 rounded-md border px-2 py-1",
										layer.id === selectedId && "border-primary bg-primary/5",
									)}
								>
									<button
										type="button"
										className="min-w-0 flex-1 truncate text-left text-sm"
										onClick={() => setSelectedId(layer.id)}
									>
										{layerLabel(layer)}
									</button>
									{canDesign ? (
										<>
											<IconButton
												label="Trazer para frente"
												onClick={() =>
													changeLayers((prev) =>
														moveLayer(prev, layer.id, "up"),
													)
												}
											>
												<ArrowUp className="size-3.5" />
											</IconButton>
											<IconButton
												label="Levar para trás"
												onClick={() =>
													changeLayers((prev) =>
														moveLayer(prev, layer.id, "down"),
													)
												}
											>
												<ArrowDown className="size-3.5" />
											</IconButton>
											{layer.kind !== "PHOTO" ? (
												<IconButton
													label="Duplicar camada"
													onClick={() =>
														changeLayers((prev) =>
															duplicateLayer(prev, layer.id, newId()),
														)
													}
												>
													<Copy className="size-3.5" />
												</IconButton>
											) : null}
											<IconButton
												label="Remover camada"
												onClick={() => {
													changeLayers((prev) => removeLayer(prev, layer.id));
													if (selectedId === layer.id) {
														setSelectedId(null);
													}
												}}
											>
												<Trash2 className="size-3.5" />
											</IconButton>
										</>
									) : null}
								</li>
							))}
						</ul>
					)}
					<p className="text-muted-foreground text-xs">
						A lista vai de cima (na frente) para baixo (no fundo). Setas movem a
						caixa selecionada no quadro; Shift move 10 px.
					</p>
				</aside>

				{/* ---------------- Quadro ---------------- */}
				<section className="flex min-w-0 flex-col gap-3">
					<div
						ref={setStageArea}
						className="flex h-[calc(100vh-15rem)] min-h-96 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 p-4"
					>
						<div
							className="relative overflow-hidden bg-[length:24px_24px] bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)] shadow-lg"
							style={{
								width: canvas.width * scale,
								height: canvas.height * scale,
							}}
							onPointerDown={() => setSelectedId(null)}
						>
							{image ? (
								// Prévia gerada pelo servidor, em data URL — não é mídia da
								// biblioteca, então não passa pelo AssetImage.
								<img
									src={image}
									alt="Prévia do padrão"
									className="absolute inset-0 size-full select-none"
									draggable={false}
								/>
							) : null}
							{preview.isPending ? (
								<span className="absolute top-2 right-2 flex items-center gap-1 rounded bg-black/60 px-2 py-0.5 text-[11px] text-white">
									<Loader2 className="size-3 animate-spin" />
									desenhando
								</span>
							) : null}

							{layers.map((layer) => {
								const isSelected = layer.id === selectedId;
								const passThrough =
									!isSelected && coversMostOfCanvas(layer.box, canvas);
								return (
									<button
										type="button"
										key={layer.id}
										aria-label={layerLabel(layer)}
										aria-pressed={isSelected}
										className={cn(
											"absolute appearance-none bg-transparent p-0 outline-none",
											isSelected
												? "z-10 border-2 border-sky-500"
												: "border border-white/70 border-dashed hover:border-sky-400",
											passThrough && "pointer-events-none",
											canDesign && "cursor-move",
										)}
										style={{
											left: layer.box.x * scale,
											top: layer.box.y * scale,
											width: layer.box.width * scale,
											height: layer.box.height * scale,
										}}
										onPointerDown={(event) => startDrag(event, layer, null)}
										onPointerMove={onDrag}
										onPointerUp={endDrag}
										onPointerCancel={endDrag}
										onFocus={() => setSelectedId(layer.id)}
										onKeyDown={(event) => onBoxKey(event, layer)}
									>
										{isSelected && canDesign
											? HANDLES.map((handle) => (
													<span
														key={handle}
														aria-hidden
														className={cn(
															"absolute size-3 rounded-sm border-2 border-sky-500 bg-white",
															HANDLE_POSITION[handle],
														)}
														onPointerDown={(event) =>
															startDrag(event, layer, handle)
														}
														onPointerMove={onDrag}
														onPointerUp={endDrag}
														onPointerCancel={endDrag}
													/>
												))
											: null}
									</button>
								);
							})}
						</div>
					</div>

					{problems.length > 0 || warnings.length > 0 ? (
						<div className="flex gap-3 rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900 text-sm dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
							<AlertTriangle className="mt-0.5 size-4 shrink-0" />
							<ul className="list-disc space-y-0.5 pl-4">
								{[...problems, ...warnings].map((message) => (
									<li key={message}>{message}</li>
								))}
							</ul>
						</div>
					) : null}
				</section>

				{/* ---------------- Propriedades ---------------- */}
				<aside className="flex flex-col gap-4 rounded-lg border bg-card p-3">
					{selected ? (
						<LayerProperties
							layer={selected}
							canvasFormat={format}
							disabled={!canDesign}
							onChange={patchSelected}
							onStyle={patchStyle}
							onPickImage={() =>
								setPicking({ mode: "replace-image", layerId: selected.id })
							}
							onClose={() => setSelectedId(null)}
						/>
					) : (
						<>
							<div className="flex flex-col gap-2">
								<Label htmlFor="template-name">Nome do padrão</Label>
								<Input
									id="template-name"
									value={name}
									disabled={!canDesign}
									onChange={(event) => {
										setName(event.target.value);
										setDirty(true);
									}}
								/>
							</div>

							<ChoiceField
								label="Formato"
								value={format}
								disabled={!canDesign}
								options={ART_FORMATS.map((item) => ({
									value: item,
									label: FORMAT_LABEL[item],
								}))}
								onChange={(value) => {
									const next = value as ArtFormat;
									changeLayers((prev) => rescaleLayers(prev, format, next));
									setFormat(next);
								}}
							/>

							<div className="flex flex-col gap-2 border-t pt-3">
								<p className="font-medium text-sm">Padrão de</p>
								{SOCIAL_DESTINATIONS.map((destination) => {
									const current = saved.data?.defaultFor ?? [];
									const checked = current.includes(destination);
									const compatible = formatServes(
										saved.data?.format ?? format,
										destination,
									);
									return (
										<label
											key={destination}
											className={cn(
												"flex items-center gap-2 text-sm",
												(!compatible || !canDesign) && "opacity-50",
											)}
										>
											<input
												type="checkbox"
												checked={checked}
												disabled={
													!compatible || !canDesign || setDefaults.isPending
												}
												onChange={() =>
													setDefaults.mutate({
														id,
														destinations: checked
															? current.filter((item) => item !== destination)
															: [...current, destination as SocialDestination],
													})
												}
											/>
											{DESTINATION_LABEL[destination]}
										</label>
									);
								})}
								<p className="text-muted-foreground text-xs">
									O post automático de cada matéria nasce com o padrão do
									destino. Vale o formato SALVO: Stories pedem 9:16.
								</p>
							</div>

							<div className="flex flex-col gap-2 border-t pt-3">
								<p className="font-medium text-sm">Testar com</p>
								<Textarea
									rows={3}
									value={sample.headline}
									onChange={(event) =>
										setSample({ ...sample, headline: event.target.value })
									}
									aria-label="Título de exemplo"
								/>
								<div className="flex gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											setSample({
												...sample,
												headline: SAMPLE_CONTENT.headline,
											})
										}
									>
										Título longo
									</Button>
									<Button
										variant="outline"
										size="sm"
										onClick={() =>
											setSample({ ...sample, headline: SHORT_SAMPLE_HEADLINE })
										}
									>
										Título curto
									</Button>
								</div>
								<Input
									value={sample.kicker ?? ""}
									placeholder="Chapéu"
									onChange={(event) =>
										setSample({ ...sample, kicker: event.target.value })
									}
									aria-label="Chapéu de exemplo"
								/>
								<Input
									value={sample.sectionName ?? ""}
									placeholder="Editoria"
									onChange={(event) =>
										setSample({ ...sample, sectionName: event.target.value })
									}
									aria-label="Editoria de exemplo"
								/>
								<div className="flex items-center gap-2">
									<Button
										variant="outline"
										size="sm"
										onClick={() => setPicking({ mode: "sample-photo" })}
									>
										<UserSquare className="size-4" />
										{samplePhotoId ? "Trocar foto" : "Foto de exemplo"}
									</Button>
									{samplePhotoId ? (
										<Button
											variant="ghost"
											size="sm"
											onClick={() => setSamplePhotoId(null)}
										>
											Sem foto
										</Button>
									) : null}
								</div>
							</div>
						</>
					)}
				</aside>
			</div>

			<MediaPickerDialog
				open={picking !== null}
				onOpenChange={(open) => !open && setPicking(null)}
				title={
					picking?.mode === "sample-photo"
						? "Foto de exemplo"
						: "Imagem da camada (moldura, logo, selo)"
				}
				onSelect={(mediaId) => {
					if (picking?.mode === "add-image") {
						add("IMAGE", mediaId);
					} else if (picking?.mode === "replace-image") {
						changeLayers((prev) =>
							updateLayer(prev, picking.layerId, (layer) =>
								layer.kind === "IMAGE" ? { ...layer, mediaId } : layer,
							),
						);
					} else if (picking?.mode === "sample-photo") {
						setSamplePhotoId(mediaId);
					}
					setPicking(null);
				}}
			/>
		</>
	);
}

const FORMAT_LABEL: Record<ArtFormat, string> = {
	"1:1": "1:1 — quadrado (feed)",
	"4:5": "4:5 — retrato (feed)",
	"9:16": "9:16 — tela cheia (Stories)",
};

const HANDLE_POSITION: Record<Handle, string> = {
	nw: "-top-1.5 -left-1.5 cursor-nwse-resize",
	n: "-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
	ne: "-top-1.5 -right-1.5 cursor-nesw-resize",
	e: "top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize",
	se: "-right-1.5 -bottom-1.5 cursor-nwse-resize",
	s: "-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize",
	sw: "-bottom-1.5 -left-1.5 cursor-nesw-resize",
	w: "top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize",
};

// ── painel de propriedades ──────────────────────────────────────────────────

function LayerProperties({
	layer,
	canvasFormat,
	disabled,
	onChange,
	onStyle,
	onPickImage,
	onClose,
}: {
	layer: TemplateLayer;
	canvasFormat: ArtFormat;
	disabled: boolean;
	onChange: (change: (layer: TemplateLayer) => TemplateLayer) => void;
	onStyle: (change: (style: TextStyle) => TextStyle) => void;
	onPickImage: () => void;
	onClose: () => void;
}) {
	const setBox = (patch: Partial<Box>) =>
		onChange(
			(current) =>
				({
					...current,
					box: { ...current.box, ...patch },
				}) as TemplateLayer,
		);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex items-center justify-between">
				<p className="font-medium text-sm">{LAYER_KIND_LABEL[layer.kind]}</p>
				<Button variant="ghost" size="sm" onClick={onClose}>
					Fechar
				</Button>
			</div>

			<div className="grid grid-cols-2 gap-2">
				<NumberField
					label="X"
					value={layer.box.x}
					disabled={disabled}
					onChange={(x) => setBox({ x })}
				/>
				<NumberField
					label="Y"
					value={layer.box.y}
					disabled={disabled}
					onChange={(y) => setBox({ y })}
				/>
				<NumberField
					label="Largura"
					value={layer.box.width}
					min={1}
					disabled={disabled}
					onChange={(width) => setBox({ width })}
				/>
				<NumberField
					label="Altura"
					value={layer.box.height}
					min={1}
					disabled={disabled}
					onChange={(height) => setBox({ height })}
				/>
			</div>
			<p className="-mt-2 text-muted-foreground text-xs">
				Em pixels da arte ({canvasOf(canvasFormat).width}×
				{canvasOf(canvasFormat).height}).
			</p>

			{layer.kind === "PHOTO" ? (
				<p className="text-muted-foreground text-sm">
					Aqui entra a foto de cada post, cortada no ponto focal para caber na
					caixa.
				</p>
			) : null}

			{layer.kind === "IMAGE" ? (
				<ImageLayerFields
					mediaId={layer.mediaId}
					fit={layer.fit}
					disabled={disabled}
					onPick={onPickImage}
					onFit={(fit) =>
						onChange((current) =>
							current.kind === "IMAGE" ? { ...current, fit } : current,
						)
					}
				/>
			) : null}

			{layer.kind === "SHAPE" ? (
				<div className="flex flex-col gap-3">
					<ColorField
						label="Cor"
						value={layer.color}
						disabled={disabled}
						onChange={(color) =>
							onChange((current) =>
								current.kind === "SHAPE" ? { ...current, color } : current,
							)
						}
					/>
					<div className="grid grid-cols-2 gap-2">
						<NumberField
							label="Arredondar"
							value={layer.radius}
							min={0}
							disabled={disabled}
							onChange={(radius) =>
								onChange((current) =>
									current.kind === "SHAPE" ? { ...current, radius } : current,
								)
							}
						/>
						<NumberField
							label="Opacidade (%)"
							value={Math.round(layer.opacity * 100)}
							min={0}
							max={100}
							disabled={disabled}
							onChange={(percent) =>
								onChange((current) =>
									current.kind === "SHAPE"
										? { ...current, opacity: percent / 100 }
										: current,
								)
							}
						/>
					</div>
				</div>
			) : null}

			{layer.kind === "TEXT" ? (
				<TextLayerFields
					layer={layer}
					disabled={disabled}
					onChange={onChange}
					onStyle={onStyle}
				/>
			) : null}
		</div>
	);
}

function ImageLayerFields({
	mediaId,
	fit,
	disabled,
	onPick,
	onFit,
}: {
	mediaId: string;
	fit: "cover" | "contain";
	disabled: boolean;
	onPick: () => void;
	onFit: (fit: "cover" | "contain") => void;
}) {
	const asset = useQuery({
		...trpc.media.get.queryOptions({ id: mediaId }),
		enabled: mediaId !== "",
	});
	return (
		<div className="flex flex-col gap-3">
			<div className="flex items-center gap-3">
				<div className="size-16 shrink-0 overflow-hidden rounded border bg-[length:12px_12px] bg-[repeating-conic-gradient(#e5e7eb_0_25%,#fff_0_50%)]">
					{asset.data ? (
						<AssetImage
							src={asset.data.url}
							alt={asset.data.altText ?? ""}
							className="size-full object-contain"
						/>
					) : null}
				</div>
				<Button
					variant="outline"
					size="sm"
					disabled={disabled}
					onClick={onPick}
				>
					{mediaId ? "Trocar imagem" : "Escolher imagem"}
				</Button>
			</div>
			<ChoiceField
				label="Encaixe"
				value={fit}
				disabled={disabled}
				options={[
					{ value: "cover", label: "Preencher a caixa (corta)" },
					{ value: "contain", label: "Caber inteira na caixa" },
				]}
				onChange={(value) => onFit(value as "cover" | "contain")}
			/>
			<p className="text-muted-foreground text-xs">
				Use PNG com transparência para molduras: o que é transparente deixa ver
				a foto por baixo.
			</p>
		</div>
	);
}

function TextLayerFields({
	layer,
	disabled,
	onChange,
	onStyle,
}: {
	layer: TextLayer;
	disabled: boolean;
	onChange: (change: (layer: TemplateLayer) => TemplateLayer) => void;
	onStyle: (change: (style: TextStyle) => TextStyle) => void;
}) {
	const { style } = layer;
	const font = TEMPLATE_FONTS[style.fontFamily];
	const setText = (patch: Partial<Pick<TextLayer, "source" | "text">>) =>
		onChange((current) =>
			current.kind === "TEXT" ? { ...current, ...patch } : current,
		);

	return (
		<div className="flex flex-col gap-3">
			<ChoiceField
				label="Conteúdo"
				value={layer.source}
				disabled={disabled}
				options={TEXT_SOURCES.map((source) => ({
					value: source,
					label: TEXT_SOURCE_LABEL[source],
				}))}
				onChange={(value) => setText({ source: value as TextSource })}
			/>
			{layer.source === "STATIC" ? (
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={`texto-${layer.id}`}>Texto</Label>
					<Textarea
						id={`texto-${layer.id}`}
						rows={2}
						value={layer.text}
						disabled={disabled}
						onChange={(event) => setText({ text: event.target.value })}
					/>
				</div>
			) : (
				<p className="text-muted-foreground text-xs">
					Vem da matéria de cada post — e a redação pode trocar o texto no
					próprio post, sem mexer no padrão.
				</p>
			)}

			<ChoiceField
				label="Fonte"
				value={style.fontFamily}
				disabled={disabled}
				options={TEMPLATE_FONT_FAMILIES.map((family) => ({
					value: family,
					label: family,
				}))}
				onChange={(value) =>
					onStyle((current) =>
						withFontFamily(current, value as TemplateFontFamily),
					)
				}
			/>
			<div className="grid grid-cols-2 gap-2">
				<ChoiceField
					label="Peso"
					value={String(style.fontWeight)}
					disabled={disabled}
					options={font.weights.map((weight) => ({
						value: String(weight),
						label: WEIGHT_LABEL[weight] ?? String(weight),
					}))}
					onChange={(value) =>
						onStyle((current) => ({ ...current, fontWeight: Number(value) }))
					}
				/>
				<ColorField
					label="Cor"
					value={style.color}
					disabled={disabled}
					onChange={(color) => onStyle((current) => ({ ...current, color }))}
				/>
			</div>
			<div className="flex flex-wrap gap-x-4 gap-y-2 text-sm">
				<CheckField
					label="Itálico"
					checked={style.italic}
					disabled={disabled || !font.italic}
					onChange={(italic) => onStyle((current) => ({ ...current, italic }))}
				/>
				<CheckField
					label="Caixa-alta"
					checked={style.uppercase}
					disabled={disabled}
					onChange={(uppercase) =>
						onStyle((current) => ({ ...current, uppercase }))
					}
				/>
			</div>
			<div className="grid grid-cols-2 gap-2">
				<NumberField
					label="Tamanho"
					value={style.fontSize}
					min={8}
					max={400}
					disabled={disabled}
					onChange={(fontSize) =>
						onStyle((current) => ({ ...current, fontSize }))
					}
				/>
				<NumberField
					label="Mínimo"
					value={style.minFontSize}
					min={8}
					disabled={disabled}
					onChange={(minFontSize) =>
						onStyle((current) => ({ ...current, minFontSize }))
					}
				/>
				<NumberField
					label="Entrelinha"
					value={style.lineHeight}
					min={0.8}
					max={2}
					step={0.05}
					disabled={disabled}
					onChange={(lineHeight) =>
						onStyle((current) => ({ ...current, lineHeight }))
					}
				/>
				<NumberField
					label="Máx. de linhas"
					value={style.maxLines}
					min={1}
					max={12}
					disabled={disabled}
					onChange={(maxLines) =>
						onStyle((current) => ({ ...current, maxLines }))
					}
				/>
			</div>
			<p className="-mt-1 text-muted-foreground text-xs">
				O texto encolhe do tamanho até o mínimo para caber na caixa. Se nem
				assim couber, sai cortado — e a tela avisa.
			</p>
			<div className="grid grid-cols-2 gap-2">
				<ChoiceField
					label="Alinhar"
					value={style.align}
					disabled={disabled}
					options={[
						{ value: "left", label: "À esquerda" },
						{ value: "center", label: "Ao centro" },
						{ value: "right", label: "À direita" },
					]}
					onChange={(value) =>
						onStyle((current) => ({
							...current,
							align: value as TextStyle["align"],
						}))
					}
				/>
				<ChoiceField
					label="Na vertical"
					value={style.verticalAlign}
					disabled={disabled}
					options={[
						{ value: "top", label: "Em cima" },
						{ value: "middle", label: "No meio" },
						{ value: "bottom", label: "Embaixo" },
					]}
					onChange={(value) =>
						onStyle((current) => ({
							...current,
							verticalAlign: value as TextStyle["verticalAlign"],
						}))
					}
				/>
			</div>

			<div className="flex flex-col gap-2 border-t pt-3">
				<CheckField
					label="Fundo atrás do texto (pílula)"
					checked={style.background !== null}
					disabled={disabled}
					onChange={(on) =>
						onStyle((current) => ({
							...current,
							background: on
								? { color: "#ffffff", radius: 24, paddingX: 24, paddingY: 8 }
								: null,
						}))
					}
				/>
				{style.background ? (
					<>
						<ColorField
							label="Cor do fundo"
							value={style.background.color}
							disabled={disabled}
							onChange={(color) =>
								onStyle((current) =>
									current.background
										? {
												...current,
												background: { ...current.background, color },
											}
										: current,
								)
							}
						/>
						<div className="grid grid-cols-3 gap-2">
							<NumberField
								label="Arredondar"
								value={style.background.radius}
								min={0}
								disabled={disabled}
								onChange={(radius) =>
									onStyle((current) =>
										current.background
											? {
													...current,
													background: { ...current.background, radius },
												}
											: current,
									)
								}
							/>
							<NumberField
								label="Respiro lateral"
								value={style.background.paddingX}
								min={0}
								disabled={disabled}
								onChange={(paddingX) =>
									onStyle((current) =>
										current.background
											? {
													...current,
													background: { ...current.background, paddingX },
												}
											: current,
									)
								}
							/>
							<NumberField
								label="Respiro vertical"
								value={style.background.paddingY}
								min={0}
								disabled={disabled}
								onChange={(paddingY) =>
									onStyle((current) =>
										current.background
											? {
													...current,
													background: { ...current.background, paddingY },
												}
											: current,
									)
								}
							/>
						</div>
					</>
				) : null}
			</div>
		</div>
	);
}

const WEIGHT_LABEL: Record<number, string> = {
	400: "Regular",
	500: "Médio",
	600: "Seminegrito",
	700: "Negrito",
	800: "Extranegrito",
	900: "Black",
};

// ── campos ──────────────────────────────────────────────────────────────────

function IconButton({
	label,
	onClick,
	children,
}: {
	label: string;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Button
			type="button"
			variant="ghost"
			size="icon"
			className="size-7"
			aria-label={label}
			title={label}
			onClick={onClick}
		>
			{children}
		</Button>
	);
}

function NumberField({
	label,
	value,
	onChange,
	min,
	max,
	step = 1,
	disabled,
}: {
	label: string;
	value: number;
	onChange: (value: number) => void;
	min?: number;
	max?: number;
	step?: number;
	disabled?: boolean;
}) {
	const id = `num-${label.replace(/\W+/g, "-")}`;
	return (
		<div className="flex flex-col gap-1">
			<Label htmlFor={id} className="text-xs">
				{label}
			</Label>
			<Input
				id={id}
				type="number"
				value={Number.isFinite(value) ? value : 0}
				min={min}
				max={max}
				step={step}
				disabled={disabled}
				onChange={(event) => {
					const next = Number.parseFloat(event.target.value);
					if (Number.isFinite(next)) {
						onChange(next);
					}
				}}
			/>
		</div>
	);
}

function ColorField({
	label,
	value,
	onChange,
	disabled,
}: {
	label: string;
	value: string;
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	const id = `cor-${label.replace(/\W+/g, "-")}`;
	return (
		<div className="flex flex-col gap-1">
			<Label htmlFor={id} className="text-xs">
				{label}
			</Label>
			<div className="flex items-center gap-2">
				<input
					type="color"
					aria-label={`${label} (seletor)`}
					value={value.slice(0, 7)}
					disabled={disabled}
					className="h-9 w-10 shrink-0 cursor-pointer rounded border bg-transparent"
					onChange={(event) => onChange(event.target.value)}
				/>
				<Input
					id={id}
					value={value}
					disabled={disabled}
					className="font-mono"
					onChange={(event) => onChange(event.target.value.trim())}
				/>
			</div>
		</div>
	);
}

function CheckField({
	label,
	checked,
	onChange,
	disabled,
}: {
	label: string;
	checked: boolean;
	onChange: (checked: boolean) => void;
	disabled?: boolean;
}) {
	return (
		<label
			className={cn(
				"flex items-center gap-2 text-sm",
				disabled && "cursor-not-allowed opacity-50",
			)}
		>
			<input
				type="checkbox"
				checked={checked}
				disabled={disabled}
				onChange={(event) => onChange(event.target.checked)}
			/>
			{label}
		</label>
	);
}

function ChoiceField({
	label,
	value,
	options,
	onChange,
	disabled,
}: {
	label: string;
	value: string;
	options: readonly { value: string; label: string }[];
	onChange: (value: string) => void;
	disabled?: boolean;
}) {
	return (
		<div className="flex flex-col gap-1">
			<span className="font-medium text-xs">{label}</span>
			<Select
				items={options}
				value={value}
				disabled={disabled}
				onValueChange={(next) => {
					if (next) {
						onChange(next);
					}
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
	);
}
