/**
 * Clock — porta que abstrai "que horas são". Injetar em vez de chamar
 * `new Date()` direto no domínio é o que torna lógica sensível a tempo
 * (agendamento, expiração) testável de forma determinística.
 */
export interface Clock {
	now(): Date;
}

/** Implementação de produção: o relógio real do sistema. */
export class SystemClock implements Clock {
	now(): Date {
		return new Date();
	}
}

/**
 * Implementação de teste: devolve sempre o mesmo instante, até que `set()` ou
 * `advance()` o mudem. Mora aqui, junto da porta, porque é parte do contrato —
 * ver docs/testing-strategy.md §11.
 */
export class FixedClock implements Clock {
	private current: Date;

	constructor(current: Date) {
		this.current = new Date(current.getTime());
	}

	now(): Date {
		// Cópia defensiva: o chamador não pode mutar o instante interno.
		return new Date(this.current.getTime());
	}

	/** Fixa o relógio num novo instante. */
	set(instant: Date): void {
		this.current = new Date(instant.getTime());
	}

	/** Avança o relógio em N milissegundos. */
	advance(milliseconds: number): void {
		this.current = new Date(this.current.getTime() + milliseconds);
	}
}
