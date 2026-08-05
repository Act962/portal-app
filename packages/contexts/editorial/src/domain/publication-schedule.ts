import { type Result, ValueObject, err, ok } from "@portal-app/shared-kernel";

import { ScheduleInPast } from "./errors";

/**
 * Agendamento de publicação — o instante futuro em que a matéria vai ao ar. Só
 * aceita o futuro (A12); o "agora" vem de fora (porta `Clock`), o que torna o
 * agendamento testável com `FixedClock`, sem depender do relógio real.
 */
export class PublicationSchedule extends ValueObject<{ at: string }> {
	private constructor(at: Date) {
		// Guardado como ISO para igualdade estrutural estável do VO.
		super({ at: at.toISOString() });
	}

	static create(at: Date, now: Date): Result<PublicationSchedule, ScheduleInPast> {
		if (at.getTime() <= now.getTime()) {
			return err(new ScheduleInPast());
		}
		return ok(new PublicationSchedule(at));
	}

	get at(): Date {
		return new Date(this.props.at);
	}

	/** Já chegou a hora? Comparado contra o "agora" injetado. */
	isDue(now: Date): boolean {
		return now.getTime() >= new Date(this.props.at).getTime();
	}
}
