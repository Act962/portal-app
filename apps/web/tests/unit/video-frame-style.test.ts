import {
	type ArtDesign,
	type VideoClip,
	videoFrameFor,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

import { videoBoxStyle } from "@/components/art/video-frame-style";

/**
 * A prévia do editor põe um `<video>` de verdade no buraco que o padrão
 * deixou. Estes testes travam a tradução "caixa do quadro → pixels da prévia" —
 * meio por cento de erro aqui não quebra nada, só faz a prévia MENTIR sobre
 * onde o vídeo vai sair.
 */

const CLIP: VideoClip = {
	mediaId: "v-1",
	sourceSeconds: 60,
	startSeconds: 0,
	endSeconds: 20,
	muted: false,
};

function frame(
	extra: Record<string, unknown> = {},
	focal?: { x: number; y: number },
) {
	const elements = [
		{
			id: "foto",
			name: "",
			kind: "PHOTO" as const,
			x: 60,
			y: 420,
			width: 960,
			height: 540,
			rotation: 0,
			opacity: 1,
			visible: true,
			locked: false,
			cornerRadius: 0,
			stroke: null,
			...extra,
		},
	] as ArtDesign["elements"];
	return videoFrameFor({
		format: "9:16",
		design: { background: "#ffffff", elements, variables: [] },
		focal,
		clips: [CLIP],
	});
}

describe("videoBoxStyle", () => {
	// A prévia de 270 px sobre um quadro de 1080 dá escala de 1/4 — o mesmo
	// fator que a tela usa de verdade.
	const ESCALA = 270 / 1080;

	it("põe a caixa onde o padrão a desenhou, na escala da prévia", () => {
		const style = videoBoxStyle(frame(), ESCALA);
		expect(style.left).toBe("15px");
		expect(style.top).toBe("105px");
		expect(style.width).toBe("240px");
		expect(style.height).toBe("135px");
	});

	it("o arredondamento escala junto — em porcentagem viraria elipse", () => {
		const style = videoBoxStyle(frame({ cornerRadius: 48 }), ESCALA);
		expect(style.borderRadius).toBe("12px");
	});

	it("raio maior que a caixa vira pílula, não deformação", () => {
		const style = videoBoxStyle(
			frame({ cornerRadius: 9999, width: 400, height: 200 }),
			1,
		);
		expect(style.borderRadius).toBe("100px");
	});

	it("`cover` com `object-position` é o equivalente do corte focal do ffmpeg", () => {
		const style = videoBoxStyle(frame({}, { x: 0.25, y: 0.8 }), ESCALA);
		expect(style.objectFit).toBe("cover");
		expect(style.objectPosition).toBe("25% 80%");
	});

	it("sem rotação, nenhuma transformação — o navegador não precisa compor camada", () => {
		expect(videoBoxStyle(frame(), ESCALA).transform).toBe("none");
	});

	it("com rotação, gira em graus (o centro é o padrão do CSS, como no domínio)", () => {
		expect(videoBoxStyle(frame({ rotation: 12 }), ESCALA).transform).toBe(
			"rotate(12deg)",
		);
	});

	it("não deixa o ponto flutuante vazar para o CSS", () => {
		// `160 * (1/3)` dá `53.333333333333336`; duas casas bastam para a prévia.
		const style = videoBoxStyle(frame({ x: 160 }), 1 / 3);
		expect(style.left).toBe("53.33px");
	});

	it("ponto focal inválido cai no centro em vez de virar `NaN%`", () => {
		const style = videoBoxStyle(frame(), ESCALA);
		expect(style.objectPosition).toBe("50% 50%");
	});
});
