"use client";

import {
	clipDuration,
	clipOffsets,
	formatSeconds,
	MAX_CLIPS,
	sequenceDuration,
	type VideoSequence,
} from "@portal-app/social";
import { Button } from "@portal-app/ui/components/button";
import { cn } from "@portal-app/ui/lib/utils";
import {
	ChevronLeft,
	ChevronRight,
	Plus,
	Trash2,
	Volume2,
	VolumeX,
} from "lucide-react";

import { trackWidths } from "./video-editor-model";

/**
 * A linha do tempo: os trechos lado a lado, na largura do tempo que ocupam.
 *
 * Cada faixa é um `<button>` — a seleção precisa funcionar pelo teclado, e o
 * painel de corte abaixo é o que muda com ela. A ordem se muda pelas setas, e
 * não arrastando: arrastar dentro de uma faixa de 40 px de altura briga com o
 * arraste das alças de corte logo abaixo, e o conflito é exatamente o tipo de
 * coisa que faz alguém cortar o trecho errado sem perceber.
 */
export function VideoTimeline({
	clips,
	selected,
	onSelect,
	onChange,
	onAdd,
	disabled,
	/** Onde a prévia está, em segundos da montagem. */
	playheadSeconds,
}: {
	clips: VideoSequence;
	selected: number;
	onSelect: (index: number) => void;
	onChange: (clips: VideoSequence) => void;
	onAdd: () => void;
	disabled?: boolean;
	playheadSeconds?: number | null;
}) {
	const total = sequenceDuration(clips);
	const widths = trackWidths(clips);
	const offsets = clipOffsets(clips);
	const playhead =
		typeof playheadSeconds === "number" && total > 0
			? Math.min(100, Math.max(0, (playheadSeconds / total) * 100))
			: null;

	const move = (from: number, to: number) => {
		if (to < 0 || to >= clips.length) {
			return;
		}
		const next = [...clips];
		const [moved] = next.splice(from, 1);
		if (moved) {
			next.splice(to, 0, moved);
		}
		onChange(next);
		onSelect(to);
	};

	return (
		<div className="flex flex-col gap-2">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="font-medium text-sm">
					Linha do tempo{" "}
					<span className="font-normal text-muted-foreground">
						({clips.length}/{MAX_CLIPS} · {formatSeconds(total)} no ar)
					</span>
				</p>
				<Button
					type="button"
					variant="outline"
					size="sm"
					disabled={disabled || clips.length >= MAX_CLIPS}
					onClick={onAdd}
				>
					<Plus className="size-4" />
					Acrescentar trecho
				</Button>
			</div>

			{clips.length === 0 ? (
				<p className="rounded-md border border-dashed p-6 text-center text-muted-foreground text-sm">
					Nenhum trecho ainda. Acrescente o primeiro vídeo para começar.
				</p>
			) : (
				<div className="relative flex h-16 w-full gap-1 rounded-md border bg-muted p-1">
					{clips.map((clip, index) => (
						<button
							// A posição É a identidade do trecho na montagem: o mesmo
							// arquivo aparece duas vezes, e o que distingue as faixas é a
							// ordem, não o conteúdo.
							key={index}
							type="button"
							onClick={() => onSelect(index)}
							// `flexBasis` + encolher, e não `width`: as porcentagens somam
							// 100 e os vãos entre as faixas vêm POR CIMA disso. Com
							// largura fixa a última faixa saía da caixa (o
							// `overflow-hidden` só escondia o problema); como base
							// flexível, os vãos são absorvidos proporcionalmente.
							style={{ flexBasis: `${widths[index]}%` }}
							className={cn(
								"flex min-w-0 shrink flex-col justify-between overflow-hidden rounded px-2 py-1 text-left text-xs transition",
								index === selected
									? "bg-primary/25 ring-2 ring-primary"
									: "bg-background hover:bg-accent",
							)}
						>
							<span className="truncate font-medium">
								{index + 1} · {formatSeconds(clipDuration(clip))}
							</span>
							<span className="truncate text-muted-foreground">
								{formatSeconds(offsets[index] ?? 0)}
								{clip.muted ? " · mudo" : ""}
							</span>
						</button>
					))}
					{playhead !== null ? (
						<div
							className="pointer-events-none absolute inset-y-0 w-0.5 bg-foreground/70"
							style={{ left: `${playhead}%` }}
						/>
					) : null}
				</div>
			)}

			{clips.length > 0 ? (
				<div className="flex flex-wrap gap-2">
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled || selected <= 0}
						onClick={() => move(selected, selected - 1)}
					>
						<ChevronLeft className="size-4" />
						Antes
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled || selected >= clips.length - 1}
						onClick={() => move(selected, selected + 1)}
					>
						Depois
						<ChevronRight className="size-4" />
					</Button>
					<Button
						type="button"
						variant="outline"
						size="sm"
						disabled={disabled}
						onClick={() => {
							const clip = clips[selected];
							if (!clip) {
								return;
							}
							onChange(
								clips.map((current, index) =>
									index === selected
										? { ...current, muted: !clip.muted }
										: current,
								),
							);
						}}
					>
						{clips[selected]?.muted ? (
							<VolumeX className="size-4" />
						) : (
							<Volume2 className="size-4" />
						)}
						{clips[selected]?.muted ? "Sem som" : "Com som"}
					</Button>
					<Button
						type="button"
						variant="ghost"
						size="sm"
						disabled={disabled}
						onClick={() => {
							onChange(clips.filter((_, index) => index !== selected));
							onSelect(Math.max(0, selected - 1));
						}}
					>
						<Trash2 className="size-4" />
						Tirar trecho
					</Button>
				</div>
			) : null}
		</div>
	);
}
