import { TokenCipher } from "@portal-app/social/infrastructure/token-cipher";
import { describe, expect, it } from "vitest";

const SEGREDO = "um-segredo-de-teste-com-mais-de-32-caracteres";
const TOKEN = "EAACwZC1abcdefghijklmnopqrstuvwxyz0123456789";

describe("TokenCipher", () => {
	const cipher = new TokenCipher(SEGREDO);

	it("decifra o que cifrou", () => {
		expect(cipher.decrypt(cipher.encrypt(TOKEN))).toBe(TOKEN);
	});

	it("o texto cifrado não contém o token", () => {
		expect(cipher.encrypt(TOKEN)).not.toContain("EAACw");
	});

	it("duas cifragens do mesmo token são DIFERENTES", () => {
		// IV aleatório por cifragem. Sem isso, quem olha o banco veria que duas
		// contas usam o mesmo token — ou que o token não mudou desde a última vez.
		expect(cipher.encrypt(TOKEN)).not.toBe(cipher.encrypt(TOKEN));
	});

	it("carrega a versão do formato, para o algoritmo poder mudar depois", () => {
		expect(cipher.encrypt(TOKEN).startsWith("v1.")).toBe(true);
	});

	it("RECUSA texto adulterado — é o que o GCM compra sobre o CBC", () => {
		const cifrado = cipher.encrypt(TOKEN);
		const adulterado = `${cifrado.slice(0, -4)}AAAA`;
		expect(() => cipher.decrypt(adulterado)).toThrow();
	});

	it("recusa formato desconhecido em vez de devolver lixo", () => {
		expect(() => cipher.decrypt("texto-solto")).toThrow("formato desconhecido");
		expect(() => cipher.decrypt("v2.a.b.c")).toThrow("formato desconhecido");
	});

	it("outra chave não decifra — o preço documentado de trocar o segredo", () => {
		const outro = new TokenCipher("outro-segredo-igualmente-longo-e-secreto!");
		expect(() => outro.decrypt(cipher.encrypt(TOKEN))).toThrow();
	});

	it("aguenta token com acento e emoji", () => {
		const esquisito = "token-com-ção-e-🎉";
		expect(cipher.decrypt(cipher.encrypt(esquisito))).toBe(esquisito);
	});
});
