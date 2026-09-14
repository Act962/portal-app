import {
	DESTINATION_FORMAT,
	DESTINATION_LABEL,
	DESTINATION_PLATFORM,
	destinationOf,
	isSocialDestination,
	PLATFORM_LIMITS,
	SOCIAL_DESTINATIONS,
	SOCIAL_PLATFORMS,
} from "@portal-app/social";
import { describe, expect, it } from "vitest";

describe("destinos (§17)", () => {
	// É o que dispensa migration: a coluna `platform` das entregas gravadas antes
	// dos Stories guarda `INSTAGRAM`/`FACEBOOK`, e esses valores precisam
	// continuar sendo destinos válidos — e continuar sendo o FEED.
	it("o feed de cada rede tem o nome da rede", () => {
		for (const platform of SOCIAL_PLATFORMS) {
			expect(SOCIAL_DESTINATIONS).toContain(platform);
			expect(DESTINATION_PLATFORM[platform]).toBe(platform);
			expect(DESTINATION_FORMAT[platform]).toBe("FEED");
		}
	});

	it("os Stories publicam com a conta do Instagram", () => {
		expect(DESTINATION_PLATFORM.INSTAGRAM_STORIES).toBe("INSTAGRAM");
		expect(DESTINATION_FORMAT.INSTAGRAM_STORIES).toBe("STORY");
		expect(DESTINATION_LABEL.INSTAGRAM_STORIES).toBe("Stories do Instagram");
	});

	it("destinationOf é o caminho de volta, e diz null para o que não existe", () => {
		expect(destinationOf("INSTAGRAM", "STORY")).toBe("INSTAGRAM_STORIES");
		expect(destinationOf("INSTAGRAM", "FEED")).toBe("INSTAGRAM");
		expect(destinationOf("FACEBOOK", "FEED")).toBe("FACEBOOK");
		expect(destinationOf("FACEBOOK", "STORY")).toBeNull();
	});

	it("reconhece destino válido", () => {
		expect(isSocialDestination("INSTAGRAM_STORIES")).toBe(true);
		expect(isSocialDestination("FACEBOOK_STORIES")).toBe(false);
	});

	it("Stories: sem legenda, só a primeira imagem, em 9:16", () => {
		expect(PLATFORM_LIMITS.INSTAGRAM_STORIES).toMatchObject({
			publishesCaption: false,
			images: "FIRST",
			imageAspect: "9:16",
		});
		expect(PLATFORM_LIMITS.INSTAGRAM).toMatchObject({
			publishesCaption: true,
			images: "ALL",
			imageAspect: "1:1",
		});
	});
});
