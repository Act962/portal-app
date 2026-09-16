"use client";

import { Button } from "@portal-app/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Check, Crop, Move, RotateCcw } from "lucide-react";
import { type PointerEvent, useRef, useState } from "react";

type Selection = { x: number; y: number; zoom: number };
type Props = {
	url: string;
	alt: string;
	initial: Selection;
	pending: boolean;
	onClose: () => void;
	onApply: (selection: Selection) => void;
};

const clamp = (value: number, min: number, max: number) =>
	Math.max(min, Math.min(max, value));

export function CoverCropEditor({
	url,
	alt,
	initial,
	pending,
	onClose,
	onApply,
}: Props) {
	const [selection, setSelection] = useState(initial);
	const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
	const [imageError, setImageError] = useState(false);
	const image = useRef<HTMLImageElement>(null);
	const gesture = useRef<{
		mode: string;
		pointerId: number;
		x: number;
		y: number;
		left: number;
		top: number;
		width: number;
		scale: number;
	} | null>(null);
	const base = Math.min(dimensions.width, (dimensions.height * 16) / 9);
	const width = base / selection.zoom;
	const height = (width * 9) / 16;
	const left = (dimensions.width - width) * selection.x;
	const top = (dimensions.height - height) * selection.y;
	const ready = dimensions.width > 0;

	function start(event: PointerEvent<HTMLButtonElement>, mode: string) {
		if (pending || !image.current || event.button !== 0) return;
		event.preventDefault();
		event.currentTarget.setPointerCapture(event.pointerId);
		gesture.current = {
			mode,
			pointerId: event.pointerId,
			x: event.clientX,
			y: event.clientY,
			left,
			top,
			width,
			scale: dimensions.width / image.current.getBoundingClientRect().width,
		};
	}
	function move(event: PointerEvent<HTMLButtonElement>) {
		const drag = gesture.current;
		if (!drag || drag.pointerId !== event.pointerId) return;
		const dx = (event.clientX - drag.x) * drag.scale;
		const dy = (event.clientY - drag.y) * drag.scale;
		let nextWidth = drag.width;
		let nextLeft = drag.left + dx;
		let nextTop = drag.top + dy;
		if (drag.mode !== "move") {
			const west = drag.mode.includes("w");
			const north = drag.mode.includes("n");
			const anchorX = west ? drag.left + drag.width : drag.left;
			const anchorY = north ? drag.top + (drag.width * 9) / 16 : drag.top;
			const change =
				Math.abs(dx) > Math.abs((dy * 16) / 9)
					? dx * (west ? -1 : 1)
					: (dy * (north ? -1 : 1) * 16) / 9;
			const maxWidth = Math.min(
				west ? anchorX : dimensions.width - anchorX,
				((north ? anchorY : dimensions.height - anchorY) * 16) / 9,
			);
			nextWidth = clamp(drag.width + change, base / 3, maxWidth);
			nextLeft = west ? anchorX - nextWidth : anchorX;
			nextTop = north ? anchorY - (nextWidth * 9) / 16 : anchorY;
		}
		const remainingX = dimensions.width - nextWidth;
		const remainingY = dimensions.height - (nextWidth * 9) / 16;
		setSelection({
			x: remainingX > 0 ? clamp(nextLeft / remainingX, 0, 1) : 0.5,
			y: remainingY > 0 ? clamp(nextTop / remainingY, 0, 1) : 0.5,
			zoom: clamp(base / nextWidth, 1, 3),
		});
	}
	function end() {
		gesture.current = null;
	}

	return (
		<Dialog
			open
			onOpenChange={(open) => {
				if (!open && !pending) onClose();
			}}
		>
			<DialogContent
				className="gap-0 overflow-y-auto p-0 sm:max-w-5xl"
				showCloseButton={false}
			>
				<DialogHeader className="border-b px-5 py-4">
					<DialogTitle className="flex items-center gap-2">
						<Crop className="size-4" />
						Recortar imagem de capa
					</DialogTitle>
					<DialogDescription>
						Arraste a seleção para enquadrar. Use os cantos para ajustar o
						recorte.
					</DialogDescription>
				</DialogHeader>
				<div className="flex min-h-56 items-center justify-center overflow-hidden bg-[#101113] px-8 py-10 sm:px-14">
					<div className="relative inline-flex min-w-0 select-none">
						<img
							ref={image}
							src={url}
							alt={alt}
							draggable={false}
							className="block max-h-[40dvh] max-w-full object-contain sm:max-h-[55dvh]"
							onError={() => setImageError(true)}
							onLoad={(event) =>
								setDimensions({
									width: event.currentTarget.naturalWidth,
									height: event.currentTarget.naturalHeight,
								})
							}
						/>
						{imageError ? (
							<p role="alert" className="p-6 text-sm text-white">
								Não foi possível carregar a imagem. Feche e tente novamente.
							</p>
						) : null}
						{ready ? (
							<div
								className="absolute border-2 border-white shadow-[0_0_0_9999px_rgba(0,0,0,0.65)]"
								style={{
									left: `${(left / dimensions.width) * 100}%`,
									top: `${(top / dimensions.height) * 100}%`,
									width: `${(width / dimensions.width) * 100}%`,
									height: `${(height / dimensions.height) * 100}%`,
								}}
							>
								<button
									type="button"
									aria-label="Mover recorte. Use as setas para ajustar a posição."
									disabled={pending}
									className="absolute inset-0 cursor-grab touch-none outline-none focus-visible:ring-2 focus-visible:ring-brand-accent active:cursor-grabbing"
									onPointerDown={(e) => start(e, "move")}
									onPointerMove={move}
									onPointerUp={end}
									onPointerCancel={end}
									onLostPointerCapture={end}
									onKeyDown={(e) => {
										if (!e.key.startsWith("Arrow")) return;
										e.preventDefault();
										const step = e.shiftKey ? 0.1 : 0.01;
										setSelection((value) => ({
											...value,
											x: clamp(
												value.x +
													(e.key === "ArrowRight"
														? step
														: e.key === "ArrowLeft"
															? -step
															: 0),
												0,
												1,
											),
											y: clamp(
												value.y +
													(e.key === "ArrowDown"
														? step
														: e.key === "ArrowUp"
															? -step
															: 0),
												0,
												1,
											),
										}));
									}}
								>
									<span className="pointer-events-none absolute inset-0 grid grid-cols-3 grid-rows-3">
										{Array.from({ length: 9 }, (_, index) => (
											<span
												key={`grid-${index}`}
												className="border-white/25 [&:not(:nth-child(3n))]:border-r [&:nth-child(-n+6)]:border-b"
											/>
										))}
									</span>
								</button>
								{(["nw", "ne", "sw", "se"] as const).map((corner) => (
									<button
										key={corner}
										type="button"
										aria-label={`Redimensionar recorte: canto ${corner.includes("n") ? "superior" : "inferior"} ${corner.includes("w") ? "esquerdo" : "direito"}. Use as setas para cima e para baixo.`}
										disabled={pending}
										className="absolute z-10 size-7 touch-none rounded-sm outline-none focus-visible:bg-brand-accent"
										style={{
											left: corner.includes("w") ? 0 : "100%",
											top: corner.includes("n") ? 0 : "100%",
											transform: "translate(-50%, -50%)",
											cursor:
												corner === "nw" || corner === "se"
													? "nwse-resize"
													: "nesw-resize",
										}}
										onPointerDown={(e) => start(e, corner)}
										onPointerMove={move}
										onPointerUp={end}
										onPointerCancel={end}
										onLostPointerCapture={end}
										onKeyDown={(e) => {
											if (e.key !== "ArrowUp" && e.key !== "ArrowDown") return;
											e.preventDefault();
											setSelection((value) => ({
												...value,
												zoom: clamp(
													value.zoom + (e.key === "ArrowUp" ? 0.05 : -0.05),
													1,
													3,
												),
											}));
										}}
									>
										<span
											className="absolute inset-1.5 border-white"
											style={{
												borderLeftWidth: corner.includes("w") ? 3 : 0,
												borderRightWidth: corner.includes("e") ? 3 : 0,
												borderTopWidth: corner.includes("n") ? 3 : 0,
												borderBottomWidth: corner.includes("s") ? 3 : 0,
											}}
										/>
									</button>
								))}
							</div>
						) : null}
					</div>
				</div>
				<div className="flex flex-wrap items-center justify-between gap-3 border-t px-5 py-4">
					<div className="flex items-center gap-3">
						<span className="rounded-md border px-2 py-1 font-medium text-xs">
							16:9
						</span>
						<span className="text-muted-foreground text-xs">
							{Math.floor(width)} × {Math.floor(height)} px
						</span>
					</div>
					<div className="flex items-center gap-2">
						<Button
							variant="ghost"
							size="sm"
							disabled={pending}
							onClick={() => setSelection({ x: 0.5, y: 0.5, zoom: 1 })}
						>
							<RotateCcw className="size-4" />
							Redefinir
						</Button>
						<Button
							variant="outline"
							size="sm"
							disabled={pending}
							onClick={onClose}
						>
							Cancelar
						</Button>
						<Button
							size="sm"
							disabled={pending || !ready || imageError}
							onClick={() => onApply(selection)}
						>
							<Check className="size-4" />
							{pending ? "Aplicando…" : "Aplicar recorte"}
						</Button>
					</div>
				</div>
				<p className="flex items-center gap-2 border-t px-5 py-2 text-muted-foreground text-xs">
					<Move className="size-3" />O original será preservado. Use as setas
					para ajustes finos.
				</p>
			</DialogContent>
		</Dialog>
	);
}
