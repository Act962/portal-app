import { describe, expect, it } from "vitest";

import {
	captureResetLink,
	recordResetLink,
} from "../../src/reset-link-capture";

describe("captureResetLink", () => {
	it("devolve a URL registrada dentro da chamada", async () => {
		const { result, url } = await captureResetLink(async () => {
			recordResetLink("https://painel.example/reset-password/abc");
			return "ok";
		});

		expect(result).toBe("ok");
		expect(url).toBe("https://painel.example/reset-password/abc");
	});

	it("devolve undefined quando nada é registrado", async () => {
		const { url } = await captureResetLink(async () => "sem link");
		expect(url).toBeUndefined();
	});

	it("registrar fora de uma captura não quebra e não vaza para a próxima", async () => {
		recordResetLink("https://vazamento.example/nao-deveria-aparecer");

		const { url } = await captureResetLink(async () => "ok");
		expect(url).toBeUndefined();
	});

	it("duas capturas concorrentes não se cruzam (dois admins resetando ao mesmo tempo)", async () => {
		const [a, b] = await Promise.all([
			captureResetLink(async () => {
				await new Promise((resolve) => setTimeout(resolve, 10));
				recordResetLink("https://painel.example/reset-password/a");
				return "a";
			}),
			captureResetLink(async () => {
				recordResetLink("https://painel.example/reset-password/b");
				return "b";
			}),
		]);

		expect(a.url).toBe("https://painel.example/reset-password/a");
		expect(b.url).toBe("https://painel.example/reset-password/b");
	});
});
