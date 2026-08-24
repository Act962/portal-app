import { InvalidSlug, Slug } from "@portal-app/taxonomy";
import { describe, expect, it } from "vitest";

describe("Slug (M01)", () => {
	it("normaliza acento, caixa e espaços para kebab-case", () => {
		const slug = Slug.create("  Política  Local ").unwrap();

		expect(slug.value).toBe("politica-local");
		expect(slug.toString()).toBe("politica-local");
	});

	it("colapsa separadores repetidos e apara hífens das pontas", () => {
		expect(Slug.create("--Eleições__2026!!--").unwrap().value).toBe(
			"eleicoes-2026",
		);
	});

	it("rejeita entrada sem nenhum caractere aproveitável", () => {
		expect(Slug.create("   ").unwrapErr()).toBeInstanceOf(InvalidSlug);
		expect(Slug.create("!!!").unwrapErr()).toBeInstanceOf(InvalidSlug);
		expect(Slug.create("").unwrapErr()).toBeInstanceOf(InvalidSlug);
	});

	it("dois slugs com o mesmo valor são iguais (objeto de valor)", () => {
		const a = Slug.create("Esportes").unwrap();
		const b = Slug.create("esportes").unwrap();

		expect(a.equals(b)).toBe(true);
	});
});
