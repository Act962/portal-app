import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import {
	EndBeforeStart,
	HostRequired,
	InvalidDayOfWeek,
	type InvalidTime,
	NameRequired,
} from "./errors";
import { TimeOfDay } from "./time-of-day";

type ProgramState = {
	name: string;
	host: string;
	dayOfWeek: number;
	startTime: TimeOfDay;
	endTime: TimeOfDay;
	order: number;
};

type CreateInput = {
	id: string;
	name: string;
	host: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	order?: number;
};

type CreateError =
	| NameRequired
	| HostRequired
	| InvalidDayOfWeek
	| InvalidTime
	| EndBeforeStart;

/**
 * Programa da grade — o agregado raiz do contexto de programação. Só grade
 * SEMANAL recorrente (decisão do cliente): um `dayOfWeek` fixo, sem exceção
 * pontual (feriado, substituição). "No ar agora" (`isLiveAt`) não é estado
 * guardado — é sempre calculado a partir do relógio.
 */
export class Program extends AggregateRoot<string> {
	private state: ProgramState;

	private constructor(id: string, state: ProgramState) {
		super(id);
		this.state = state;
	}

	static create(input: CreateInput): Result<Program, CreateError> {
		const name = input.name.trim();
		if (!name) {
			return err(new NameRequired());
		}

		const host = input.host.trim();
		if (!host) {
			return err(new HostRequired());
		}

		if (
			!Number.isInteger(input.dayOfWeek) ||
			input.dayOfWeek < 0 ||
			input.dayOfWeek > 6
		) {
			return err(new InvalidDayOfWeek(input.dayOfWeek));
		}

		const startTime = TimeOfDay.create(input.startTime);
		if (startTime.isErr()) {
			return err(startTime.error);
		}
		const endTime = TimeOfDay.create(input.endTime);
		if (endTime.isErr()) {
			return err(endTime.error);
		}
		if (!startTime.value.isBefore(endTime.value)) {
			return err(new EndBeforeStart());
		}

		return ok(
			new Program(input.id, {
				name,
				host,
				dayOfWeek: input.dayOfWeek,
				startTime: startTime.value,
				endTime: endTime.value,
				order: input.order ?? 0,
			}),
		);
	}

	/** Reidrata a partir da persistência (ou de um teste). Assume dado válido. */
	static restore(props: {
		id: string;
		name: string;
		host: string;
		dayOfWeek: number;
		startTime: string;
		endTime: string;
		order: number;
	}): Program {
		const startTime = TimeOfDay.create(props.startTime);
		const endTime = TimeOfDay.create(props.endTime);
		if (startTime.isErr() || endTime.isErr()) {
			throw new Error("Programa persistido com horário inválido.");
		}
		return new Program(props.id, {
			name: props.name,
			host: props.host,
			dayOfWeek: props.dayOfWeek,
			startTime: startTime.value,
			endTime: endTime.value,
			order: props.order,
		});
	}

	get name(): string {
		return this.state.name;
	}

	get host(): string {
		return this.state.host;
	}

	get dayOfWeek(): number {
		return this.state.dayOfWeek;
	}

	get startTime(): string {
		return this.state.startTime.value;
	}

	get endTime(): string {
		return this.state.endTime.value;
	}

	get order(): number {
		return this.state.order;
	}

	reorderTo(order: number): void {
		this.state = { ...this.state, order };
	}

	/**
	 * Está no ar neste instante? Calculado sempre a partir do relógio (nunca
	 * guardado) — o `now` entra por parâmetro para o teste poder congelar o
	 * tempo (`FixedClock`/data fixa), regra do CLAUDE.md contra `new Date()`
	 * escondido. Início inclusivo, fim exclusivo: às `endTime` em ponto o
	 * programa seguinte já está no ar, não os dois ao mesmo tempo.
	 */
	isLiveAt(now: Date): boolean {
		if (now.getDay() !== this.state.dayOfWeek) {
			return false;
		}
		const minutesNow = now.getHours() * 60 + now.getMinutes();
		return (
			minutesNow >= this.state.startTime.minutes &&
			minutesNow < this.state.endTime.minutes
		);
	}

	/**
	 * Edita os campos informados. Sem VOs "temporários" fora do agregado: a
	 * validação de horário/dia é a mesma do `create`, aqui reaplicada.
	 */
	updateDetails(input: {
		name?: string;
		host?: string;
		dayOfWeek?: number;
		startTime?: string;
		endTime?: string;
	}): Result<void, CreateError> {
		const name = input.name !== undefined ? input.name.trim() : this.state.name;
		if (!name) {
			return err(new NameRequired());
		}

		const host = input.host !== undefined ? input.host.trim() : this.state.host;
		if (!host) {
			return err(new HostRequired());
		}

		const dayOfWeek = input.dayOfWeek ?? this.state.dayOfWeek;
		if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6) {
			return err(new InvalidDayOfWeek(dayOfWeek));
		}

		let startTime = this.state.startTime;
		if (input.startTime !== undefined) {
			const parsed = TimeOfDay.create(input.startTime);
			if (parsed.isErr()) {
				return err(parsed.error);
			}
			startTime = parsed.value;
		}

		let endTime = this.state.endTime;
		if (input.endTime !== undefined) {
			const parsed = TimeOfDay.create(input.endTime);
			if (parsed.isErr()) {
				return err(parsed.error);
			}
			endTime = parsed.value;
		}

		if (!startTime.isBefore(endTime)) {
			return err(new EndBeforeStart());
		}

		this.state = { ...this.state, name, host, dayOfWeek, startTime, endTime };
		return ok(undefined);
	}
}
