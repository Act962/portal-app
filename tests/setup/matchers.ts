import { type DomainEvent, Err } from "@portal-app/shared-kernel";
import { expect } from "vitest";

type ErrorClass = new (...args: never[]) => Error;
type EventClass = new (...args: never[]) => DomainEvent;

/**
 * Matchers compartilhados que operam sobre tipos do `shared-kernel`:
 *
 * - `toBeErr(Classe?)` — o resultado é um `Err` (e, se informado, o erro é
 *   instância da classe). Torna `expect(result).toBeErr(Forbidden)` possível em
 *   vez de desembrulhar o `Result` à mão.
 * - `toContainEventOfType(Classe)` — a lista de eventos contém um do tipo dado.
 */
expect.extend({
	toBeErr(received: unknown, expectedError?: ErrorClass) {
		if (!(received instanceof Err)) {
			return {
				pass: false,
				message: () =>
					`esperava um Err, recebeu ${this.utils.printReceived(received)}`,
			};
		}

		const error: unknown = received.unwrapErr();
		if (expectedError !== undefined && !(error instanceof expectedError)) {
			return {
				pass: false,
				message: () =>
					`esperava Err(${expectedError.name}), recebeu ${this.utils.printReceived(error)}`,
			};
		}

		return {
			pass: true,
			message: () =>
				`esperava que não fosse Err${expectedError ? `(${expectedError.name})` : ""}`,
		};
	},

	toContainEventOfType(received: unknown, eventType: EventClass) {
		const events: unknown[] = Array.isArray(received) ? received : [];
		const pass = events.some((event) => event instanceof eventType);
		return {
			pass,
			message: () =>
				pass
					? `esperava que a lista não contivesse ${eventType.name}`
					: `esperava um ${eventType.name} em ${this.utils.printReceived(received)}`,
		};
	},
});

declare module "vitest" {
	// biome-ignore lint/suspicious/noExplicitAny: espelha a assinatura Assertion<T = any> do vitest para o merge de interface funcionar
	interface Assertion<T = any> {
		toBeErr(expectedError?: ErrorClass): T;
		toContainEventOfType(eventType: EventClass): T;
	}
	interface AsymmetricMatchersContaining {
		toBeErr(expectedError?: ErrorClass): unknown;
		toContainEventOfType(eventType: EventClass): unknown;
	}
}
