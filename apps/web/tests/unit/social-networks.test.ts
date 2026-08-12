import { describe, expect, it } from "vitest";

import { resolveNetwork } from "@/lib/social-networks";

describe("resolveNetwork", () => {
	it("reconhece o nome da rede como está escrito", () => {
		expect(resolveNetwork("Instagram")).toBe("instagram");
		expect(resolveNetwork("YouTube")).toBe("youtube");
	});

	it("ignora caixa, acento e pontuação", () => {
		// O rótulo é digitado à mão nas Configurações: cada veículo escreve de um
		// jeito, e todos precisam cair no mesmo ícone.
		expect(resolveNetwork("  FACEBOOK  ")).toBe("facebook");
		expect(resolveNetwork("X (Twitter)")).toBe("twitter");
		expect(resolveNetwork("Linked-In")).toBe("linkedin");
		expect(resolveNetwork("Página")).toBe("website");
	});

	it("casa 'X' e 'Twitter' na mesma rede", () => {
		// O campo do domínio se chama `twitter` e a marca hoje é "X". Os dois
		// precisam valer, porque o cadastro antigo diz um e o novo diz o outro.
		expect(resolveNetwork("X")).toBe("twitter");
		expect(resolveNetwork("Twitter")).toBe("twitter");
	});

	it("devolve null quando não reconhece — o texto continua legível", () => {
		expect(resolveNetwork("Nosso canal")).toBeNull();
		expect(resolveNetwork("")).toBeNull();
	});

	it("não casa por substring", () => {
		// "Siga no X" contém "x". Casar por "contém" poria o logo do X num link
		// que pode levar a qualquer lugar — errar em silêncio é pior do que
		// mostrar o texto.
		expect(resolveNetwork("Siga no X")).toBeNull();
		expect(resolveNetwork("Fale conosco")).toBeNull();
	});
});
