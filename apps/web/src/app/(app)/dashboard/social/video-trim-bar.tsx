"use client";

import {
	clipDuration,
	formatSeconds,
	type VideoClip,
} from "@portal-app/social";
import { cn } from "@portal-app/ui/lib/utils";
import { useCallback, useEffect, useRef, useState } from "react";

import {
	fractionOf,
	secondsAt,
	shiftBy,
	stepFor,
	withHandle,
} from "./video-trim-model";

/**
 * A barra de corte: a régua do arquivo inteiro, a faixa do trecho escolhido e
 * duas alças.
 *
 * Toda a aritmética mora em `video-trim-model.ts`; aqui só há arraste, teclado
 * e pixels. As alças são `<button>` com `role="slider"` de propósito: uma barra
 * de corte feita de `<div>` funciona com o mouse e não existe para quem usa
 * teclado — e acertar o segundo exato num arquivo longo só é possível com as
 * setas (Shift dá o passo fino de um décimo).
 */
export function VideoTrimBar({
	clip,
	onChange,
	onCommit,
	disabled,
	/** Onde o vídeo está tocando agora, para o risco de posição. */
	currentSeconds,
}: {
	clip: VideoClip;
	onChange: (clip: VideoClip) => void;
	/** Fim do arraste — é quando vale gravar no servidor. */
	onCommit: (clip: VideoClip) => void;
	disabled?: boolean;
	currentSeconds?: number | null;
}) {
	const track = useRef<HTMLDivElement | null>(null);
	const [dragging, setDragging] = useState<"start" | "end" | null>(null);

	const secondsFromPointer = useCallback((clientX: number) => {
		const element = track.current;
		if (!element) {
			return 0;
		}
		const rect = element.getBoundingClientRect();
		return rect.width === 0 ? 0 : (clientX - rect.left) / rect.width;
	}, []);

	// O arraste ouve a JANELA, não a barra: o ponteiro sai da faixa de 40 px de
	// altura no primeiro movimento vertical, e sem isto a alça ficaria para trás
	// toda vez que alguém arrastasse rápido.
	useEffect(() => {
		if (!dragging) {
			return;
		}
		const move = (event: PointerEvent) => {
			onChange(
				withHandle(
					clip,
					dragging,
					secondsAt(secondsFromPointer(event.clientX), clip.sourceSeconds),
				),
			);
		};
		const up = () => {
			setDragging(null);
			onCommit(clip);
		};
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		return () => {
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
		};
	}, [dragging, clip, onChange, onCommit, secondsFromPointer]);

	const left = fractionOf(clip.startSeconds, clip.sourceSeconds) * 100;
	const right = fractionOf(clip.endSeconds, clip.sourceSeconds) * 100;
	const playhead =
		typeof currentSeconds === "number"
			? fractionOf(currentSeconds, clip.sourceSeconds) * 100
			: null;

	const onKey = (handle: "start" | "end") => (event: React.KeyboardEvent) => {
		const step = stepFor(event.shiftKey);
		const delta =
			event.key === "ArrowLeft" ? -step : event.key === "ArrowRight" ? step : 0;
		if (delta === 0) {
			return;
		}
		event.preventDefault();
		const next = withHandle(
			clip,
			handle,
			(handle === "start" ? clip.startSeconds : clip.endSeconds) + delta,
		);
		onChange(next);
		onCommit(next);
	};

	return (
		<div className="flex flex-col gap-1.5">
			<div
				ref={track}
				className={cn(
					"relative h-11 w-full rounded-md border bg-muted",
					disabled && "opacity-50",
				)}
			>
				{/* O trecho escolhido. O resto da régua fica apagado — é o que se
				    descarta, e vê-lo ajuda a entender o que a alça faz. */}
				<div
					className="absolute inset-y-0 rounded-md bg-primary/20 ring-1 ring-primary/40"
					style={{ left: `${left}%`, right: `${100 - right}%` }}
				/>
				{playhead !== null ? (
					<div
						className="pointer-events-none absolute inset-y-1 w-0.5 rounded bg-foreground/70"
						style={{ left: `${playhead}%` }}
					/>
				) : null}
				<Handle
					position={left}
					label="Início do trecho"
					value={clip.startSeconds}
					max={clip.sourceSeconds}
					disabled={disabled}
					onGrab={() => setDragging("start")}
					onKeyDown={onKey("start")}
				/>
				<Handle
					position={right}
					label="Fim do trecho"
					value={clip.endSeconds}
					max={clip.sourceSeconds}
					disabled={disabled}
					onGrab={() => setDragging("end")}
					onKeyDown={onKey("end")}
				/>
			</div>
			<div className="flex items-center justify-between text-muted-foreground text-xs tabular-nums">
				<span>{formatSeconds(clip.startSeconds)}</span>
				<span className="font-medium text-foreground">
					{formatSeconds(clipDuration(clip))} no ar
				</span>
				<span>{formatSeconds(clip.sourceSeconds)}</span>
			</div>
			<div className="flex gap-2">
				<button
					type="button"
					disabled={disabled}
					className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
					onClick={() => {
						const next = shiftBy(clip, -clipDuration(clip));
						onChange(next);
						onCommit(next);
					}}
				>
					Trecho anterior
				</button>
				<button
					type="button"
					disabled={disabled}
					className="rounded border px-2 py-1 text-xs hover:bg-accent disabled:opacity-50"
					onClick={() => {
						const next = shiftBy(clip, clipDuration(clip));
						onChange(next);
						onCommit(next);
					}}
				>
					Próximo trecho
				</button>
			</div>
		</div>
	);
}

function Handle({
	position,
	label,
	value,
	max,
	disabled,
	onGrab,
	onKeyDown,
}: {
	position: number;
	label: string;
	value: number;
	max: number;
	disabled?: boolean;
	onGrab: () => void;
	onKeyDown: (event: React.KeyboardEvent) => void;
}) {
	return (
		<button
			type="button"
			role="slider"
			aria-label={label}
			aria-valuemin={0}
			aria-valuemax={Math.round(max)}
			aria-valuenow={Math.round(value)}
			aria-valuetext={formatSeconds(value)}
			disabled={disabled}
			className="absolute inset-y-0 w-4 -translate-x-1/2 cursor-ew-resize rounded bg-primary disabled:cursor-not-allowed"
			style={{ left: `${position}%` }}
			onPointerDown={(event) => {
				if (disabled) {
					return;
				}
				event.preventDefault();
				onGrab();
			}}
			onKeyDown={onKeyDown}
		/>
	);
}
