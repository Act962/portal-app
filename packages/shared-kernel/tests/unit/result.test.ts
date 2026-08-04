import { err, ok } from "@portal-app/shared-kernel";
import { describe, expect, it } from "vitest";

class Forbidden extends Error {}

describe("Result", () => {
	it("ok carrega o valor de sucesso", () => {
		const result = ok<number, Forbidden>(42);

		expect(result.isOk()).toBe(true);
		expect(result.isErr()).toBe(false);
		expect(result.unwrap()).toBe(42);
	});

	it("T03: um err não é tratado como sucesso", () => {
		const result = err<Forbidden, number>(
			new Forbidden("redator não pode publicar"),
		);

		expect(result.isOk()).toBe(false);
		expect(result).toBeErr();
		expect(result).toBeErr(Forbidden);
	});

	it("unwrap() em um err lança o próprio erro", () => {
		const result = err<Forbidden, number>(new Forbidden("nope"));

		expect(() => result.unwrap()).toThrow(Forbidden);
	});
});
