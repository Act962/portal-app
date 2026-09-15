import { artImageKey, stableHash } from "@portal-app/social";
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
