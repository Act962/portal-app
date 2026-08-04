import { AuthorProfile } from "@portal-app/identity";
import { describe, expect, it } from "vitest";

describe("AuthorProfile (I06)", () => {
	it("apara espaços e normaliza os campos", () => {
		const profile = AuthorProfile.create({
			bio: "  Repórter de política  ",
			title: " Editor-chefe ",
			photoUrl: "   ",
			socials: { twitter: "  @redacao  ", instagram: "" },
		});

		expect(profile.bio).toBe("Repórter de política");
		expect(profile.title).toBe("Editor-chefe");
		expect(profile.photoUrl).toBeNull();
		expect(profile.socials).toEqual({ twitter: "@redacao" });
	});

	it("preenche vazios com padrões seguros", () => {
		const profile = AuthorProfile.create({});

		expect(profile.bio).toBe("");
		expect(profile.title).toBe("");
		expect(profile.photoUrl).toBeNull();
		expect(profile.socials).toEqual({});
	});

	it("dois perfis com os mesmos dados são iguais (objeto de valor)", () => {
		const a = AuthorProfile.create({ bio: "x", title: "Repórter" });
		const b = AuthorProfile.create({ bio: "x", title: "Repórter" });

		expect(a.equals(b)).toBe(true);
	});
});
