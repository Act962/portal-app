import { artImageKey, stableHash, videoArtKey } from "@portal-app/social";
import { describe, expect, it } from "vitest";

const ENTRADA = {
	templateId: "tpl-1",
	templateVersion: 3,
	photo: { mediaId: "m-1", focal: { x: 0.4, y: 0.5 } },
	texts: { titulo: "ESTUDANTES PREMIADOS", chapeu: "ÚLTIMAS" },
	images: { moldura: "https://cdn.test/moldura.png" },
};

describe("artImageKey (D8)", () => {
	it("tem padrão, versão e hash no nome", () => {
		expect(artImageKey(ENTRADA)).toMatch(
			/^social\/art\/tpl-1-v3-[0-9a-f]{16}\.jpg$/,
		);
	});

	it("mesma entrada, mesma chave — reenviar não redesenha", () => {
		expect(artImageKey({ ...ENTRADA })).toBe(artImageKey(ENTRADA));
	});

	it("a ordem das chaves não importa", () => {
		expect(
			artImageKey({
				...ENTRADA,
				texts: { chapeu: "ÚLTIMAS", titulo: "ESTUDANTES PREMIADOS" },
			}),
		).toBe(artImageKey(ENTRADA));
	});

	it.each([
		["versão do padrão", { templateVersion: 4 }],
		["ponto focal", { photo: { mediaId: "m-1", focal: { x: 0.41, y: 0.5 } } }],
		["foto", { photo: { mediaId: "m-2", focal: { x: 0.4, y: 0.5 } } }],
		["sem foto", { photo: null }],
		[
			"uma vírgula no título",
			{ texts: { titulo: "ESTUDANTES, PREMIADOS", chapeu: "ÚLTIMAS" } },
		],
		["moldura", { images: { moldura: "https://cdn.test/outra.png" } }],
	])("muda com %s", (_, mudanca) => {
		expect(artImageKey({ ...ENTRADA, ...mudanca })).not.toBe(
			artImageKey(ENTRADA),
		);
	});
});

describe("stableHash", () => {
	it("ignora campo indefinido e distingue tipos", () => {
		expect(stableHash({ a: 1, b: undefined })).toBe(stableHash({ a: 1 }));
		expect(stableHash({ a: "1" })).not.toBe(stableHash({ a: 1 }));
		expect(stableHash([1, 2])).not.toBe(stableHash([2, 1]));
		expect(stableHash(null)).toBe(stableHash(null));
		expect(stableHash(undefined)).toMatch(/^[0-9a-f]{16}$/);
	});
});

describe("videoArtKey (spec 12, D5)", () => {
	const CLIP = {
		mediaId: "v-1",
		startSeconds: 4,
		endSeconds: 20,
		muted: false,
	};
	const VIDEO = { ...ENTRADA, clips: [CLIP] };

	it("o vídeo e a capa saem da MESMA chave", () => {
		// Duas chaves independentes é o que produz a capa de um vídeo antigo
		// sobre o vídeo novo — e ninguém repara numa capa quase igual.
		const key = videoArtKey(VIDEO);
		expect(key.video).toMatch(/^social\/video\/tpl-1-v3-[0-9a-f]{16}\.mp4$/);
		expect(key.cover).toBe(key.video.replace(".mp4", ".jpg"));
	});

	it("mesma entrada, mesma chave — reenviar não remonta", () => {
		expect(videoArtKey({ ...VIDEO })).toEqual(videoArtKey(VIDEO));
	});

	it("aparar meio segundo é outro arquivo", () => {
		// Sem o corte na chave, aparar e reenviar devolveria o vídeo antigo — e
		// o defeito seria invisível, porque um vídeo quase igual não chama a
		// atenção de ninguém.
		expect(
			videoArtKey({ ...VIDEO, clips: [{ ...CLIP, endSeconds: 19.5 }] }).video,
		).not.toBe(videoArtKey(VIDEO).video);
	});

	it("tirar o som é outro arquivo", () => {
		expect(
			videoArtKey({ ...VIDEO, clips: [{ ...CLIP, muted: true }] }).video,
		).not.toBe(videoArtKey(VIDEO).video);
	});

	it("trocar o texto do padrão é outro arquivo", () => {
		expect(
			videoArtKey({ ...VIDEO, texts: { ...VIDEO.texts, titulo: "OUTRO" } })
				.video,
		).not.toBe(videoArtKey(VIDEO).video);
	});

	it("outra versão do padrão vai para outro nome, à vista", () => {
		expect(videoArtKey({ ...VIDEO, templateVersion: 4 }).video).toContain(
			"-v4-",
		);
	});
});
