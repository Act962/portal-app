import {
	Body,
	Byline,
	BylineRequired,
	Cover,
	Headline,
	HeadlineRequired,
	InvalidBlock,
	InvalidSlug,
	Kicker,
	PublicationSchedule,
	ScheduleInPast,
	Slug,
	Standfirst,
} from "@portal-app/editorial";
import { describe, expect, it } from "vitest";

describe("Headline", () => {
	it("apara e aceita título não-vazio", () => {
		expect(Headline.create("  Enchente atinge o centro ").unwrap().value).toBe(
			"Enchente atinge o centro",
		);
	});

	it("rejeita vazio", () => {
		expect(Headline.create("   ").unwrapErr()).toBeInstanceOf(HeadlineRequired);
	});
});

describe("Kicker / Standfirst (opcionais)", () => {
	it("aparam e permitem vazio", () => {
		expect(Kicker.create("  ELEIÇÕES ").value).toBe("ELEIÇÕES");
		expect(Kicker.create().isEmpty()).toBe(true);
		expect(Standfirst.create("  linha fina ").value).toBe("linha fina");
		expect(Standfirst.create(null).isEmpty()).toBe(true);
	});
});

describe("Byline", () => {
	it("exige autor e nome", () => {
		const b = Byline.create({ authorId: "a-1", name: "Ana" }).unwrap();
		expect(b.authorId).toBe("a-1");
		expect(b.name).toBe("Ana");
		expect(
			Byline.create({ authorId: " ", name: "Ana" }).unwrapErr(),
		).toBeInstanceOf(BylineRequired);
		expect(
			Byline.create({ authorId: "a-1", name: " " }).unwrapErr(),
		).toBeInstanceOf(BylineRequired);
	});
});

describe("Cover", () => {
	it("guarda mídia e alt-text; hasAltText reflete a presença", () => {
		expect(
			Cover.create({ mediaId: "m-1", altText: "Rua alagada" }).hasAltText(),
		).toBe(true);
		const semAlt = Cover.create({ mediaId: "m-1" });
		expect(semAlt.hasAltText()).toBe(false);
		expect(semAlt.mediaId).toBe("m-1");
		expect(semAlt.altText).toBe("");
	});
});

describe("Slug", () => {
	it("normaliza e rejeita inválido", () => {
		expect(Slug.create("Enchente no Centro!").unwrap().value).toBe(
			"enchente-no-centro",
		);
		expect(Slug.create("   ").unwrapErr()).toBeInstanceOf(InvalidSlug);
		expect(Slug.create("chuva").unwrap().toString()).toBe("chuva");
	});
});

describe("Body / blocos (D1)", () => {
	it("aceita todos os tipos de bloco válidos", () => {
		const body = Body.create([
			{ type: "paragraph", text: "Um parágrafo." },
			{ type: "heading", level: 2, text: "Subtítulo" },
			{ type: "image", mediaId: "m-1", caption: "legenda" },
			{ type: "list", ordered: false, items: ["a", "b"] },
			{ type: "quote", text: "Citação", cite: "Fulano" },
			{ type: "embed", url: "https://youtu.be/x" },
		]).unwrap();

		expect(body.blocks).toHaveLength(6);
		expect(body.isEmpty()).toBe(false);
		expect(Body.empty().isEmpty()).toBe(true);
	});

	it("rejeita blocos inválidos", () => {
		const bad = [
			[{ type: "paragraph", text: "  " }],
			[{ type: "heading", level: 4 as 2, text: "x" }],
			[{ type: "heading", level: 2, text: " " }],
			[{ type: "image", mediaId: " " }],
			[{ type: "list", ordered: true, items: [] }],
			[{ type: "list", ordered: true, items: ["ok", " "] }],
			[{ type: "quote", text: "" }],
			[{ type: "embed", url: "não-é-url" }],
		] as const;

		for (const blocks of bad) {
			expect(Body.create(blocks).unwrapErr()).toBeInstanceOf(InvalidBlock);
		}
	});
});

describe("PublicationSchedule", () => {
	const now = new Date("2026-08-05T12:00:00Z");

	it("aceita futuro e calcula isDue", () => {
		const at = new Date("2026-08-05T15:00:00Z");
		const schedule = PublicationSchedule.create(at, now).unwrap();
		expect(schedule.at.toISOString()).toBe(at.toISOString());
		expect(schedule.isDue(now)).toBe(false);
		expect(schedule.isDue(new Date("2026-08-05T15:00:00Z"))).toBe(true);
	});

	it("rejeita passado ou presente", () => {
		expect(
			PublicationSchedule.create(
				new Date("2026-08-05T11:59:59Z"),
				now,
			).unwrapErr(),
		).toBeInstanceOf(ScheduleInPast);
		expect(PublicationSchedule.create(now, now).unwrapErr()).toBeInstanceOf(
			ScheduleInPast,
		);
	});
});
