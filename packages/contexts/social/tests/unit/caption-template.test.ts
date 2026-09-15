import {
	type CaptionContext,
	DEFAULT_CAPTION_TEMPLATE,
	renderCaption,
	toHashtags,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

const materia: CaptionContext = {
	headline: "Chuva forte alaga o centro de Piracuruca",
	standfirst: "Comércio fechou as portas na manhã desta quinta.",
	sectionName: "Cidades",
	authorName: "Maria Souza",
	tags: ["Piracuruca", "chuva"],
	url: "https://fm7cidades.com/cidades/chuva-alaga-centro",
	siteName: "Rádio 7 Cidades",
};

describe("renderCaption", () => {
	it("troca cada campo pelo valor da matéria", () => {
		const legenda = renderCaption(
			"{titulo}\n{linha-fina}\n{editoria} · {autor} · {veiculo}\n{link}\n{tags}",
			materia,
		);
		expect(legenda).toBe(
			[
				"Chuva forte alaga o centro de Piracuruca",
				"Comércio fechou as portas na manhã desta quinta.",
				"Cidades · Maria Souza · Rádio 7 Cidades",
				"https://fm7cidades.com/cidades/chuva-alaga-centro",
				"#Piracuruca #Chuva",
			].join("\n"),
		);
	});

	it("matéria sem linha-fina não deixa buraco no meio da legenda", () => {
		// O caso real: metade das matérias curtas não tem linha-fina. Sem a
		// limpeza, sobrariam duas quebras seguidas e o post sairia com um vão que
		// no feed parece descuido.
		const legenda = renderCaption("{titulo}\n\n{linha-fina}\n\n{tags}", {
			...materia,
			standfirst: null,
		});
		expect(legenda).toBe(
			"Chuva forte alaga o centro de Piracuruca\n\n#Piracuruca #Chuva",
		);
	});

	it("campo escrito errado PERMANECE visível, para a prévia denunciar", () => {
		// Apagar em silêncio produziria uma legenda sem título e ninguém notaria
		// a tempo. Como existe aprovação humana, o erro visível é o barato.
		expect(renderCaption("{titullo} hoje", materia)).toBe("{titullo} hoje");
	});

	it("sem tags, a linha some inteira em vez de virar espaço solto", () => {
		expect(renderCaption("{titulo}\n\n{tags}", { ...materia, tags: [] })).toBe(
			"Chuva forte alaga o centro de Piracuruca",
		);
	});

	it("modelo sem nenhum campo sai como está", () => {
		expect(renderCaption("Bom dia, Piracuruca!", materia)).toBe(
			"Bom dia, Piracuruca!",
		);
	});

	it("apara espaços no fim das linhas", () => {
		expect(renderCaption("{titulo}   \n{editoria}  ", materia)).toBe(
			"Chuva forte alaga o centro de Piracuruca\nCidades",
		);
	});

	it("campos nulos viram vazio, não a palavra 'null'", () => {
		const legenda = renderCaption("[{editoria}][{autor}][{link}]", {
			...materia,
			sectionName: null,
			authorName: null,
			url: null,
		});
		expect(legenda).toBe("[][][]");
	});
});

describe("modelo padrão", () => {
	it("NÃO tem link — no Instagram a URL da legenda não é clicável", () => {
		// O Facebook recebe o link mesmo assim, acrescentado no envio por
		// `captionFor` — sem que exista uma segunda legenda para aprovar.
		expect(DEFAULT_CAPTION_TEMPLATE).not.toContain("{link}");
		expect(DEFAULT_CAPTION_TEMPLATE).toContain("link da bio");
	});

	it("produz legenda dentro do limite do Instagram", () => {
		const legenda = renderCaption(DEFAULT_CAPTION_TEMPLATE, materia);
		expect([...legenda].length).toBeLessThanOrEqual(2200);
		expect(legenda).toContain("Chuva forte alaga o centro de Piracuruca");
		expect(legenda).toContain("#Piracuruca #Chuva");
	});
});

describe("toHashtags", () => {
	it("tira acento — #eleicoes é o que se compara entre plataformas", () => {
		expect(toHashtags(["eleições"])).toEqual(["#Eleicoes"]);
	});

	it("junta palavras em maiúscula, que é o legível", () => {
		// `#SaudePublica` se lê; `#saudepublica` não.
		expect(toHashtags(["saúde pública"])).toEqual(["#SaudePublica"]);
	});

	it("descarta o que não tem letra nenhuma em vez de virar um # solto", () => {
		expect(toHashtags(["!!!", "---", "2026"])).toEqual(["#2026"]);
	});

	it("não repete a mesma hashtag por diferença de caixa ou acento", () => {
		expect(toHashtags(["Piauí", "piaui", "PIAUI"])).toEqual(["#Piaui"]);
	});

	it("preserva a ordem das tags — a primeira é a mais relevante", () => {
		expect(toHashtags(["Piracuruca", "chuva", "defesa civil"])).toEqual([
			"#Piracuruca",
			"#Chuva",
			"#DefesaCivil",
		]);
	});

	it("lista vazia devolve lista vazia", () => {
		expect(toHashtags([])).toEqual([]);
	});
});
