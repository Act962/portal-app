import { err, ok, type Result, ValueObject } from "@portal-app/shared-kernel";

import { InvalidTime } from "./errors";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

/**
 * Horário do dia, formato `HH:MM` (24h). Objeto de valor: guarda tanto o texto
 * exibível quanto os minutos desde a meia-noite, que é a forma que a
 * comparação (`isBefore`, "está no ar agora") realmente usa.
 */
export class TimeOfDay extends ValueObject<{ value: string; minutes: number }> {
	private constructor(value: string, minutes: number) {
		super({ value, minutes });
	}

	static create(raw: string): Result<TimeOfDay, InvalidTime> {
		const match = TIME_PATTERN.exec(raw.trim());
		if (!match) {
			return err(new InvalidTime(raw));
		}
		const hours = Number(match[1]);
		const mins = Number(match[2]);
		return ok(new TimeOfDay(raw.trim(), hours * 60 + mins));
	}

	get value(): string {
		return this.props.value;
	}

	get minutes(): number {
		return this.props.minutes;
	}

	isBefore(other: TimeOfDay): boolean {
		return this.minutes < other.minutes;
	}

	toString(): string {
		return this.props.value;
	}
}
