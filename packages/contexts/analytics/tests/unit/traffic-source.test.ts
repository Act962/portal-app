import { describe, expect, it } from "vitest";

import { classifyTrafficSource } from "../../src/index";

const OWN = "fm7cidades.com.br";

describe("classifyTrafficSource", () => {
	it.each([null, undefined, "", "   "])(
		"referrer ausente (%s) é tráfego direto",
		(referrer) => {
			expect(classifyTrafficSource(referrer, OWN)).toBe("direto");
		},
	);

	it.each([
		"https://www.google.com/search?q=piaui",
		"https://google.com.br/",
		"https://br.search.yahoo.com/",
		"https://duckduckgo.com/",
		"https://www.bing.com/search",
	])("%s é busca", (referrer) => {
		expect(classifyTrafficSource(referrer, OWN)).toBe("busca");
	});

	it.each([
		"https://www.facebook.com/",
		"https://l.instagram.com/",
		"https://wa.me/",
		"https://api.whatsapp.com/",
		"https://t.co/abc",
		"https://x.com/alguem",
		"https://www.youtube.com/watch",
		"https://t.me/canal",
	])("%s é social", (referrer) => {
		expect(classifyTrafficSource(referrer, OWN)).toBe("social");
	});

	it("navegação dentro do próprio portal é interno", () => {
		expect(classifyTrafficSource("https://fm7cidades.com.br/cidades", OWN)).toBe(
			"interno",
		);
	});

	it("subdomínio do próprio portal também é interno", () => {
		expect(classifyTrafficSource("https://www.fm7cidades.com.br/x", OWN)).toBe(
			"interno",
		);
	});

	it("host que apenas TERMINA com o nome do portal não é interno", () => {
		// `naofm7cidades.com.br` não é nosso — o teste protege contra um
		// `endsWith` ingênuo (sem o ponto separador).
		expect(classifyTrafficSource("https://naofm7cidades.com.br/", OWN)).toBe(
			"outro",
		);
	});

	it("site qualquer é outro", () => {
		expect(classifyTrafficSource("https://algumblog.com/post", OWN)).toBe("outro");
	});

	it("referrer que não é URL válida vira outro, sem estourar", () => {
		expect(classifyTrafficSource("não é uma url", OWN)).toBe("outro");
	});

	it("classificação não depende da caixa do host", () => {
		expect(classifyTrafficSource("https://WWW.GOOGLE.COM/", OWN)).toBe("busca");
	});

	it("o mesmo referrer é interno em dev e externo em produção", () => {
		// `ownHost` é parâmetro justamente para isto: em localhost o tráfego
		// interno de desenvolvimento não pode contar como "outro".
		expect(classifyTrafficSource("http://localhost:3001/x", "localhost")).toBe(
			"interno",
		);
		expect(classifyTrafficSource("http://localhost:3001/x", OWN)).toBe("outro");
	});
});
