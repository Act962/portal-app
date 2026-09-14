import { Caption } from "@portal-app/social";
import { describe, expect, it } from "vitest";

describe("Caption", () => {
	it("apara as bordas — a legenda colada do editor vem com quebra sobrando", () => {
		const caption = Caption.create("  Chuva alaga o centro  \n").unwrap();
		expect(caption.value).toBe("Chuva alaga o centro");
	});

	it("recusa vazio e só-espaços", () => {
		expect(Caption.create("").isErr()).toBe(true);
		expect(Caption.create("   \n  ").unwrapErr().name).toBe("CaptionRequired");
	});

	it("NÃO valida tamanho na criação — o limite depende da rede, escolhida depois", () => {
		// Escrever primeiro e escolher o destino depois é a ordem real do
		// trabalho. Recusar aqui obrigaria o inverso.
		const gigante = "a".repeat(5000);
		expect(Caption.create(gigante).isOk()).toBe(true);
	});

	describe("medida em pontos de código, não em UTF-16", () => {
		it("conta emoji como um caractere, e não como dois", () => {
			// Legenda de portal tem emoji em toda linha de chamada. O `.length` do
			// JS conta 2 unidades UTF-16 por emoji: contar por ele recusaria texto
			// que a Meta aceita.
			const caption = Caption.create("Chuva 🎉").unwrap();
			expect(caption.length).toBe(7);
			expect(caption.value.length).toBe(8);
		});

		it("aceita 2200 caracteres no Instagram e recusa 2201", () => {
			expect(
				Caption.create("a".repeat(2200)).unwrap().exceedsLengthFor("INSTAGRAM"),
			).toBe(false);
			expect(
				Caption.create("a".repeat(2201)).unwrap().exceedsLengthFor("INSTAGRAM"),
			).toBe(true);
		});

		it("o mesmo texto que estoura no Instagram cabe no Facebook", () => {
			const caption = Caption.create("a".repeat(2201)).unwrap();
			expect(caption.exceedsLengthFor("INSTAGRAM")).toBe(true);
			expect(caption.exceedsLengthFor("FACEBOOK")).toBe(false);
		});
	});

	describe("hashtags", () => {
		it("encontra as hashtags do texto", () => {
			const caption = Caption.create(
				"Prefeitura anuncia obra #Piracuruca #Piaui",
			).unwrap();
			expect(caption.hashtags).toEqual(["#Piracuruca", "#Piaui"]);
		});

		it("reconhece acento e cedilha — #eleição é hashtag de verdade aqui", () => {
			const caption = Caption.create(
				"Votação aberta #eleição #coração",
			).unwrap();
			expect(caption.hashtags).toEqual(["#eleição", "#coração"]);
		});

		it("legenda sem hashtag devolve lista vazia, não nulo", () => {
			expect(Caption.create("Sem tag nenhuma").unwrap().hashtags).toEqual([]);
		});

		it("recusa acima de 30 no Instagram, aceita no Facebook", () => {
			const trinta_e_uma = Array.from(
				{ length: 31 },
				(_, index) => `#tag${index}`,
			).join(" ");
			const caption = Caption.create(trinta_e_uma).unwrap();
			expect(caption.exceedsHashtagsFor("INSTAGRAM")).toBe(true);
			expect(caption.exceedsHashtagsFor("FACEBOOK")).toBe(false);
		});

		it("exatamente 30 passa — o limite é inclusivo", () => {
			const trinta = Array.from(
				{ length: 30 },
				(_, index) => `#tag${index}`,
			).join(" ");
			expect(
				Caption.create(trinta).unwrap().exceedsHashtagsFor("INSTAGRAM"),
			).toBe(false);
		});
	});

	it("encontra menções a perfis", () => {
		const caption = Caption.create("Com @prefeiturapiracuruca hoje").unwrap();
		expect(caption.mentions).toEqual(["@prefeiturapiracuruca"]);
	});

	it("legenda sem menção devolve lista vazia, não nulo", () => {
		expect(Caption.create("Ninguém marcado aqui").unwrap().mentions).toEqual(
			[],
		);
	});

	it("restore não valida — o banco já guardou o que foi aceito um dia", () => {
		expect(Caption.restore("qualquer coisa").value).toBe("qualquer coisa");
	});

	it("duas legendas com o mesmo texto são iguais", () => {
		const a = Caption.create("Chuva no centro").unwrap();
		const b = Caption.create("  Chuva no centro ").unwrap();
		expect(a.equals(b)).toBe(true);
		expect(a.equals(Caption.create("Sol no centro").unwrap())).toBe(false);
	});
});
