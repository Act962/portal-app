"use client";

import {
	buildArtLayer,
	ELEMENT_NODE,
	type SceneAssets,
} from "@portal-app/art-scene";
import {
	type ArtContent,
	type ArtDesign,
	type ArtElement,
	type ArtFormat,
	type ArtInputs,
	canvasOf,
	rotatedBounds,
} from "@portal-app/social";
import Konva from "konva";
import type { Group } from "konva/lib/Group";
import type { Layer } from "konva/lib/Layer";
import type { KonvaEventObject, Node as KonvaNode } from "konva/lib/Node";
import type { Stage } from "konva/lib/Stage";
import type { Rect } from "konva/lib/shapes/Rect";
import type { Transformer } from "konva/lib/shapes/Transformer";
import { useEffect, useRef, useState } from "react";

import {
	type Bounds,
	geometryFromNode,
	moveElements,
	snapBounds,
	unionBounds,
	updateElements,
} from "./editor-model";

/** Um pedido de zoom. O `nonce` faz o mesmo pedido valer de novo ("Ajustar" duas vezes). */
export type ZoomRequest =
	| { mode: "fit"; nonce: number }
	| { mode: "set"; scale: number; nonce: number };

export type EditorStageProps = {
	format: ArtFormat;
	design: ArtDesign;
	content: ArtContent;
	inputs: ArtInputs;
	assets: SceneAssets;
	fontsReady: boolean;
	selection: readonly string[];
	canDesign: boolean;
	zoom: ZoomRequest;
	onSelect: (ids: string[]) => void;
	/** Uma mudança CONCLUÍDA no desenho — soltar o arraste, soltar a alça. */
	onCommit: (design: ArtDesign) => void;
	onScaleChange: (scale: number) => void;
	onWarnings: (warnings: string[]) => void;
	onDoubleClick: (id: string) => void;
};

const ACCENT = "#0ea5e9";
const GUIDE = "#f43f5e";
const FIT_PADDING = 56;
/** A quantos pixels DE TELA a caixa encosta na guia. */
const SNAP_SCREEN_PIXELS = 6;
const MIN_SCALE = 0.05;
const MAX_SCALE = 4;

type View = { scale: number; x: number; y: number };

type Engine = {
	stage: Stage;
	frame: Rect;
	content: Layer | null;
	overlay: Layer;
	transformer: Transformer;
	hover: Rect;
	view: View;
	applyView: () => void;
};

type DragState = {
	primaryId: string;
	start: { x: number; y: number };
	ids: string[];
	starts: Map<string, { x: number; y: number }>;
	moving: ArtElement[];
	others: Bounds[];
	delta: { dx: number; dy: number };
};

const clamp = (value: number) =>
	Math.min(MAX_SCALE, Math.max(MIN_SCALE, value));

function intersects(a: Bounds, b: Bounds): boolean {
	return (
		a.x < b.x + b.width &&
		a.x + a.width > b.x &&
		a.y < b.y + b.height &&
		a.y + a.height > b.y
	);
}

function findElementNode(layer: Layer | null, id: string): Group | null {
	return (
		(layer?.findOne(
			(node: KonvaNode) => node.id() === id && node.hasName(ELEMENT_NODE),
		) as Group | undefined) ?? null
	);
}

function attachTransformer(
	engine: Engine,
	selection: readonly string[],
	design: ArtDesign,
	canDesign: boolean,
): void {
	const inactive = new Set(
		design.elements
			.filter((element) => element.locked || !element.visible)
			.map((element) => element.id),
	);
	const nodes = selection
		.filter((id) => !inactive.has(id))
		.map((id) => findElementNode(engine.content, id))
		.filter((node): node is Group => node !== null);
	engine.transformer.nodes(nodes);
	engine.transformer.resizeEnabled(canDesign);
	engine.transformer.rotateEnabled(canDesign);
	engine.hover.visible(false);
	engine.overlay.batchDraw();
}

/**
 * O palco do editor (spec 10, F3): a arte desenhada pela MESMA cena do
 * servidor, e por cima a interação — alças, guias, seleção por área, zoom e
 * mão.
 *
 * Imperativo de propósito. O desenho é a fonte da verdade (estado do React); o
 * Konva só mostra e captura gestos. Durante o arraste o nó se move sozinho, e
 * o desenho só muda ao SOLTAR — uma reconstrução por gesto, não por frame.
 */
export function EditorStage(props: EditorStageProps) {
	const {
		format,
		design,
		content,
		inputs,
		assets,
		fontsReady,
		selection,
		canDesign,
		zoom,
	} = props;
	const [host, setHost] = useState<HTMLDivElement | null>(null);
	const [viewport, setViewport] = useState({ width: 0, height: 0 });
	const [ready, setReady] = useState(false);
	const engineRef = useRef<Engine | null>(null);
	const latest = useRef(props);
	useEffect(() => {
		latest.current = props;
	});

	// ── o palco, uma vez ────────────────────────────────────────────────────
	useEffect(() => {
		if (!host) {
			return;
		}
		const stage = new Konva.Stage({
			container: host,
			width: Math.max(1, host.clientWidth),
			height: Math.max(1, host.clientHeight),
		});
		const under = new Konva.Layer({ listening: false });
		const frame = new Konva.Rect({
			x: 0,
			y: 0,
			width: 1,
			height: 1,
			fill: "#ffffff",
			shadowColor: "#000000",
			shadowBlur: 30,
			shadowOpacity: 0.18,
			shadowOffsetY: 6,
		});
		under.add(frame);

		const overlay = new Konva.Layer();
		const hover = new Konva.Rect({
			stroke: ACCENT,
			strokeWidth: 1.5,
			strokeScaleEnabled: false,
			listening: false,
			visible: false,
		});
		const guides = new Konva.Group({ listening: false });
		const marquee = new Konva.Rect({
			fill: "rgba(14,165,233,0.08)",
			stroke: ACCENT,
			strokeWidth: 1,
			strokeScaleEnabled: false,
			listening: false,
			visible: false,
		});
		const transformer = new Konva.Transformer({
			rotateAnchorOffset: 28,
			anchorSize: 9,
			anchorCornerRadius: 2,
			anchorStroke: ACCENT,
			anchorFill: "#ffffff",
			borderStroke: ACCENT,
			borderStrokeWidth: 1.5,
			ignoreStroke: true,
			flipEnabled: false,
			keepRatio: false,
			rotationSnaps: [0, 45, 90, 135, 180, 225, 270, 315],
			rotationSnapTolerance: 4,
			boundBoxFunc: (oldBox, newBox) =>
				Math.abs(newBox.width) < 8 || Math.abs(newBox.height) < 8
					? oldBox
					: newBox,
		});
		overlay.add(hover, guides, marquee, transformer);
		stage.add(under, overlay);

		const engine: Engine = {
			stage,
			frame,
			content: null,
			overlay,
			transformer,
			hover,
			view: { scale: 1, x: 0, y: 0 },
			applyView: () => {
				stage.scale({ x: engine.view.scale, y: engine.view.scale });
				stage.position({ x: engine.view.x, y: engine.view.y });
				stage.batchDraw();
				latest.current.onScaleChange(engine.view.scale);
			},
		};
		engineRef.current = engine;

		let drag: DragState | null = null;
		let marqueeStart: { x: number; y: number; additive: boolean } | null = null;
		let pan: { x: number; y: number; viewX: number; viewY: number } | null =
			null;
		let spaceDown = false;

		const groupOf = (node: KonvaNode | null): Group | null => {
			let current: KonvaNode | null = node;
			while (current && current !== stage) {
				if (current.hasName(ELEMENT_NODE)) {
					return current as Group;
				}
				current = current.getParent();
			}
			return null;
		};
		const insideTransformer = (node: KonvaNode): boolean => {
			let current: KonvaNode | null = node;
			while (current) {
				if (current === transformer) {
					return true;
				}
				current = current.getParent();
			}
			return false;
		};

		stage.on(
			"mousedown touchstart",
			(event: KonvaEventObject<MouseEvent | TouchEvent>) => {
				const mouse = event.evt as MouseEvent;
				if (spaceDown || mouse.button === 1) {
					pan = {
						x: mouse.clientX,
						y: mouse.clientY,
						viewX: engine.view.x,
						viewY: engine.view.y,
					};
					host.style.cursor = "grabbing";
					return;
				}
				if (insideTransformer(event.target)) {
					return;
				}
				const { selection: current, onSelect } = latest.current;
				const additive = Boolean(
					mouse.shiftKey || mouse.ctrlKey || mouse.metaKey,
				);
				const group = groupOf(event.target);
				if (!group) {
					if (!additive) {
						onSelect([]);
					}
					const pointer = stage.getRelativePointerPosition();
					if (pointer) {
						marqueeStart = { ...pointer, additive };
						marquee.setAttrs({
							x: pointer.x,
							y: pointer.y,
							width: 0,
							height: 0,
							visible: true,
						});
					}
					return;
				}
				const id = group.id();
				if (additive) {
					onSelect(
						current.includes(id)
							? current.filter((item) => item !== id)
							: [...current, id],
					);
				} else if (!current.includes(id)) {
					onSelect([id]);
				}
			},
		);

		stage.on("mousemove touchmove", (event) => {
			const mouse = event.evt as MouseEvent;
			if (pan) {
				engine.view = {
					...engine.view,
					x: pan.viewX + (mouse.clientX - pan.x),
					y: pan.viewY + (mouse.clientY - pan.y),
				};
				engine.applyView();
				return;
			}
			if (marqueeStart) {
				const pointer = stage.getRelativePointerPosition();
				if (!pointer) {
					return;
				}
				marquee.setAttrs({
					x: Math.min(pointer.x, marqueeStart.x),
					y: Math.min(pointer.y, marqueeStart.y),
					width: Math.abs(pointer.x - marqueeStart.x),
					height: Math.abs(pointer.y - marqueeStart.y),
				});
				overlay.batchDraw();
			}
		});

		const finishPointer = () => {
			if (pan) {
				pan = null;
				host.style.cursor = spaceDown ? "grab" : "";
			}
			if (marqueeStart) {
				const area = {
					x: marquee.x(),
					y: marquee.y(),
					width: marquee.width(),
					height: marquee.height(),
				};
				const start = marqueeStart;
				marqueeStart = null;
				marquee.visible(false);
				overlay.batchDraw();
				if (area.width < 3 && area.height < 3) {
					return;
				}
				const {
					design: current,
					selection: selected,
					onSelect,
				} = latest.current;
				const hits = current.elements
					.filter(
						(element) =>
							element.visible &&
							!element.locked &&
							intersects(rotatedBounds(element), area),
					)
					.map((element) => element.id);
				onSelect(start.additive ? [...new Set([...selected, ...hits])] : hits);
			}
		};
		stage.on("mouseup touchend", finishPointer);
		window.addEventListener("mouseup", finishPointer);

		stage.on("mouseover", (event) => {
			const group = groupOf(event.target);
			if (!group || drag || latest.current.selection.includes(group.id())) {
				hover.visible(false);
			} else {
				hover.setAttrs({
					x: group.x(),
					y: group.y(),
					offsetX: group.offsetX(),
					offsetY: group.offsetY(),
					rotation: group.rotation(),
					width: group.offsetX() * 2,
					height: group.offsetY() * 2,
					visible: true,
				});
			}
			overlay.batchDraw();
		});
		stage.on("mouseout", () => {
			hover.visible(false);
			overlay.batchDraw();
		});

		stage.on("dblclick dbltap", (event) => {
			const group = groupOf(event.target);
			if (group) {
				latest.current.onDoubleClick(group.id());
			}
		});

		// ── arrastar, com guias ───────────────────────────────────────────────
		stage.on("dragstart", (event) => {
			const group = event.target;
			if (!group.hasName(ELEMENT_NODE)) {
				return;
			}
			if (spaceDown) {
				group.stopDrag();
				return;
			}
			hover.visible(false);
			const { design: current, selection: selected } = latest.current;
			const ids = selected.includes(group.id()) ? selected : [group.id()];
			const moving = current.elements.filter(
				(element) => ids.includes(element.id) && !element.locked,
			);
			const starts = new Map<string, { x: number; y: number }>();
			for (const element of moving) {
				const node = findElementNode(engine.content, element.id);
				if (node) {
					starts.set(element.id, { x: node.x(), y: node.y() });
				}
			}
			drag = {
				primaryId: group.id(),
				start: { x: group.x(), y: group.y() },
				ids: moving.map((element) => element.id),
				starts,
				moving,
				others: current.elements
					.filter((element) => element.visible && !ids.includes(element.id))
					.map(rotatedBounds),
				delta: { dx: 0, dy: 0 },
			};
		});

		stage.on("dragmove", (event) => {
			if (!drag || event.target.id() !== drag.primaryId) {
				return;
			}
			const size = canvasOf(latest.current.format);
			const raw = {
				dx: event.target.x() - drag.start.x,
				dy: event.target.y() - drag.start.y,
			};
			let { dx, dy } = raw;
			guides.destroyChildren();
			if (!(event.evt as MouseEvent).altKey && drag.moving.length > 0) {
				const bounds = unionBounds(
					drag.moving.map((element) =>
						rotatedBounds({
							...element,
							x: element.x + raw.dx,
							y: element.y + raw.dy,
						}),
					),
				);
				const snap = snapBounds(
					bounds,
					drag.others,
					size,
					SNAP_SCREEN_PIXELS / engine.view.scale,
				);
				dx += snap.dx;
				dy += snap.dy;
				const line = (points: number[]) =>
					new Konva.Line({
						points,
						stroke: GUIDE,
						strokeWidth: 1,
						strokeScaleEnabled: false,
						dash: [4, 4],
					});
				for (const x of snap.guides.vertical) {
					guides.add(line([x, -40, x, size.height + 40]));
				}
				for (const y of snap.guides.horizontal) {
					guides.add(line([-40, y, size.width + 40, y]));
				}
			}
			for (const [id, start] of drag.starts) {
				findElementNode(engine.content, id)?.position({
					x: start.x + dx,
					y: start.y + dy,
				});
			}
			drag.delta = { dx, dy };
			overlay.batchDraw();
		});

		stage.on("dragend", (event) => {
			if (!drag || event.target.id() !== drag.primaryId) {
				return;
			}
			const { ids } = drag;
			const dx = Math.round(drag.delta.dx);
			const dy = Math.round(drag.delta.dy);
			drag = null;
			guides.destroyChildren();
			overlay.batchDraw();
			if (dx === 0 && dy === 0) {
				return;
			}
			latest.current.onCommit(moveElements(latest.current.design, ids, dx, dy));
		});

		transformer.on("transformend", () => {
			const { design: current, onCommit } = latest.current;
			let next = current;
			for (const node of transformer.nodes()) {
				const element = current.elements.find((item) => item.id === node.id());
				if (!element) {
					continue;
				}
				const geometry = geometryFromNode({
					x: node.x(),
					y: node.y(),
					width: element.width,
					height: element.height,
					scaleX: node.scaleX(),
					scaleY: node.scaleY(),
					rotation: node.rotation(),
				});
				next = updateElements(next, [element.id], (item) => ({
					...item,
					...geometry,
				}));
			}
			onCommit(next);
		});

		// ── zoom e mão ────────────────────────────────────────────────────────
		stage.on("wheel", (event) => {
			const wheel = event.evt as WheelEvent;
			wheel.preventDefault();
			if (wheel.ctrlKey || wheel.metaKey) {
				const pointer = stage.getPointerPosition();
				if (!pointer) {
					return;
				}
				const old = engine.view.scale;
				const scale = clamp(old * Math.exp(-wheel.deltaY * 0.0015));
				const world = {
					x: (pointer.x - engine.view.x) / old,
					y: (pointer.y - engine.view.y) / old,
				};
				engine.view = {
					scale,
					x: pointer.x - world.x * scale,
					y: pointer.y - world.y * scale,
				};
			} else {
				engine.view = {
					...engine.view,
					x: engine.view.x - wheel.deltaX,
					y: engine.view.y - wheel.deltaY,
				};
			}
			engine.applyView();
		});

		const typing = (target: EventTarget | null) =>
			target instanceof HTMLElement &&
			(target.isContentEditable ||
				["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName));
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.code === "Space" && !typing(event.target) && !spaceDown) {
				spaceDown = true;
				host.style.cursor = "grab";
				event.preventDefault();
			}
		};
		const onKeyUp = (event: KeyboardEvent) => {
			if (event.code === "Space") {
				spaceDown = false;
				host.style.cursor = "";
			}
		};
		window.addEventListener("keydown", onKeyDown);
		window.addEventListener("keyup", onKeyUp);

		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				setViewport({
					width: Math.floor(entry.contentRect.width),
					height: Math.floor(entry.contentRect.height),
				});
			}
		});
		observer.observe(host);
		setReady(true);

		return () => {
			observer.disconnect();
			window.removeEventListener("mouseup", finishPointer);
			window.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("keyup", onKeyUp);
			stage.destroy();
			engineRef.current = null;
			setReady(false);
		};
	}, [host]);

	// ── tamanho e zoom ──────────────────────────────────────────────────────
	const zoomKey = `${zoom.mode}:${zoom.nonce}`;
	// biome-ignore lint/correctness/useExhaustiveDependencies: o pedido de zoom vale pela chave; o resto vem de `latest`
	useEffect(() => {
		const engine = engineRef.current;
		if (!engine || viewport.width === 0 || viewport.height === 0) {
			return;
		}
		engine.stage.size(viewport);
		const size = canvasOf(format);
		const request = latest.current.zoom;
		if (request.mode === "fit") {
			const scale = clamp(
				Math.min(
					(viewport.width - 2 * FIT_PADDING) / size.width,
					(viewport.height - 2 * FIT_PADDING) / size.height,
				),
			);
			engine.view = {
				scale,
				x: (viewport.width - size.width * scale) / 2,
				y: (viewport.height - size.height * scale) / 2,
			};
		} else {
			const old = engine.view;
			const center = {
				x: (viewport.width / 2 - old.x) / old.scale,
				y: (viewport.height / 2 - old.y) / old.scale,
			};
			const scale = clamp(request.scale);
			engine.view = {
				scale,
				x: viewport.width / 2 - center.x * scale,
				y: viewport.height / 2 - center.y * scale,
			};
		}
		engine.applyView();
	}, [ready, viewport.width, viewport.height, zoomKey, format]);

	// ── a arte ──────────────────────────────────────────────────────────────
	// biome-ignore lint/correctness/useExhaustiveDependencies: `ready` redesenha depois de o palco nascer
	useEffect(() => {
		const engine = engineRef.current;
		if (!engine) {
			return;
		}
		const size = canvasOf(format);
		engine.frame.setAttrs({ width: size.width, height: size.height });
		const { layer, warnings } = buildArtLayer(Konva, {
			format,
			design,
			content,
			inputs,
			assets,
			options: { editor: true },
		});
		layer.clip({ x: 0, y: 0, width: size.width, height: size.height });
		const byId = new Map(
			design.elements.map((element) => [element.id, element]),
		);
		for (const node of layer.find(`.${ELEMENT_NODE}`)) {
			const element = byId.get(node.id());
			const active = Boolean(element?.visible && !element.locked);
			node.listening(active);
			node.draggable(active && canDesign);
		}
		engine.content?.destroy();
		engine.content = layer;
		engine.stage.add(layer);
		engine.overlay.moveToTop();
		attachTransformer(engine, latest.current.selection, design, canDesign);
		engine.stage.batchDraw();
		if (fontsReady) {
			latest.current.onWarnings(warnings);
		}
	}, [ready, format, design, content, inputs, assets, fontsReady, canDesign]);

	// ── seleção ─────────────────────────────────────────────────────────────
	// biome-ignore lint/correctness/useExhaustiveDependencies: `ready` só existe para reanexar depois de o palco nascer
	useEffect(() => {
		const engine = engineRef.current;
		if (engine) {
			attachTransformer(engine, selection, design, canDesign);
		}
	}, [ready, selection, design, canDesign]);

	return <div ref={setHost} className="size-full touch-none select-none" />;
}
