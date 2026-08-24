import { InvalidSlug, NameRequired, Tag } from "@portal-app/taxonomy";
import { describe, expect, it } from "vitest";

describe("Tag", () => {
	it("deriva slug do nome", () => {
		const tag = Tag.create({ id: "t-1", name: "Eleições 2026" }).unwrap();

		expect(tag.name).toBe("Eleições 2026");
		expect(tag.slug).toBe("eleicoes-2026");
	});

	it("aceita slug explícito", () => {
		const tag = Tag.create({
			id: "t-1",
			name: "Eleições",
			slug: "pleito",
		}).unwrap();

		expect(tag.slug).toBe("pleito");
	});

	it("recusa nome vazio (NameRequired)", () => {
		expect(Tag.create({ id: "t-1", name: "   " }).unwrapErr()).toBeInstanceOf(
			NameRequired,
		);
	});

	it("recusa slug explícito mal-formado (InvalidSlug)", () => {
		expect(
			Tag.create({ id: "t-1", name: "Eleições", slug: "###" }).unwrapErr(),
		).toBeInstanceOf(InvalidSlug);
	});

	it("renomeia e recusa novo nome vazio", () => {
		const tag = Tag.create({ id: "t-1", name: "Eleição" }).unwrap();

		expect(tag.rename("Pleito").isOk()).toBe(true);
		expect(tag.name).toBe("Pleito");
		expect(tag.rename("  ").unwrapErr()).toBeInstanceOf(NameRequired);
	});

	it("reidrata de dados persistidos", () => {
		const tag = Tag.restore({ id: "t-1", name: "Copa", slug: "copa" });

		expect(tag.name).toBe("Copa");
		expect(tag.slug).toBe("copa");
	});

	it("estoura ao reidratar com slug inválido (invariante interna)", () => {
		expect(() => Tag.restore({ id: "t-1", name: "X", slug: "@@@" })).toThrow(
			InvalidSlug,
		);
	});
});
