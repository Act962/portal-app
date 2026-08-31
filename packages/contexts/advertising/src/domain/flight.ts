import { err, ok, type Result } from "@portal-app/shared-kernel";

import { InvalidFlight } from "./errors";

/**
 * O PERÍODO contratado da campanha — de quando até quando ela pode aparecer.
 *
 * Duas escolhas que valem explicar:
 *
 * O fim é OPCIONAL. Contrato sem data de término existe (o anunciante fica "até
 * segunda ordem"), e obrigar uma data faria a equipe inventar "2099", que é
 * pior: some a informação de que não há fim combinado.
 *
 * O período NÃO é validado contra "agora" na criação. Cadastrar hoje uma
 * campanha que começou ontem é rotina — o contrato foi assinado antes de
 * alguém ter tempo de cadastrar. Quem decide se ela aparece é `containsAt`, no
 * momento da veiculação, e não a data de cadastro.
 */
export class Flight {
	private constructor(
		readonly startsAt: Date,
		readonly endsAt: Date | null,
	) {}

	static create(
		startsAt: Date,
		endsAt: Date | null,
	): Result<Flight, InvalidFlight> {
		if (Number.isNaN(startsAt.getTime())) {
			return err(new InvalidFlight("a data de início não é uma data"));
		}
		if (endsAt !== null && Number.isNaN(endsAt.getTime())) {
			return err(new InvalidFlight("a data de término não é uma data"));
		}
		// `<=` e não `<`: início igual ao fim é uma campanha de duração zero, que
		// nunca apareceria. Aceitá-la seria cadastrar um contrato que não pode ser
		// cumprido, e a pessoa só descobriria pelo silêncio.
		if (endsAt !== null && endsAt.getTime() <= startsAt.getTime()) {
			return err(new InvalidFlight("o término precisa ser depois do início"));
		}
		return ok(new Flight(startsAt, endsAt));
	}

	static restore(startsAt: Date, endsAt: Date | null): Flight {
		return new Flight(startsAt, endsAt);
	}

	/**
	 * O período contém este instante?
	 *
	 * Início INCLUSIVO, fim EXCLUSIVO. É a convenção que faz períodos
	 * consecutivos se encaixarem sem sobreposição e sem buraco: uma campanha que
	 * termina dia 1º à meia-noite e outra que começa no mesmo instante trocam de
	 * lugar exatamente ali, sem um segundo em que as duas valem ou nenhuma vale.
	 */
	containsAt(now: Date): boolean {
		if (now.getTime() < this.startsAt.getTime()) {
			return false;
		}
		return this.endsAt === null || now.getTime() < this.endsAt.getTime();
	}

	/** Já passou do fim — usado para o painel dizer "encerrada" sem que ninguém
	 * precise mexer no status à mão. */
	endedAt(now: Date): boolean {
		return this.endsAt !== null && now.getTime() >= this.endsAt.getTime();
	}

	/** Ainda não começou. */
	startsAfter(now: Date): boolean {
		return now.getTime() < this.startsAt.getTime();
	}
}
