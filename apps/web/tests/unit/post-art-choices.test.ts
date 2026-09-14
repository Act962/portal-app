import { describe, expect, it } from "vitest";

import { templatesFor } from "@/app/(app)/dashboard/social/post-art-model";

const padrao = (
	id: string,
	format: "1:1" | "4:5" | "9:16",
	extra: {
		archived?: boolean;
		defaultFor?: ("INSTAGRAM" | "INSTAGRAM_STORIES")[];
	} = {},
) => ({
	id,
	name: id,
	format,
	archived: extra.archived ?? false,
	defaultFor: extra.defaultFor ?? [],
});

describe("templatesFor", () => {
	it("só os ativos do formato do destino, o padrão do destino primeiro e o resto por nome", () => {
		const lista = [
			padrao("Plantão", "4:5"),
			padrao("Stories", "9:16", { defaultFor: ["INSTAGRAM_STORIES"] }),
			padrao("Antigo", "1:1", { archived: true }),
			padrao("Últimas", "1:1", { defaultFor: ["INSTAGRAM"] }),
			padrao("Agenda", "4:5"),
		];
		expect(templatesFor("INSTAGRAM", lista).map((t) => t.id)).toEqual([
			"Últimas",
			"Agenda",
			"Plantão",
		]);
		expect(templatesFor("INSTAGRAM_STORIES", lista).map((t) => t.id)).toEqual([
			"Stories",
		]);
	});
});
