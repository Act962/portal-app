"use client";

import {
	ART_FORMATS,
	type ArtContent,
	type ArtDesign,
	type ArtElement,
	type ArtFormat,
	type ArtInputs,
	canvasOf,
	DEFAULT_TEXT_STYLE,
	DESTINATION_LABEL,
	type ElementKind,
	EMPTY_DESIGN,
	formatServes,
	SAMPLE_CONTENT,
	SOCIAL_DESTINATIONS,
	type SocialDestination,
	templateProblems,
} from "@portal-app/social";
import { Button } from "@portal-app/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@portal-app/ui/components/popover";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { cn } from "@portal-app/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	AlignCenterHorizontal,
	AlignCenterVertical,
	AlignEndHorizontal,
	AlignEndVertical,
	AlignHorizontalDistributeCenter,
	AlignStartHorizontal,
	AlignStartVertical,
	AlignVerticalDistributeCenter,
	ArrowDown,
	ArrowLeft,
	ArrowUp,
	BringToFront,
	Circle,
	Copy,
	ImageIcon,
	Keyboard,
	Loader2,
	Lock,
	Maximize,
	Minus,
	Plus,
	Redo2,
	SendToBack,
	Square,
	Trash2,
	Type,
	Undo2,
	UserSquare,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";

import { useArtFontsReady } from "@/components/art/art-fonts";
import { useArtAssets } from "@/components/art/use-art-assets";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { trpc } from "@/utils/trpc";

import {
	type AlignMode,
	addElements,
	alignElements,
	commit,
	copiesOf,
	distributeElements,
	duplicateElements,
	FORMAT_LABEL,
	type History,
	historyOf,
	insertToken,
	layerName,
	moveElements,
	moveInStack,
	newElement,
	redo,
	reframeDesign,
	removeElements,
	replacePresent,
	type StackMove,
	undo,
	updateElements,
} from "./editor-model";
import { EditorStage, type ZoomRequest } from "./editor-stage";
import { ColorField, Section, SelectField } from "./fields";
import { ElementInspector, type ElementPatch } from "./inspector";
import { LayersPanel } from "./layers-panel";
import { VariablesPanel } from "./variables-panel";

type Picking =
	| { mode: "add-image" }
	| { mode: "replace-image"; elementId: string }
	| { mode: "sample-photo" }
	| null;

type Tab = "elementos" | "camadas" | "variaveis";

const newId = () => crypto.randomUUID().slice(0, 8);

/** O desenho como a API recebe: listas mutáveis, que é o que o zod infere. */
const designInput = (design: ArtDesign) => ({
	...design,
	elements: [...design.elements],
	variables: [...design.variables],
});

const SHORTCUTS: readonly [string, string][] = [
	["Ctrl + Z / Ctrl + Y", "Desfazer / refazer"],
	["Ctrl + C / X / V", "Copiar, recortar, colar"],
	["Ctrl + D", "Duplicar"],
	["Ctrl + A", "Selecionar tudo"],
	["Delete", "Apagar a seleção"],
	["Setas (Shift = 10 px)", "Mover 1 px"],
	["[ e ] (Ctrl = até a ponta)", "Trás e frente"],
	["Shift ou Ctrl + clique", "Somar à seleção"],
	["Arrastar no vazio", "Selecionar por área"],
	["Espaço + arrastar", "Mover a tela"],
	["Ctrl + roda do mouse", "Zoom"],
	["Alt ao arrastar", "Sem guias magnéticas"],
	["Ctrl + S", "Salvar"],
];

/**
 * O editor de padrões de arte (spec 10, F3–F4): palco Konva no meio, elementos
 * e camadas à esquerda, inspetor à direita — o arranjo de toda ferramenta de
 * design, e o do Catálogo Promocional do nerp-2.
 *
 * O desenho vive numa HISTÓRIA (D10): cada mudança concluída é um passo de
 * desfazer. O palco desenha com a mesma cena do servidor, então o que o
 * designer vê é o que vai ao ar.
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
	const [name, setName] = useState("");
	const [format, setFormat] = useState<ArtFormat>("4:5");
	const [history, setHistory] = useState<History<ArtDesign>>(() =>
		historyOf(EMPTY_DESIGN),
	);
	const [baseline, setBaseline] = useState<string>("");
	const [selection, setSelection] = useState<string[]>([]);
	const [tab, setTab] = useState<Tab>("elementos");
	const [zoom, setZoom] = useState<ZoomRequest>({ mode: "fit", nonce: 0 });
	const [scale, setScale] = useState(1);
	const [sample, setSample] = useState<ArtContent>(SAMPLE_CONTENT);
	const [sampleInputs, setSampleInputs] = useState<ArtInputs>({
		values: {},
		texts: {},
	});
	const [samplePhotoId, setSamplePhotoId] = useState<string | null>(null);
	const [showTokens, setShowTokens] = useState(false);
	const [warnings, setWarnings] = useState<string[]>([]);
	const [picking, setPicking] = useState<Picking>(null);
	const [finalOpen, setFinalOpen] = useState(false);

	const clipboard = useRef<ArtElement[]>([]);
	const contentRef = useRef<HTMLTextAreaElement | null>(null);
	const lastCoalesce = useRef<{ key: string; at: number } | null>(null);

	useEffect(() => {
		if (saved.data && !loaded) {
			setName(saved.data.name);
			setFormat(saved.data.format);
			setHistory(historyOf(saved.data.design));
			setBaseline(
				JSON.stringify({
					name: saved.data.name,
					format: saved.data.format,
					design: saved.data.design,
				}),
			);
			setLoaded(true);
		}
	}, [saved.data, loaded]);

	const design = history.present;
	const archived = saved.data?.archived ?? false;
	const editable = canDesign && !archived;
	const canvas = canvasOf(format);
	const liveSelection = selection.filter((item) =>
		design.elements.some((element) => element.id === item),
	);
	const selected = design.elements.filter((element) =>
		liveSelection.includes(element.id),
	);
	const single = selected.length === 1 ? (selected[0] ?? null) : null;
	const dirty = loaded && JSON.stringify({ name, format, design }) !== baseline;
	const problems = loaded
		? templateProblems({
				name,
				format,
				design,
				defaultFor: saved.data?.defaultFor ?? [],
			})
		: [];

	const fontsReady = useArtFontsReady(design);
	const { assets } = useArtAssets(design, samplePhotoId);

	// No modo "variáveis", as caixas mostram o texto cru, com os marcadores.
	const stageDesign = useMemo<ArtDesign>(
		() =>
			showTokens
				? {
						...design,
						elements: design.elements.map((element) =>
							element.kind === "TEXT"
								? { ...element, mode: "STATIC" as const }
								: element,
						),
					}
				: design,
		[design, showTokens],
	);

	// ── mudar o desenho ─────────────────────────────────────────────────────

	/** Toda mudança passa por aqui. A mesma `coalesceKey` em sequência vira um passo só. */
	const change = (
		transform: (current: ArtDesign) => ArtDesign,
		coalesceKey?: string,
	) => {
		if (!editable) {
			return;
		}
		const now = Date.now();
		const previous = lastCoalesce.current;
		const merge = Boolean(
			coalesceKey &&
				previous &&
				previous.key === coalesceKey &&
				now - previous.at < 1200,
		);
		lastCoalesce.current = coalesceKey ? { key: coalesceKey, at: now } : null;
		setHistory((current) => {
			const next = transform(current.present);
			return merge ? replacePresent(current, next) : commit(current, next);
		});
	};
	const replaceDesign = (next: ArtDesign) => change(() => next);

	const patchElement: ElementPatch = (elementId, transform, coalesceKey) =>
		change(
			(current) => updateElements(current, [elementId], transform),
			coalesceKey,
		);

	const add = (element: ArtElement) => {
		if (
			element.kind === "PHOTO" &&
			design.elements.some((item) => item.kind === "PHOTO")
		) {
			toast.error("O padrão já tem o lugar da foto da matéria.");
			return;
		}
		change((current) => addElements(current, [element]));
		setSelection([element.id]);
	};

	const addPreset = (preset: Preset) => {
		const element = presetElement(preset, format, design);
		if (
			preset === "botao" &&
			!design.variables.some((v) => v.key === "chamada")
		) {
			change((current) =>
				addElements(
					{
						...current,
						variables: [
							...current.variables,
							{
								key: "chamada",
								label: "Chamada do botão",
								defaultValue: "MATÉRIA COMPLETA NOS STORIES",
								multiline: false,
							},
						],
					},
					[element],
				),
			);
			setSelection([element.id]);
			return;
		}
		add(element);
	};

	const removeSelection = () => {
		const ids = selected
			.filter((element) => !element.locked)
			.map((element) => element.id);
		if (ids.length === 0) {
			return;
		}
		change((current) => removeElements(current, ids));
		setSelection([]);
	};

	const duplicateSelection = () => {
		if (liveSelection.length === 0) {
			return;
		}
		const result = duplicateElements(design, liveSelection, newId);
		replaceDesign(result.design);
		setSelection(result.ids);
	};

	const copySelection = () => {
		clipboard.current = selected.map((element) => structuredClone(element));
	};

	const paste = () => {
		if (clipboard.current.length === 0) {
			return;
		}
		const result = copiesOf(design, clipboard.current, newId);
		replaceDesign(result.design);
		setSelection(result.ids);
	};

	const align = (mode: AlignMode) =>
		change((current) => alignElements(current, liveSelection, mode, canvas));
	const stack = (move: StackMove) =>
		change((current) => moveInStack(current, liveSelection, move));

	const insertVariable = (key: string) => {
		if (single?.kind !== "TEXT") {
			return;
		}
		const area = contentRef.current;
		const start = area?.selectionStart ?? single.content.length;
		const end = area?.selectionEnd ?? single.content.length;
		const result = insertToken(single.content, start, end, key);
		patchElement(single.id, (current) =>
			current.kind === "TEXT"
				? {
						...current,
						content: result.text,
						mode: current.mode === "STATIC" ? "DYNAMIC" : current.mode,
					}
				: current,
		);
		requestAnimationFrame(() => {
			area?.focus();
			area?.setSelectionRange(result.caret, result.caret);
		});
	};

	const changeFormat = (next: ArtFormat) => {
		if (next === format) {
			return;
		}
		change((current) => reframeDesign(current, format, next));
		setFormat(next);
		setZoom({ mode: "fit", nonce: Date.now() });
	};

	// ── salvar ───────────────────────────────────────────────────────────────

	const refreshList = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.social.templates.list.queryKey(),
		});

	const update = useMutation(
		trpc.social.templates.update.mutationOptions({
			onSuccess: async (dto) => {
				queryClient.setQueryData(
					trpc.social.templates.get.queryKey({ id }),
					dto,
				);
				setBaseline(
					JSON.stringify({
						name: dto.name,
						format: dto.format,
						design: dto.design,
					}),
				);
				toast.success(`Padrão salvo — versão ${dto.version}.`);
				await refreshList();
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
				await refreshList();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const finalPreview = useMutation(
		trpc.social.templates.preview.mutationOptions(),
	);

	const save = () => {
		if (!editable || !dirty || problems.length > 0 || update.isPending) {
			return;
		}
		update.mutate({ id, name, format, design: designInput(design) });
	};

	// ── atalhos ─────────────────────────────────────────────────────────────

	const keyHandler = useRef<(event: KeyboardEvent) => void>(() => {});
	useEffect(() => {
		keyHandler.current = (event: KeyboardEvent) => {
			const target = event.target as HTMLElement | null;
			const typing =
				target?.isContentEditable ||
				["INPUT", "TEXTAREA", "SELECT"].includes(target?.tagName ?? "");
			const mod = event.ctrlKey || event.metaKey;
			const key = event.key.toLowerCase();
			if (mod && key === "s") {
				event.preventDefault();
				save();
				return;
			}
			if (typing || picking || finalOpen) {
				return;
			}
			if (mod && key === "z") {
				event.preventDefault();
				setHistory(event.shiftKey ? redo : undo);
				return;
			}
			if (mod && key === "y") {
				event.preventDefault();
				setHistory(redo);
				return;
			}
			if (key === "escape") {
				setSelection([]);
				return;
			}
			if (mod && key === "a") {
				event.preventDefault();
				setSelection(
					design.elements
						.filter((element) => element.visible && !element.locked)
						.map((element) => element.id),
				);
				return;
			}
			if (!editable) {
				return;
			}
			if (mod && key === "c") {
				copySelection();
			} else if (mod && key === "x") {
				copySelection();
				removeSelection();
			} else if (mod && key === "v") {
				event.preventDefault();
				paste();
			} else if (mod && key === "d") {
				event.preventDefault();
				duplicateSelection();
			} else if (key === "delete" || key === "backspace") {
				event.preventDefault();
				removeSelection();
			} else if (key === "]") {
				stack(mod ? "front" : "forward");
			} else if (key === "[") {
				stack(mod ? "back" : "backward");
			} else if (key.startsWith("arrow") && liveSelection.length > 0) {
				event.preventDefault();
				const step = event.shiftKey ? 10 : 1;
				const dx =
					key === "arrowleft" ? -step : key === "arrowright" ? step : 0;
				const dy = key === "arrowup" ? -step : key === "arrowdown" ? step : 0;
				change(
					(current) => moveElements(current, liveSelection, dx, dy),
					`nudge:${liveSelection.join(",")}`,
				);
			}
		};
	});
	useEffect(() => {
		const listener = (event: KeyboardEvent) => keyHandler.current(event);
		window.addEventListener("keydown", listener);
		return () => window.removeEventListener("keydown", listener);
	}, []);

	// Sair com alterações não salvas pergunta antes.
	useEffect(() => {
		if (!dirty) {
			return;
		}
		const listener = (event: BeforeUnloadEvent) => event.preventDefault();
		window.addEventListener("beforeunload", listener);
		return () => window.removeEventListener("beforeunload", listener);
	}, [dirty]);

	// ── tela ─────────────────────────────────────────────────────────────────

	if (saved.isLoading) {
		return <Skeleton className="h-[calc(100dvh-8rem)] w-full" />;
	}
	if (!saved.data) {
		return <p className="text-muted-foreground">Padrão não encontrado.</p>;
	}

	const defaultFor = saved.data.defaultFor;
	const hasPhoto = design.elements.some((element) => element.kind === "PHOTO");
	const textSelected = single?.kind === "TEXT";

	return (
		<div className="flex h-[calc(100dvh-8rem)] min-h-[640px] flex-col overflow-hidden rounded-lg border bg-card">
			{/* ---------------- barra de cima ---------------- */}
			<header className="flex flex-wrap items-center gap-2 border-b px-2 py-1.5">
				<Button
					variant="ghost"
					size="sm"
					nativeButton={false}
					render={<Link href={"/dashboard/social?aba=padroes" as Route} />}
				>
					<ArrowLeft className="size-4" />
					Padrões
				</Button>
				<input
					aria-label="Nome do padrão"
					className="h-8 w-56 rounded-md border border-transparent bg-transparent px-2 font-medium text-sm outline-none hover:border-input focus:border-input focus:bg-background"
					value={name}
					disabled={!editable}
					onChange={(event) => setName(event.target.value)}
				/>
				<span className="text-muted-foreground text-xs">
					{format} · {canvas.width}×{canvas.height} · versão{" "}
					{saved.data.version}
					{archived ? " · arquivado" : ""}
				</span>

				<div className="ml-auto flex items-center gap-1">
					<ToolbarButton
						label="Desfazer (Ctrl+Z)"
						disabled={history.past.length === 0}
						onClick={() => setHistory(undo)}
					>
						<Undo2 className="size-4" />
					</ToolbarButton>
					<ToolbarButton
						label="Refazer (Ctrl+Y)"
						disabled={history.future.length === 0}
						onClick={() => setHistory(redo)}
					>
						<Redo2 className="size-4" />
					</ToolbarButton>
					<span className="mx-1 h-5 w-px bg-border" />
					<ToolbarButton
						label="Diminuir zoom"
						onClick={() =>
							setZoom({ mode: "set", scale: scale / 1.25, nonce: Date.now() })
						}
					>
						<Minus className="size-4" />
					</ToolbarButton>
					<button
						type="button"
						className="h-8 w-14 rounded-md text-xs tabular-nums hover:bg-muted"
						title="Ver em 100%"
						onClick={() =>
							setZoom({ mode: "set", scale: 1, nonce: Date.now() })
						}
					>
						{Math.round(scale * 100)}%
					</button>
					<ToolbarButton
						label="Aumentar zoom"
						onClick={() =>
							setZoom({ mode: "set", scale: scale * 1.25, nonce: Date.now() })
						}
					>
						<Plus className="size-4" />
					</ToolbarButton>
					<ToolbarButton
						label="Ajustar à tela"
						onClick={() => setZoom({ mode: "fit", nonce: Date.now() })}
					>
						<Maximize className="size-4" />
					</ToolbarButton>
					<span className="mx-1 h-5 w-px bg-border" />
					<button
						type="button"
						aria-pressed={showTokens}
						onClick={() => setShowTokens(!showTokens)}
						className={cn(
							"h-8 rounded-md border px-2 text-xs",
							showTokens
								? "border-sky-500 bg-sky-500/10 text-sky-700 dark:text-sky-300"
								: "hover:bg-muted",
						)}
						title="Mostrar os marcadores {{ }} em vez dos dados de exemplo"
					>
						{showTokens ? "Mostrando variáveis" : "Mostrando exemplo"}
					</button>
					<Popover>
						<PopoverTrigger
							render={
								<Button
									variant="ghost"
									size="icon"
									className="size-8"
									aria-label="Atalhos"
								/>
							}
						>
							<Keyboard className="size-4" />
						</PopoverTrigger>
						<PopoverContent className="w-80 p-3">
							<p className="mb-2 font-medium text-sm">Atalhos</p>
							<dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
								{SHORTCUTS.map(([keys, action]) => (
									<div key={keys} className="contents">
										<dt className="font-mono text-muted-foreground">{keys}</dt>
										<dd>{action}</dd>
									</div>
								))}
							</dl>
						</PopoverContent>
					</Popover>
					<Button
						variant="outline"
						size="sm"
						disabled={problems.length > 0}
						onClick={() => {
							setFinalOpen(true);
							finalPreview.mutate({
								name,
								format,
								design: designInput(design),
								content: sample,
								inputs: sampleInputs,
								photoMediaId: samplePhotoId,
								width: 1080,
							});
						}}
					>
						Conferir arte final
					</Button>
					{canDesign ? (
						<Button
							size="sm"
							disabled={
								!editable || !dirty || problems.length > 0 || update.isPending
							}
							onClick={save}
						>
							{update.isPending ? (
								<Loader2 className="size-4 animate-spin" />
							) : null}
							{dirty ? "Salvar" : "Salvo"}
						</Button>
					) : null}
				</div>
			</header>

			<div className="grid min-h-0 flex-1 grid-cols-[264px_minmax(0,1fr)_308px]">
				{/* ---------------- esquerda ---------------- */}
				<aside className="flex min-h-0 flex-col border-r">
					<div className="grid grid-cols-3 gap-0.5 border-b p-1">
						{(
							[
								["elementos", "Elementos"],
								["camadas", "Camadas"],
								["variaveis", "Variáveis"],
							] as const
						).map(([value, label]) => (
							<button
								key={value}
								type="button"
								onClick={() => setTab(value)}
								className={cn(
									"h-7 rounded text-xs",
									tab === value
										? "bg-muted font-medium"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{label}
							</button>
						))}
					</div>
					<div className="min-h-0 flex-1 overflow-y-auto">
						{tab === "elementos" ? (
							<ElementsTab
								disabled={!editable}
								hasPhoto={hasPhoto}
								onAdd={(kind) =>
									kind === "IMAGE"
										? setPicking({ mode: "add-image" })
										: add(newElement(kind, format, newId()))
								}
								onPreset={addPreset}
							/>
						) : null}
						{tab === "camadas" ? (
							<LayersPanel
								design={design}
								selection={liveSelection}
								canDesign={editable}
								onSelect={setSelection}
								onChange={replaceDesign}
							/>
						) : null}
						{tab === "variaveis" ? (
							<VariablesPanel
								design={design}
								canDesign={editable}
								canInsert={textSelected}
								onInsert={insertVariable}
								onChange={replaceDesign}
							/>
						) : null}
					</div>
				</aside>

				{/* ---------------- palco ---------------- */}
				<main className="relative min-h-0 bg-[radial-gradient(circle,hsl(var(--muted-foreground)/0.18)_1px,transparent_1px)] bg-muted/50 [background-size:18px_18px]">
					{editable && liveSelection.length > 0 ? (
						<SelectionToolbar
							count={liveSelection.length}
							locked={selected.every((element) => element.locked)}
							onAlign={align}
							onDistribute={(axis) =>
								change((current) =>
									distributeElements(current, liveSelection, axis),
								)
							}
							onStack={stack}
							onDuplicate={duplicateSelection}
							onLock={() => {
								const lock = !selected.every((element) => element.locked);
								change((current) =>
									updateElements(current, liveSelection, (element) => ({
										...element,
										locked: lock,
									})),
								);
							}}
							onDelete={removeSelection}
						/>
					) : null}
					<EditorStage
						format={format}
						design={stageDesign}
						content={sample}
						inputs={sampleInputs}
						assets={assets}
						fontsReady={fontsReady}
						selection={liveSelection}
						canDesign={editable}
						zoom={zoom}
						onSelect={setSelection}
						onCommit={(next) => {
							// No modo variáveis o palco desenha uma cópia com as caixas
							// "estáticas"; o que volta é só geometria, aplicada ao desenho real.
							if (showTokens) {
								const geometry = new Map(
									next.elements.map((element) => [element.id, element]),
								);
								change((current) =>
									updateElements(
										current,
										current.elements.map((element) => element.id),
										(element) => {
											const moved = geometry.get(element.id);
											return moved
												? {
														...element,
														x: moved.x,
														y: moved.y,
														width: moved.width,
														height: moved.height,
														rotation: moved.rotation,
													}
												: element;
										},
									),
								);
							} else {
								replaceDesign(next);
							}
						}}
						onScaleChange={setScale}
						onWarnings={(next) =>
							setWarnings((current) =>
								JSON.stringify(current) === JSON.stringify(next)
									? current
									: next,
							)
						}
						onDoubleClick={(elementId) => {
							setSelection([elementId]);
							const element = design.elements.find(
								(item) => item.id === elementId,
							);
							if (element?.kind === "TEXT") {
								requestAnimationFrame(() => contentRef.current?.focus());
							} else if (element?.kind === "IMAGE" && editable) {
								setPicking({ mode: "replace-image", elementId });
							}
						}}
					/>
					<StatusBar
						elements={design.elements.length}
						problems={problems}
						warnings={warnings}
					/>
				</main>

				{/* ---------------- inspetor ---------------- */}
				<aside className="min-h-0 overflow-y-auto border-l">
					{single ? (
						<ElementInspector
							key={single.id}
							element={single}
							design={design}
							disabled={!editable}
							onPatch={patchElement}
							onPickImage={(elementId) =>
								setPicking({ mode: "replace-image", elementId })
							}
							contentRef={contentRef}
							onInsertToken={insertVariable}
						/>
					) : selected.length > 1 ? (
						<Section title={`${selected.length} elementos`}>
							<p className="text-muted-foreground text-xs">
								Use a barra sobre o palco para alinhar, distribuir e ordenar a
								seleção. Setas movem todos juntos.
							</p>
							<ul className="flex flex-col gap-1 text-xs">
								{selected.map((element) => (
									<li key={element.id} className="truncate">
										{layerName(element)}
									</li>
								))}
							</ul>
						</Section>
					) : (
						<TemplateSettings
							name={name}
							format={format}
							design={design}
							editable={editable}
							defaultFor={defaultFor}
							savedFormat={saved.data.format}
							settingDefaults={setDefaults.isPending}
							sample={sample}
							sampleInputs={sampleInputs}
							samplePhotoId={samplePhotoId}
							onName={setName}
							onFormat={changeFormat}
							onBackground={(background) =>
								change((current) => ({ ...current, background }), "background")
							}
							onDefaults={(destinations) =>
								setDefaults.mutate({ id, destinations })
							}
							onSample={setSample}
							onSampleInputs={setSampleInputs}
							onPickSamplePhoto={() => setPicking({ mode: "sample-photo" })}
							onClearSamplePhoto={() => setSamplePhotoId(null)}
						/>
					)}
				</aside>
			</div>

			<MediaPickerDialog
				open={picking !== null}
				onOpenChange={(open) => !open && setPicking(null)}
				title={
					picking?.mode === "sample-photo"
						? "Foto de exemplo"
						: "Imagem do padrão (moldura, logo, selo)"
				}
				onSelect={async (mediaId) => {
					const current = picking;
					setPicking(null);
					if (current?.mode === "sample-photo") {
						setSamplePhotoId(mediaId);
						return;
					}
					if (current?.mode === "replace-image") {
						patchElement(current.elementId, (element) =>
							element.kind === "IMAGE" ? { ...element, mediaId } : element,
						);
						return;
					}
					const asset = await queryClient
						.fetchQuery(trpc.media.get.queryOptions({ id: mediaId }))
						.catch(() => null);
					add(
						newElement("IMAGE", format, newId(), {
							mediaId,
							imageSize:
								asset?.width && asset.height
									? { width: asset.width, height: asset.height }
									: null,
						}),
					);
				}}
			/>

			<Dialog open={finalOpen} onOpenChange={setFinalOpen}>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>Arte final</DialogTitle>
						<DialogDescription>
							Desenhada pelo servidor, com o mesmo código que publica — é
							exatamente o que vai ao ar com os dados de exemplo.
						</DialogDescription>
					</DialogHeader>
					<div className="flex max-h-[70vh] justify-center overflow-auto rounded-md bg-muted p-2">
						{finalPreview.isPending ? (
							<Loader2 className="my-20 size-6 animate-spin text-muted-foreground" />
						) : finalPreview.data?.image ? (
							// Imagem gerada pelo servidor em data URL — não é mídia da biblioteca.
							<img
								src={finalPreview.data.image}
								alt="Arte final do padrão"
								className="max-h-[66vh] w-auto shadow"
							/>
						) : (
							<p className="py-10 text-muted-foreground text-sm">
								{finalPreview.data?.problems.join(" ") ||
									finalPreview.error?.message ||
									"Sem prévia."}
							</p>
						)}
					</div>
				</DialogContent>
			</Dialog>
		</div>
	);
}

// ── elementos prontos ──────────────────────────────────────────────────────

type Preset = "titulo" | "chapeu" | "subtitulo" | "fixo" | "botao" | "degrade";

function presetElement(
	preset: Preset,
	format: ArtFormat,
	design: ArtDesign,
): ArtElement {
	const canvas = canvasOf(format);
	const id = newId();
	const text = newElement("TEXT", format, id);
	if (text.kind !== "TEXT") {
		throw new Error("newElement(TEXT) não devolveu texto");
	}
	const white = { ...DEFAULT_TEXT_STYLE, color: "#ffffff" };
	switch (preset) {
		case "titulo":
			return {
				...text,
				name: "Título",
				mode: "EDITABLE",
				content: "{{titulo}}",
				fieldLabel: "Título na arte",
				x: 110,
				y: Math.round(canvas.height * 0.45),
				width: canvas.width - 220,
				height: 300,
				style: {
					...white,
					fontWeight: 900,
					italic: true,
					uppercase: true,
					fontSize: 84,
					minFontSize: 44,
					maxLines: 4,
					lineHeight: 1.05,
					color: "#ffd400",
				},
			};
		case "subtitulo":
			return {
				...text,
				name: "Subtítulo",
				mode: "DYNAMIC",
				content: "{{subtitulo}}",
				x: 110,
				y: Math.round(canvas.height * 0.72),
				width: canvas.width - 220,
				height: 150,
				style: {
					...white,
					fontFamily: "Nunito Sans",
					fontWeight: 600,
					fontSize: 40,
					minFontSize: 28,
					maxLines: 3,
					lineHeight: 1.2,
				},
			};
		case "chapeu":
			return {
				...text,
				name: "Chapéu",
				mode: "DYNAMIC",
				content: "{{chapeu}}",
				x: 110,
				y: Math.round(canvas.height * 0.36),
				width: 460,
				height: 76,
				style: {
					...DEFAULT_TEXT_STYLE,
					color: "#d9232e",
					uppercase: true,
					fontSize: 38,
					minFontSize: 24,
					maxLines: 1,
					verticalAlign: "middle",
					background: {
						color: "#ffffff",
						radius: 999,
						paddingX: 26,
						paddingY: 10,
						shape: "hug",
					},
				},
			};
		case "fixo":
			return {
				...text,
				name: "Texto fixo",
				mode: "STATIC",
				content: "portal7cidades.com.br",
				x: 110,
				y: canvas.height - 150,
				width: canvas.width - 220,
				height: 60,
				style: {
					...white,
					fontWeight: 600,
					fontSize: 32,
					minFontSize: 20,
					maxLines: 1,
					align: "center",
				},
			};
		case "botao":
			return {
				...text,
				name: "Botão",
				mode: "DYNAMIC",
				content: "{{chamada}}",
				x: Math.round((canvas.width - 720) / 2),
				y: canvas.height - 260,
				width: 720,
				height: 96,
				style: {
					...DEFAULT_TEXT_STYLE,
					color: "#d9232e",
					uppercase: true,
					fontSize: 34,
					minFontSize: 22,
					maxLines: 1,
					align: "center",
					verticalAlign: "middle",
					background: {
						color: "#ffffff",
						radius: 20,
						paddingX: 20,
						paddingY: 12,
						shape: "box",
					},
				},
			};
		case "degrade":
			return {
				...newElement("RECT", format, id),
				name: design.elements.some((element) => element.name === "Degradê")
					? "Degradê 2"
					: "Degradê",
				x: 0,
				y: Math.round(canvas.height * 0.4),
				width: canvas.width,
				height: Math.round(canvas.height * 0.6),
				cornerRadius: 0,
				fill: {
					type: "linear",
					angle: 90,
					stops: [
						{ offset: 0, color: "#00000000" },
						{ offset: 1, color: "#000000d9" },
					],
				},
			} as ArtElement;
	}
}

function ElementsTab({
	disabled,
	hasPhoto,
	onAdd,
	onPreset,
}: {
	disabled: boolean;
	hasPhoto: boolean;
	onAdd: (kind: ElementKind) => void;
	onPreset: (preset: Preset) => void;
}) {
	const tile =
		"flex flex-col items-start gap-1 rounded-md border p-2 text-left text-xs hover:border-sky-500/60 hover:bg-sky-500/5 disabled:pointer-events-none disabled:opacity-40";
	return (
		<div className="flex flex-col">
			<Section title="Imagens">
				<div className="grid grid-cols-2 gap-1.5">
					<button
						type="button"
						className={tile}
						disabled={disabled || hasPhoto}
						onClick={() => onAdd("PHOTO")}
					>
						<UserSquare className="size-4 text-sky-600" />
						<span className="font-medium">Foto da matéria</span>
						<span className="text-[11px] text-muted-foreground">
							{hasPhoto ? "Já está no padrão" : "A capa de cada post"}
						</span>
					</button>
					<button
						type="button"
						className={tile}
						disabled={disabled}
						onClick={() => onAdd("IMAGE")}
					>
						<ImageIcon className="size-4 text-sky-600" />
						<span className="font-medium">Imagem</span>
						<span className="text-[11px] text-muted-foreground">
							Moldura PNG, logo, selo
						</span>
					</button>
				</div>
			</Section>
			<Section title="Textos prontos">
				<div className="grid grid-cols-2 gap-1.5">
					{(
						[
							["titulo", "Título", "{{titulo}}, editável"],
							["chapeu", "Chapéu", "Pílula com {{chapeu}}"],
							["subtitulo", "Subtítulo", "{{subtitulo}}"],
							["botao", "Botão", "Variável {{chamada}}"],
							["fixo", "Texto fixo", "Assinatura, site"],
						] as const
					).map(([preset, label, hint]) => (
						<button
							key={preset}
							type="button"
							className={tile}
							disabled={disabled}
							onClick={() => onPreset(preset)}
						>
							<Type className="size-4 text-sky-600" />
							<span className="font-medium">{label}</span>
							<span className="font-mono text-[10px] text-muted-foreground">
								{hint}
							</span>
						</button>
					))}
					<button
						type="button"
						className={tile}
						disabled={disabled}
						onClick={() => onAdd("TEXT")}
					>
						<Plus className="size-4 text-sky-600" />
						<span className="font-medium">Caixa de texto</span>
						<span className="text-[11px] text-muted-foreground">Em branco</span>
					</button>
				</div>
			</Section>
			<Section title="Formas">
				<div className="grid grid-cols-2 gap-1.5">
					<button
						type="button"
						className={tile}
						disabled={disabled}
						onClick={() => onAdd("RECT")}
					>
						<Square className="size-4 text-sky-600" />
						<span className="font-medium">Retângulo</span>
					</button>
					<button
						type="button"
						className={tile}
						disabled={disabled}
						onClick={() => onAdd("ELLIPSE")}
					>
						<Circle className="size-4 text-sky-600" />
						<span className="font-medium">Elipse</span>
					</button>
					<button
						type="button"
						className={tile}
						disabled={disabled}
						onClick={() => onAdd("LINE")}
					>
						<Minus className="size-4 text-sky-600" />
						<span className="font-medium">Linha</span>
					</button>
					<button
						type="button"
						className={tile}
						disabled={disabled}
						onClick={() => onPreset("degrade")}
					>
						<span className="size-4 rounded-sm bg-gradient-to-b from-transparent to-black" />
						<span className="font-medium">Degradê</span>
						<span className="text-[11px] text-muted-foreground">
							Escurece para o texto ler
						</span>
					</button>
				</div>
			</Section>
			<p className="px-3 py-2 text-[11px] text-muted-foreground">
				Dica: suba a moldura do veículo como Imagem, trave a camada e monte os
				textos por cima.
			</p>
		</div>
	);
}

// ── barras ──────────────────────────────────────────────────────────────────

function ToolbarButton({
	label,
	disabled,
	onClick,
	children,
}: {
	label: string;
	disabled?: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Button
			variant="ghost"
			size="icon"
			className="size-8"
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={onClick}
		>
			{children}
		</Button>
	);
}

function SelectionToolbar({
	count,
	locked,
	onAlign,
	onDistribute,
	onStack,
	onDuplicate,
	onLock,
	onDelete,
}: {
	count: number;
	locked: boolean;
	onAlign: (mode: AlignMode) => void;
	onDistribute: (axis: "horizontal" | "vertical") => void;
	onStack: (move: StackMove) => void;
	onDuplicate: () => void;
	onLock: () => void;
	onDelete: () => void;
}) {
	const scope = count === 1 ? "ao quadro" : "à seleção";
	return (
		<div className="absolute top-2 left-1/2 z-10 flex -translate-x-1/2 items-center gap-0.5 rounded-lg border bg-background/95 p-1 shadow-md backdrop-blur">
			<ToolbarButton
				label={`Alinhar à esquerda ${scope}`}
				onClick={() => onAlign("left")}
			>
				<AlignStartVertical className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label={`Centralizar na horizontal ${scope}`}
				onClick={() => onAlign("hcenter")}
			>
				<AlignCenterVertical className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label={`Alinhar à direita ${scope}`}
				onClick={() => onAlign("right")}
			>
				<AlignEndVertical className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label={`Alinhar em cima ${scope}`}
				onClick={() => onAlign("top")}
			>
				<AlignStartHorizontal className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label={`Centralizar na vertical ${scope}`}
				onClick={() => onAlign("vcenter")}
			>
				<AlignCenterHorizontal className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label={`Alinhar embaixo ${scope}`}
				onClick={() => onAlign("bottom")}
			>
				<AlignEndHorizontal className="size-4" />
			</ToolbarButton>
			<span className="mx-0.5 h-5 w-px bg-border" />
			<ToolbarButton
				label="Distribuir na horizontal (3 ou mais)"
				disabled={count < 3}
				onClick={() => onDistribute("horizontal")}
			>
				<AlignHorizontalDistributeCenter className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Distribuir na vertical (3 ou mais)"
				disabled={count < 3}
				onClick={() => onDistribute("vertical")}
			>
				<AlignVerticalDistributeCenter className="size-4" />
			</ToolbarButton>
			<span className="mx-0.5 h-5 w-px bg-border" />
			<ToolbarButton
				label="Trazer para a frente (Ctrl+])"
				onClick={() => onStack("front")}
			>
				<BringToFront className="size-4" />
			</ToolbarButton>
			<ToolbarButton label="Avançar um (])" onClick={() => onStack("forward")}>
				<ArrowUp className="size-4" />
			</ToolbarButton>
			<ToolbarButton label="Recuar um ([)" onClick={() => onStack("backward")}>
				<ArrowDown className="size-4" />
			</ToolbarButton>
			<ToolbarButton
				label="Enviar para o fundo (Ctrl+[)"
				onClick={() => onStack("back")}
			>
				<SendToBack className="size-4" />
			</ToolbarButton>
			<span className="mx-0.5 h-5 w-px bg-border" />
			<ToolbarButton label="Duplicar (Ctrl+D)" onClick={onDuplicate}>
				<Copy className="size-4" />
			</ToolbarButton>
			<ToolbarButton label={locked ? "Destravar" : "Travar"} onClick={onLock}>
				<Lock className={cn("size-4", locked && "text-sky-600")} />
			</ToolbarButton>
			<ToolbarButton label="Apagar (Delete)" onClick={onDelete}>
				<Trash2 className="size-4" />
			</ToolbarButton>
		</div>
	);
}

function StatusBar({
	elements,
	problems,
	warnings,
}: {
	elements: number;
	problems: readonly string[];
	warnings: readonly string[];
}) {
	const messages = [...problems, ...warnings];
	return (
		<div className="absolute right-2 bottom-2 left-2 z-10 flex items-end justify-between gap-2">
			<span className="rounded bg-background/90 px-2 py-1 text-[11px] text-muted-foreground shadow-sm">
				{elements} {elements === 1 ? "camada" : "camadas"}
			</span>
			{messages.length > 0 ? (
				<Popover>
					<PopoverTrigger
						render={
							<button
								type="button"
								className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-2 py-1 text-amber-900 text-xs shadow-sm dark:border-amber-900 dark:bg-amber-950 dark:text-amber-200"
							/>
						}
					>
						<AlertTriangle className="size-3.5" />
						{problems.length > 0
							? `${problems.length} ${problems.length === 1 ? "problema impede" : "problemas impedem"} salvar`
							: `${warnings.length} ${warnings.length === 1 ? "aviso" : "avisos"}`}
					</PopoverTrigger>
					<PopoverContent align="end" className="w-96 p-3">
						<ul className="list-disc space-y-1 pl-4 text-xs">
							{messages.map((message) => (
								<li key={message}>{message}</li>
							))}
						</ul>
					</PopoverContent>
				</Popover>
			) : (
				<span className="rounded bg-background/90 px-2 py-1 text-[11px] text-emerald-700 shadow-sm dark:text-emerald-300">
					Padrão sem problemas
				</span>
			)}
		</div>
	);
}

// ── o padrão, sem seleção ──────────────────────────────────────────────────

function TemplateSettings({
	name,
	format,
	design,
	editable,
	defaultFor,
	savedFormat,
	settingDefaults,
	sample,
	sampleInputs,
	samplePhotoId,
	onName,
	onFormat,
	onBackground,
	onDefaults,
	onSample,
	onSampleInputs,
	onPickSamplePhoto,
	onClearSamplePhoto,
}: {
	name: string;
	format: ArtFormat;
	design: ArtDesign;
	editable: boolean;
	defaultFor: readonly SocialDestination[];
	savedFormat: ArtFormat;
	settingDefaults: boolean;
	sample: ArtContent;
	sampleInputs: ArtInputs;
	samplePhotoId: string | null;
	onName: (name: string) => void;
	onFormat: (format: ArtFormat) => void;
	onBackground: (color: string) => void;
	onDefaults: (destinations: SocialDestination[]) => void;
	onSample: (content: ArtContent) => void;
	onSampleInputs: (inputs: ArtInputs) => void;
	onPickSamplePhoto: () => void;
	onClearSamplePhoto: () => void;
}) {
	const field =
		"h-8 w-full rounded-md border bg-background px-2 text-xs outline-none focus:ring-2 focus:ring-ring/40";
	const sampleFields: readonly [keyof ArtContent, string][] = [
		["headline", "Título"],
		["subtitle", "Subtítulo"],
		["kicker", "Chapéu"],
		["sectionName", "Editoria"],
		["authorName", "Autor"],
		["siteName", "Site"],
	];
	return (
		<div className="flex flex-col">
			<Section title="Padrão">
				<input
					aria-label="Nome do padrão"
					className={field}
					value={name}
					disabled={!editable}
					onChange={(event) => onName(event.target.value)}
				/>
				<SelectField
					label="Formato"
					value={format}
					disabled={!editable}
					options={ART_FORMATS.map((item) => ({
						value: item,
						label: FORMAT_LABEL[item],
					}))}
					onChange={(value) => onFormat(value as ArtFormat)}
				/>
				<ColorField
					label="Fundo do quadro"
					value={design.background}
					disabled={!editable}
					onCommit={onBackground}
				/>
			</Section>

			<Section title="Padrão de">
				{SOCIAL_DESTINATIONS.map((destination) => {
					const checked = defaultFor.includes(destination);
					const compatible = formatServes(savedFormat, destination);
					return (
						<label
							key={destination}
							className={cn(
								"flex items-center gap-2 text-xs",
								(!compatible || !editable) && "opacity-50",
							)}
						>
							<input
								type="checkbox"
								checked={checked}
								disabled={!compatible || !editable || settingDefaults}
								onChange={() =>
									onDefaults(
										checked
											? defaultFor.filter((item) => item !== destination)
											: [...defaultFor, destination],
									)
								}
							/>
							{DESTINATION_LABEL[destination]}
						</label>
					);
				})}
				<p className="text-[11px] text-muted-foreground">
					O post automático de cada matéria nasce com o padrão do destino. Vale
					o formato SALVO: Stories pedem 9:16.
				</p>
			</Section>

			<Section title="Dados de exemplo">
				<p className="text-[11px] text-muted-foreground">
					Só para testar o desenho — não são salvos no padrão.
				</p>
				{sampleFields.map(([key, label]) => (
					<input
						key={key}
						aria-label={`${label} de exemplo`}
						placeholder={label}
						className={field}
						value={sample[key] ?? ""}
						onChange={(event) =>
							onSample({
								...sample,
								[key]:
									key === "headline"
										? event.target.value
										: event.target.value || null,
							})
						}
					/>
				))}
				<div className="flex gap-1.5">
					<Button
						variant="outline"
						size="sm"
						className="h-7 flex-1 text-xs"
						onClick={() =>
							onSample({ ...sample, headline: "Chuva alaga o centro" })
						}
					>
						Título curto
					</Button>
					<Button
						variant="outline"
						size="sm"
						className="h-7 flex-1 text-xs"
						onClick={() =>
							onSample({ ...sample, headline: SAMPLE_CONTENT.headline })
						}
					>
						Título longo
					</Button>
				</div>
				{design.variables.map((variable) => (
					<input
						key={variable.key}
						aria-label={`${variable.label} de exemplo`}
						placeholder={`${variable.label} (padrão: ${variable.defaultValue || "vazio"})`}
						className={field}
						value={sampleInputs.values[variable.key] ?? ""}
						onChange={(event) => {
							const { [variable.key]: _previous, ...rest } =
								sampleInputs.values;
							onSampleInputs({
								...sampleInputs,
								values: event.target.value
									? { ...rest, [variable.key]: event.target.value }
									: rest,
							});
						}}
					/>
				))}
				<div className="flex gap-1.5">
					<Button
						variant="outline"
						size="sm"
						className="h-7 flex-1 text-xs"
						onClick={onPickSamplePhoto}
					>
						<UserSquare className="size-3.5" />
						{samplePhotoId ? "Trocar foto" : "Foto de exemplo"}
					</Button>
					{samplePhotoId ? (
						<Button
							variant="ghost"
							size="sm"
							className="h-7 text-xs"
							onClick={onClearSamplePhoto}
						>
							Sem foto
						</Button>
					) : null}
				</div>
			</Section>
		</div>
	);
}
