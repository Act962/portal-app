"use client";

import {
	type ArtContent,
	type ArtDesign,
	type ArtFormat,
	type ArtInputs,
	canvasOf,
	clipDuration,
	clipOffsets,
	NO_INPUTS,
	sequenceDuration,
	type VideoSequence,
	videoFrameFor,
} from "@portal-app/social";
import { cn } from "@portal-app/ui/lib/utils";
import { useEffect, useMemo, useRef, useState } from "react";

import { positionAt } from "@/app/(app)/dashboard/social/videos/video-editor-model";

import { ArtCanvas } from "./art-canvas";
import { videoBoxStyle } from "./video-frame-style";

/**
 * A prévia do vídeo dentro do padrão (spec 12, D4): os trechos TOCANDO no
 * lugar da foto, com o desenho por baixo e por cima.
 *
 * É o coração da usabilidade desta feature, e a razão de ela não precisar de um
 * botão "gerar prévia": o que se vê aqui é o arquivo que vai ao ar, montado
 * pela MESMA função que o servidor usa (`videoFrameFor`) e desenhado pela MESMA
 * cena (`ArtCanvas`). Quem arrasta um corte vê o resultado no mesmo segundo,
 * sem nenhuma volta ao servidor e sem transcodificar nada.
 *
 * A pilha é literalmente a do ffmpeg, em três camadas de CSS:
 *
 * ```
 *   ArtCanvas(over)   ← z-30, com transparência
 *   <video>           ← z-20, recortado na caixa do padrão
 *   ArtCanvas(under)  ← z-10, o fundo do quadro
 * ```
 *
 * **A emenda é simulada, não montada.** Com vários trechos, o mesmo elemento
 * `<video>` troca de arquivo e de posição na hora certa (`positionAt`): quem
 * assiste vê a montagem inteira, e nada foi transcodificado para isso.
 */
export function VideoArtPreview({
	format,
	design,
	content,
	inputs = NO_INPUTS,
	clips,
	urlFor,
	focal,
	playing,
	onEnded,
	onProgress,
	className,
	label,
}: {
	format: ArtFormat;
	design: ArtDesign;
	content: ArtContent;
	inputs?: ArtInputs;
	clips: VideoSequence;
	/** O arquivo de cada mídia: a URL pública, ou `null` se ainda não chegou. */
	urlFor: (mediaId: string) => string | null;
	focal?: { x: number; y: number };
	/** Tocando a montagem, do começo ao fim, em laço. */
	playing: boolean;
	onEnded?: () => void;
	/** Onde a montagem está, em segundos — para a linha do tempo acompanhar. */
	onProgress?: (seconds: number) => void;
	className?: string;
	label: string;
}) {
	const [host, setHost] = useState<HTMLDivElement | null>(null);
	const [width, setWidth] = useState(0);
	const [at, setAt] = useState(0);
	const video = useRef<HTMLVideoElement | null>(null);
	const report = useRef(onProgress);
	const ended = useRef(onEnded);
	useEffect(() => {
		report.current = onProgress;
		ended.current = onEnded;
	});

	const frame = useMemo(
		() => videoFrameFor({ format, design, focal, clips }),
		[format, design, focal, clips],
	);
	const canvas = canvasOf(format);
	const scale = width === 0 ? 0 : width / canvas.width;
	const total = sequenceDuration(clips);
	const offsets = useMemo(() => clipOffsets(clips), [clips]);

	// Qual trecho toca agora, e em que ponto DO ARQUIVO dele.
	const position = positionAt(clips, at);
	const current = position ? clips[position.index] : null;
	const url = current ? urlFor(current.mediaId) : null;

	useEffect(() => {
		if (!host) {
			return;
		}
		const observer = new ResizeObserver(([entry]) => {
			if (entry) {
				setWidth(Math.floor(entry.contentRect.width));
			}
		});
		observer.observe(host);
		return () => observer.disconnect();
	}, [host]);

	// Trocou de trecho: leva o tocador ao ponto certo do arquivo. Sem isto, a
	// emenda mostraria o começo do arquivo seguinte em vez do corte escolhido.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reagir à troca de trecho, não a cada segundo
	useEffect(() => {
		const element = video.current;
		if (element && position) {
			element.currentTime = position.sourceSeconds;
		}
	}, [position?.index, url]);

	// `url` está na lista de propósito, e o Biome acha que sobra: ao trocar de
	// trecho o `src` muda, o navegador PAUSA sozinho, e sem reexecutar isto a
	// montagem pararia no primeiro corte.
	useEffect(() => {
		const element = video.current;
		if (!element) {
			return;
		}
		if (playing) {
			// O navegador recusa o play automático com som; o `catch` é o que
			// impede uma promessa rejeitada de virar erro no console.
			void element.play().catch(() => undefined);
		} else {
			element.pause();
		}
	}, [playing, url]);

	// Volta ao começo quando o corte muda por baixo — arrastar a alça recomeça
	// a prévia no que se está ajustando, que é o que se quer ver.
	const clipsKey = JSON.stringify(clips);
	// biome-ignore lint/correctness/useExhaustiveDependencies: a chave é o conteúdo, não a identidade
	useEffect(() => {
		setAt(0);
	}, [clipsKey]);

	const ratio =
		format === "9:16" ? "9 / 16" : format === "1:1" ? "1 / 1" : "4 / 5";

	return (
		<div
			ref={setHost}
			className={cn("relative w-full overflow-hidden bg-muted", className)}
			style={{ aspectRatio: ratio }}
			role="img"
			aria-label={label}
		>
			<ArtCanvas
				format={format}
				design={frame.under}
				content={content}
				inputs={inputs}
				label={null}
				className="absolute inset-0 z-10"
			/>
			{url && scale > 0 ? (
				<video
					ref={video}
					src={url}
					muted={current?.muted ?? false}
					playsInline
					preload="metadata"
					className="z-20"
					style={videoBoxStyle(frame, scale)}
					onTimeUpdate={(event) => {
						const element = event.currentTarget;
						if (!current || !position) {
							return;
						}
						const offset = offsets[position.index] ?? 0;
						const into = element.currentTime - current.startSeconds;
						// Passou do fim do trecho: salta para o começo do próximo —
						// ou recomeça a montagem, se este era o último.
						if (into >= clipDuration(current) - 0.03) {
							const next = offset + clipDuration(current);
							if (next >= total - 0.03) {
								setAt(0);
								ended.current?.();
							} else {
								setAt(next);
								report.current?.(next);
							}
							return;
						}
						const elapsed = offset + Math.max(0, into);
						setAt(elapsed);
						report.current?.(elapsed);
					}}
				/>
			) : null}
			<ArtCanvas
				format={format}
				design={frame.over}
				content={content}
				inputs={inputs}
				label={null}
				transparent
				className="pointer-events-none absolute inset-0 z-30"
			/>
		</div>
	);
}
