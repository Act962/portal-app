"use client";

import { buildArtLayer } from "@portal-app/art-scene";
import {
	type ArtContent,
	type ArtDesign,
	type ArtFormat,
	type ArtInputs,
	canvasOf,
	NO_INPUTS,
} from "@portal-app/social";
import { cn } from "@portal-app/ui/lib/utils";
import Konva from "konva";
import { useEffect, useRef, useState } from "react";

import { useArtFontsReady } from "./art-fonts";
import { useArtAssets } from "./use-art-assets";

/**
 * A arte desenhada no navegador, com a MESMA cena que o servidor publica
 * (spec 10, D1 e D9). Atualiza a cada mudança, sem ir ao servidor — é a prévia
 * do post, do cartão da matéria e das miniaturas dos padrões.
 */
export function ArtCanvas({
	format,
	design,
	content,
	inputs = NO_INPUTS,
	photoMediaId = null,
	onWarnings,
	label,
	transparent = false,
	className,
}: {
	format: ArtFormat;
	design: ArtDesign;
	content: ArtContent;
	inputs?: ArtInputs;
	photoMediaId?: string | null;
	/** Os textos que não cabem — só depois das fontes carregadas, quando a medida vale. */
	onWarnings?: (warnings: string[]) => void;
	/**
	 * O que o leitor de tela anuncia. `null` é camada DECORATIVA — uma das duas
	 * metades de uma prévia de vídeo (spec 12), que sozinha não descreve nada e
	 * seria só ruído anunciada duas vezes.
	 */
	label: string | null;
	/**
	 * O cinza de fundo enquanto o desenho não chega. Some na camada de cima de
	 * uma prévia de vídeo, que precisa deixar o vídeo aparecer por baixo.
	 */
	transparent?: boolean;
	className?: string;
}) {
	const [host, setHost] = useState<HTMLDivElement | null>(null);
	const [width, setWidth] = useState(0);
	const fontsReady = useArtFontsReady(design);
	const { assets } = useArtAssets(design, photoMediaId);

	const reportRef = useRef(onWarnings);
	useEffect(() => {
		reportRef.current = onWarnings;
	});

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

	const key = JSON.stringify({ format, design, content, inputs });
	// biome-ignore lint/correctness/useExhaustiveDependencies: redesenha pela chave do desenho, não pela identidade dos objetos
	useEffect(() => {
		if (!host || width === 0) {
			return;
		}
		const canvas = canvasOf(format);
		const scale = width / canvas.width;
		const stage = new Konva.Stage({
			container: host,
			width,
			height: Math.round(canvas.height * scale),
			scaleX: scale,
			scaleY: scale,
			listening: false,
		});
		const { layer, warnings } = buildArtLayer(Konva, {
			format,
			design,
			content,
			inputs,
			assets,
		});
		stage.add(layer);
		if (fontsReady) {
			reportRef.current?.(warnings);
		}
		return () => {
			stage.destroy();
		};
	}, [host, width, key, assets, fontsReady]);

	const ratio =
		format === "9:16" ? "9 / 16" : format === "1:1" ? "1 / 1" : "4 / 5";

	return (
		<div
			ref={setHost}
			{...(label === null
				? { "aria-hidden": true }
				: { role: "img", "aria-label": label })}
			className={cn(
				"relative w-full overflow-hidden",
				transparent ? "bg-transparent" : "bg-muted",
				className,
			)}
			style={{ aspectRatio: ratio }}
		/>
	);
}
