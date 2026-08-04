import { FixedClock, SystemClock } from "@portal-app/shared-kernel";
import { describe, expect, it } from "vitest";

describe("FixedClock", () => {
	it("T01: devolve sempre o mesmo instante", () => {
		const instant = new Date("2026-08-03T10:00:00.000Z");
		const clock = new FixedClock(instant);

		expect(clock.now().getTime()).toBe(instant.getTime());
		expect(clock.now().getTime()).toBe(clock.now().getTime());
	});

	it("advance() move o relógio de forma determinística", () => {
		const clock = new FixedClock(new Date("2026-08-03T10:00:00.000Z"));
		clock.advance(60_000);

		expect(clock.now().toISOString()).toBe("2026-08-03T10:01:00.000Z");
	});

	it("now() é cópia defensiva — mutar o retorno não afeta o relógio", () => {
		const clock = new FixedClock(new Date("2026-08-03T10:00:00.000Z"));
		const first = clock.now();
		first.setFullYear(1900);

		expect(clock.now().getUTCFullYear()).toBe(2026);
	});
});

describe("SystemClock", () => {
	it("devolve um Date", () => {
		expect(new SystemClock().now()).toBeInstanceOf(Date);
	});
});
