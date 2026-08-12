import { describe, expect, it } from "vitest";

import {
	Columnist,
	InvalidColumnistEmail,
	InvalidSlug,
	NameRequired,
	Slug,
} from "../../src/index";

const VALID = { id: "c1", name: "Mariano Wikoli" };

describe("Columnist.create", () => {
	it("recusa nome vazio depois de aparado", () => {
		expect(Columnist.create({ id: "c1", name: "   " })).toBeErr(NameRequired);
	});

	it("deriva o endereço do nome", () => {
		const columnist = Columnist.create(VALID).unwrap();

		expect(columnist.slug).toBe("mariano-wikoli");
		expect(columnist.name).toBe("Mariano Wikoli");
	});

	it("aceita endereço próprio quando a assinatura difere do nome de exibição", () => {
		// O caso real: a pessoa assina "M. Wikoli" e o bloco da home mostra o
		// nome inteiro. O endereço tem de seguir a ASSINATURA, senão o perfil
		// não casa com matéria nenhuma.
		const columnist = Columnist.create({
			...VALID,
			slug: "M. Wikoli",
		}).unwrap();

		expect(columnist.slug).toBe("m-wikoli");
		expect(columnist.name).toBe("Mariano Wikoli");
	});

	it("recusa nome que não sobra nada depois de normalizar", () => {
		expect(Columnist.create({ id: "c1", name: "..." })).toBeErr(InvalidSlug);
	});

	it("apara beat e blurb, e aceita os dois vazios", () => {
		const comBeat = Columnist.create({
			...VALID,
			beat: "  Bastidores da Política  ",
			blurb: "  Análise semanal.  ",
		}).unwrap();
		expect(comBeat.beat).toBe("Bastidores da Política");
		expect(comBeat.blurb).toBe("Análise semanal.");

		// Nem toda assinatura em destaque tem coluna com nome próprio.
		const semBeat = Columnist.create(VALID).unwrap();
		expect(semBeat.beat).toBe("");
		expect(semBeat.blurb).toBe("");
	});

	it("nasce ativo, sem foto e no começo da ordem", () => {
		const columnist = Columnist.create(VALID).unwrap();

		expect(columnist.isActive).toBe(true);
		expect(columnist.photoMediaId).toBeNull();
		expect(columnist.order).toBe(0);
	});
});

/**
 * O endereço TEM de sair igual ao `slugify` do read model do portal
 * (`apps/web/src/data/read-model.ts`), porque é ele que amarra o perfil às
 * matérias assinadas — o índice de autores é `slugify(authorName)`.
 *
 * Os casos abaixo fixam o comportamento por VALOR, e não comparando com uma
 * cópia da regra: uma cópia passaria a valer junto com o erro, se alguém
 * mudasse as duas.
 */
describe("normalização do endereço", () => {
	it.each([
		["Mariano Wikoli", "mariano-wikoli"],
		["Mariano Wikolí", "mariano-wikoli"],
		["MARIANO WIKOLI", "mariano-wikoli"],
		["  Mariano   Wikoli  ", "mariano-wikoli"],
		["Antônio Gonçalves", "antonio-goncalves"],
		["Maria d'Ávila", "maria-d-avila"],
		["João Paulo II", "joao-paulo-ii"],
	])("%j vira %j", (nome, esperado) => {
		expect(Columnist.create({ id: "c1", name: nome }).unwrap().slug).toBe(
			esperado,
		);
	});

	it("recusa o que não sobrevive à normalização", () => {
		expect(Slug.create("@@@")).toBeErr(InvalidSlug);
	});

	it("interpola como texto — o endereço entra em URL e em template", () => {
		const slug = Slug.create("Mariano Wikoli").unwrap();

		expect(`/autor/${slug}`).toBe("/autor/mariano-wikoli");
	});
});

describe("Columnist.restore", () => {
	it("reidrata do banco sem revalidar o nome", () => {
		const columnist = Columnist.restore({
			id: "c1",
			slug: "mariano-wikoli",
			name: "Mariano Wikoli",
			beat: "Bastidores da Política",
			blurb: "Análise semanal.",
			photoMediaId: "m1",
			order: 3,
			active: false,
		});

		expect(columnist.slug).toBe("mariano-wikoli");
		expect(columnist.order).toBe(3);
		expect(columnist.isActive).toBe(false);
		expect(columnist.photoMediaId).toBe("m1");
	});

	it("tolera endereço persistido fora do formato, desde que sobre alguma coisa", () => {
		// `Slug.create` NORMALIZA em vez de recusar, então uma linha gravada à
		// mão ("Mariano Wikoli") ainda reidrata. Não é permissividade: o
		// adapter só grava slug já normalizado, e recusar aqui derrubaria a
		// página de um colunista por causa de um insert manual.
		const columnist = Columnist.restore({
			id: "c1",
			slug: "Mariano Wikoli",
			name: "Mariano Wikoli",
			beat: "",
			blurb: "",
			photoMediaId: null,
			order: 0,
			active: true,
		});

		expect(columnist.slug).toBe("mariano-wikoli");
	});

	it("explode quando o endereço persistido não sobrevive à normalização", () => {
		// Aí não há o que recuperar — é corrupção, não entrada de usuário, e
		// falhar alto é melhor do que servir um colunista sem endereço.
		expect(() =>
			Columnist.restore({
				id: "c1",
				slug: "...",
				name: "Mariano Wikoli",
				beat: "",
				blurb: "",
				photoMediaId: null,
				order: 0,
				active: true,
			}),
		).toThrow();
	});
});

describe("updateDetails", () => {
	it("NÃO mexe no endereço ao trocar o nome", () => {
		// A regra central do agregado. O endereço já está indexado e é a única
		// ligação com as matérias assinadas — trocá-lo órfãna as duas coisas.
		const columnist = Columnist.create(VALID).unwrap();

		columnist.updateDetails({ name: "Mariano Wikoli Filho" }).unwrap();

		expect(columnist.name).toBe("Mariano Wikoli Filho");
		expect(columnist.slug).toBe("mariano-wikoli");
	});

	it("recusa esvaziar o nome", () => {
		const columnist = Columnist.create(VALID).unwrap();

		expect(columnist.updateDetails({ name: "  " })).toBeErr(NameRequired);
		expect(columnist.name).toBe("Mariano Wikoli");
	});

	it("preserva o que não foi informado", () => {
		const columnist = Columnist.create({
			...VALID,
			beat: "Bastidores da Política",
			blurb: "Análise semanal.",
			photoMediaId: "m1",
		}).unwrap();

		columnist.updateDetails({ blurb: "Toda quinta." }).unwrap();

		expect(columnist.beat).toBe("Bastidores da Política");
		expect(columnist.blurb).toBe("Toda quinta.");
		expect(columnist.photoMediaId).toBe("m1");
	});

	it("distingue 'não informado' de 'tirar a foto'", () => {
		// `undefined` preserva, `null` limpa — sem isso não haveria como
		// remover a foto pela tela.
		const columnist = Columnist.create({
			...VALID,
			photoMediaId: "m1",
		}).unwrap();

		columnist.updateDetails({ photoMediaId: null }).unwrap();

		expect(columnist.photoMediaId).toBeNull();
	});

	it("apara beat e blurb na edição, como na criação", () => {
		const columnist = Columnist.create(VALID).unwrap();

		columnist.updateDetails({ beat: "  Economia em Foco  " }).unwrap();

		expect(columnist.beat).toBe("Economia em Foco");
	});
});

describe("ordem e presença no bloco", () => {
	it("reordena", () => {
		const columnist = Columnist.create(VALID).unwrap();

		columnist.reorderTo(5);

		expect(columnist.order).toBe(5);
	});

	it("tira do ar e devolve, preservando o perfil", () => {
		const columnist = Columnist.create({
			...VALID,
			beat: "Bastidores",
		}).unwrap();

		columnist.deactivate();
		expect(columnist.isActive).toBe(false);
		expect(columnist.beat).toBe("Bastidores");

		columnist.activate();
		expect(columnist.isActive).toBe(true);
	});

	it("é idempotente nos dois sentidos", () => {
		const columnist = Columnist.create(VALID).unwrap();

		columnist.deactivate();
		columnist.deactivate();
		expect(columnist.isActive).toBe(false);

		columnist.activate();
		columnist.activate();
		expect(columnist.isActive).toBe(true);
	});
});

describe("Columnist — contato público", () => {
	it("nasce sem redes e sem e-mail", () => {
		const columnist = Columnist.create(VALID).unwrap();

		expect(columnist.socials).toEqual({});
		expect(columnist.email).toBeNull();
	});

	it("apara e normaliza o e-mail para minúsculas", () => {
		const columnist = Columnist.create({
			...VALID,
			email: "  Mariano@FM7Cidades.COM  ",
		}).unwrap();

		expect(columnist.email).toBe("mariano@fm7cidades.com");
	});

	it("recusa e-mail que não passa na régua", () => {
		expect(Columnist.create({ ...VALID, email: "mariano(arroba)fm7" })).toBeErr(
			InvalidColumnistEmail,
		);
	});

	it("trata e-mail vazio como ausência, não como erro", () => {
		// Limpar o campo na tela chega aqui como "   ". Recusar isso impediria
		// de DESPUBLICAR um e-mail já publicado.
		expect(
			Columnist.create({ ...VALID, email: "   " }).unwrap().email,
		).toBeNull();
	});

	it("descarta rede vazia em vez de guardar string vazia", () => {
		// O portal decide se mostra a seção de redes pela contagem de chaves; uma
		// chave presente e vazia viraria um link para lugar nenhum.
		const columnist = Columnist.create({
			...VALID,
			socials: {
				instagram: "  https://instagram.com/mariano  ",
				twitter: "  ",
			},
		}).unwrap();

		expect(columnist.socials).toEqual({
			instagram: "https://instagram.com/mariano",
		});
	});

	it("não devolve o estado por referência", () => {
		const columnist = Columnist.create({
			...VALID,
			socials: { website: "https://mariano.com" },
		}).unwrap();

		columnist.socials.website = "https://invasor.com";

		expect(columnist.socials.website).toBe("https://mariano.com");
	});
});

describe("Columnist.updateDetails — contato", () => {
	const make = () =>
		Columnist.create({
			...VALID,
			email: "mariano@fm7cidades.com",
			socials: { instagram: "https://instagram.com/mariano" },
		}).unwrap();

	it("substitui as redes INTEIRAS, para que dê para apagar uma", () => {
		// Mesclar chave a chave tornaria impossível remover uma rede: o campo
		// esvaziado chegaria ausente e o valor antigo sobreviveria para sempre.
		const columnist = make();

		columnist.updateDetails({ socials: { twitter: "https://x.com/mariano" } });

		expect(columnist.socials).toEqual({ twitter: "https://x.com/mariano" });
	});

	it("preserva as redes quando o campo não vem", () => {
		const columnist = make();

		columnist.updateDetails({ beat: "Outra coluna" });

		expect(columnist.socials).toEqual({
			instagram: "https://instagram.com/mariano",
		});
	});

	it("apaga o e-mail com null", () => {
		const columnist = make();

		columnist.updateDetails({ email: null });

		expect(columnist.email).toBeNull();
	});

	it("não grava NADA quando o e-mail é recusado", () => {
		// A validação vem antes de tocar no estado. Sem isso, uma edição
		// recusada deixaria o nome novo gravado e o e-mail antigo — um estado
		// que o usuário não pediu e não vê.
		const columnist = make();

		const result = columnist.updateDetails({
			name: "Nome Novo",
			email: "torto",
		});

		expect(result).toBeErr(InvalidColumnistEmail);
		expect(columnist.name).toBe("Mariano Wikoli");
		expect(columnist.email).toBe("mariano@fm7cidades.com");
	});
});

describe("Columnist.restore — tolerância de leitura", () => {
	const STORED = {
		id: "c1",
		slug: "mariano-wikoli",
		name: "Mariano Wikoli",
		beat: "",
		blurb: "",
		photoMediaId: null,
		order: 0,
		active: true,
	};

	it("transforma e-mail inválido no banco em ausência, sem estourar", () => {
		// O portal não pode sair do ar por um campo torto; mas também não repassa
		// lixo para um `mailto:` que o leitor clica e não chega a ninguém.
		expect(Columnist.restore({ ...STORED, email: "lixo" }).email).toBeNull();
	});

	it("descarta chave desconhecida vinda do Json", () => {
		const columnist = Columnist.restore({
			...STORED,
			socials: {
				instagram: "https://instagram.com/m",
				tiktok: "https://x",
			} as never,
		});

		expect(columnist.socials).toEqual({ instagram: "https://instagram.com/m" });
	});

	it("aceita registro antigo, sem as colunas novas", () => {
		expect(Columnist.restore(STORED).socials).toEqual({});
		expect(Columnist.restore(STORED).email).toBeNull();
	});
});
