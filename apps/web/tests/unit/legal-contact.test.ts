import { describe, expect, it } from "vitest";

import { legalContactOf } from "@/lib/legal-contact";

const instagram = { href: "https://instagram.com/fm7cidades" };

describe("legalContactOf — para onde as páginas legais apontam", () => {
	it("com e-mail em alguma linha, é ele", () => {
		expect(
			legalContactOf({
				contactLines: ["Redação · (86) 3343-1107", "contato@fm7cidades.com"],
				social: [instagram],
			}),
		).toEqual({ kind: "email", email: "contato@fm7cidades.com" });
	});

	it("com linhas mas sem e-mail, manda ao rodapé — que as mostra", () => {
		expect(
			legalContactOf({
				contactLines: ["Redação · (86) 3343-1107"],
				social: [instagram],
			}),
		).toEqual({ kind: "footer" });
	});

	it("sem linha nenhuma NÃO manda ao rodapé: o bloco de contato sumiu de lá", () => {
		expect(legalContactOf({ contactLines: [], social: [instagram] })).toEqual({
			kind: "social",
		});
	});

	it("rede sem endereço não conta como canal", () => {
		expect(
			legalContactOf({ contactLines: [], social: [{ href: "" }] }),
		).toEqual({ kind: "none" });
	});

	it("sem contato e sem redes, não promete canal nenhum", () => {
		expect(legalContactOf({ contactLines: [], social: [] })).toEqual({
			kind: "none",
		});
	});
});
