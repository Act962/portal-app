import {
	SequentialIdGenerator,
	UuidGenerator,
} from "@portal-app/shared-kernel";
import { describe, expect, it } from "vitest";

describe("SequentialIdGenerator", () => {
	it("T02: gera ids previsíveis e crescentes", () => {
		const ids = new SequentialIdGenerator();

		expect(ids.generate()).toBe("id-1");
		expect(ids.generate()).toBe("id-2");
		expect(ids.generate()).toBe("id-3");
	});

	it("respeita o prefixo informado", () => {
		const ids = new SequentialIdGenerator("art");

		expect(ids.generate()).toBe("art-1");
		expect(ids.generate()).toBe("art-2");
	});
});

describe("UuidGenerator", () => {
	it("gera um UUID v4 válido e único", () => {
		const ids = new UuidGenerator();
		const a = ids.generate();
		const b = ids.generate();

		expect(a).toMatch(
			/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
		);
		expect(a).not.toBe(b);
	});
});
