import {
	InvalidColor,
	InvalidSlug,
	MaxDepthExceeded,
	NameRequired,
	Section,
	SectionInUse,
} from "@portal-app/taxonomy";
import { describe, expect, it } from "vitest";

function section(
	overrides: Partial<{ id: string; name: string; slug: string }> = {},
): Section {
	return Section.create({
		id: overrides.id ?? "sec-1",
		name: overrides.name ?? "Política",
		slug: overrides.slug,
	}).unwrap();
}

describe("Section — criação e invariantes", () => {
	it("deriva slug do nome e nasce ativa, sem mãe, na ordem zero", () => {
		const sec = section();

		expect(sec.slug).toBe("politica");
		expect(sec.status).toBe("ATIVA");
		expect(sec.isActive()).toBe(true);
		expect(sec.isRoot()).toBe(true);
		expect(sec.parentId).toBeNull();
		expect(sec.order).toBe(0);
		expect(sec.color).toBeNull();
		expect(sec.description).toBe("");
	});

	it("aceita slug, descrição, cor e ordem explícitos", () => {
		const sec = Section.create({
			id: "sec-1",
			name: "Política",
			slug: "politica-nacional",
			description: "  Cobertura de Brasília  ",
			color: "#A1B2C3",
			order: 3,
		}).unwrap();

		expect(sec.slug).toBe("politica-nacional");
		expect(sec.description).toBe("Cobertura de Brasília");
		expect(sec.color).toBe("#a1b2c3");
		expect(sec.order).toBe(3);
	});

	it("recusa nome vazio (NameRequired)", () => {
		expect(Section.create({ id: "x", name: "   " }).unwrapErr()).toBeInstanceOf(
			NameRequired,
		);
	});

	it("recusa slug explícito mal-formado (InvalidSlug)", () => {
		expect(
			Section.create({ id: "x", name: "Política", slug: "!!!" }).unwrapErr(),
		).toBeInstanceOf(InvalidSlug);
	});

	it("recusa cor fora do hexadecimal (InvalidColor)", () => {
		expect(
			Section.create({ id: "x", name: "Política", color: "azul" }).unwrapErr(),
		).toBeInstanceOf(InvalidColor);
	});
});

describe("Section — hierarquia de dois níveis (M02)", () => {
	it("uma editoria-raiz pode ter subeditoria", () => {
		const raiz = section({ id: "raiz", name: "Esportes" });
		const filha = Section.create({
			id: "filha",
			name: "Futebol",
			parent: raiz,
		}).unwrap();

		expect(filha.isRoot()).toBe(false);
		expect(filha.parentId).toBe("raiz");
	});

	it("uma subeditoria não pode ser mãe de outra (MaxDepthExceeded)", () => {
		const raiz = section({ id: "raiz", name: "Esportes" });
		const filha = Section.create({
			id: "filha",
			name: "Futebol",
			parent: raiz,
		}).unwrap();

		expect(
			Section.create({ id: "neta", name: "Copa", parent: filha }).unwrapErr(),
		).toBeInstanceOf(MaxDepthExceeded);
	});
});

describe("Section — ciclo de vida", () => {
	it("desativa preservando identidade", () => {
		const sec = section();
		sec.deactivate();

		expect(sec.isActive()).toBe(false);
		expect(sec.status).toBe("INATIVA");
	});

	it("reordena", () => {
		const sec = section();
		sec.reorderTo(7);

		expect(sec.order).toBe(7);
	});

	it("reativa uma editoria desativada", () => {
		const sec = section();
		sec.deactivate();
		sec.activate();

		expect(sec.isActive()).toBe(true);
	});

	it("edita nome, descrição e cor sem tocar o slug", () => {
		const sec = section();
		const result = sec.updateDetails({
			name: "  Política Nacional ",
			description: "  Brasília ",
			color: "#ABC",
		});

		expect(result.isOk()).toBe(true);
		expect(sec.name).toBe("Política Nacional");
		expect(sec.description).toBe("Brasília");
		expect(sec.color).toBe("#abc");
		expect(sec.slug).toBe("politica"); // inalterado
	});

	it("edição parcial mexe só no que veio", () => {
		const sec = Section.create({
			id: "s",
			name: "Política",
			description: "orig",
			color: "#111111",
		}).unwrap();
		sec.updateDetails({ description: "nova" });

		expect(sec.name).toBe("Política");
		expect(sec.color).toBe("#111111");
		expect(sec.description).toBe("nova");
	});

	it("permite limpar a cor com null", () => {
		const sec = Section.create({
			id: "s",
			name: "Política",
			color: "#111111",
		}).unwrap();
		sec.updateDetails({ color: null });

		expect(sec.color).toBeNull();
	});

	it("recusa nome vazio e cor inválida na edição", () => {
		const sec = section();

		expect(sec.updateDetails({ name: " " }).unwrapErr()).toBeInstanceOf(
			NameRequired,
		);
		expect(sec.updateDetails({ color: "roxo" }).unwrapErr()).toBeInstanceOf(
			InvalidColor,
		);
	});

	it("M04: editoria em uso não pode ser excluída; sem uso pode", () => {
		const sec = section();

		expect(sec.ensureDeletable(true).unwrapErr()).toBeInstanceOf(SectionInUse);
		expect(sec.ensureDeletable(false).isOk()).toBe(true);
	});
});

describe("Section — reidratação", () => {
	it("restaura de dados persistidos", () => {
		const sec = Section.restore({
			id: "sec-1",
			name: "Cidades",
			slug: "cidades",
			description: "Local",
			color: "#fff",
			order: 2,
			status: "INATIVA",
			parentId: "raiz",
		});

		expect(sec.name).toBe("Cidades");
		expect(sec.slug).toBe("cidades");
		expect(sec.color).toBe("#fff");
		expect(sec.status).toBe("INATIVA");
		expect(sec.isRoot()).toBe(false);
	});

	it("restaura preenchendo padrões quando os opcionais faltam", () => {
		const sec = Section.restore({
			id: "sec-1",
			name: "Cultura",
			slug: "cultura",
			order: 0,
			status: "ATIVA",
		});

		expect(sec.description).toBe("");
		expect(sec.color).toBeNull();
		expect(sec.parentId).toBeNull();
		expect(sec.isRoot()).toBe(true);
	});

	it("estoura se o slug persistido for inválido (invariante interna)", () => {
		expect(() =>
			Section.restore({
				id: "x",
				name: "X",
				slug: "!!!",
				order: 0,
				status: "ATIVA",
			}),
		).toThrow(InvalidSlug);
	});
});
