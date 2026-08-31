import { describe, expect, it } from "vitest";

import { parseAdEventBody } from "@/app/api/ads/event/parse-ad-event-body";

/**
 * O corpo do beacon de anúncio vem de um endpoint PÚBLICO: qualquer coisa pode
 * chegar, e nada disso pode virar exceção numa rota que responde a milhares de
 * requisições por dia.
 */
describe("parseAdEventBody", () => {
	it("aceita impressão e clique", () => {
		expect(
			parseAdEventBody('{"campaignId":"c-1","type":"impression"}'),
		).toEqual({ campaignId: "c-1", type: "impression" });
		expect(parseAdEventBody('{"campaignId":"c-1","type":"click"}')).toEqual({
			campaignId: "c-1",
			type: "click",
		});
	});

	it("recusa JSON quebrado sem estourar", () => {
		expect(parseAdEventBody("{isto não é json")).toBeNull();
		expect(parseAdEventBody("")).toBeNull();
	});

	it("recusa array e escalar", () => {
		expect(parseAdEventBody("[1,2,3]")).toBeNull();
		expect(parseAdEventBody('"c-1"')).toBeNull();
		expect(parseAdEventBody("null")).toBeNull();
	});

	it("recusa tipo de evento inventado", () => {
		// Sem isto, um `type` qualquer cairia no `else` do caso de uso e viraria
		// clique — inflando a métrica que o anunciante lê.
		expect(
			parseAdEventBody('{"campaignId":"c-1","type":"conversao"}'),
		).toBeNull();
		expect(parseAdEventBody('{"campaignId":"c-1"}')).toBeNull();
	});

	it("recusa id ausente, vazio ou não-texto", () => {
		expect(parseAdEventBody('{"type":"click"}')).toBeNull();
		expect(parseAdEventBody('{"campaignId":"  ","type":"click"}')).toBeNull();
		expect(parseAdEventBody('{"campaignId":123,"type":"click"}')).toBeNull();
	});

	it("recusa id absurdamente longo antes de ir ao banco", () => {
		// Sinal de sondagem, não de uso. Cortar aqui evita carregar o banco com o
		// que já se sabe que não existe.
		const gigante = "x".repeat(65);
		expect(
			parseAdEventBody(`{"campaignId":"${gigante}","type":"click"}`),
		).toBeNull();
	});
});
