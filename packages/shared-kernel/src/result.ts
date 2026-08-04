/**
 * Result<T, E> — sucesso (`Ok`) ou falha (`Err`) explícita.
 *
 * Erro de regra de negócio é resultado esperado, não excepcional: "redator não
 * pode publicar" não é uma falha do sistema. Devolver `Result` obriga quem chama
 * a tratar o erro — o compilador cobra — em vez de espalhar `try/catch`. A
 * exceção continua valendo para o que é genuinamente excepcional: banco fora do
 * ar, invariante interna violada. Ver docs/specs/00-fundacao.md §6.
 */
export type Result<T, E> = Ok<T, E> | Err<T, E>;

export class Ok<T, E> {
	readonly value: T;

	constructor(value: T) {
		this.value = value;
	}

	isOk(): this is Ok<T, E> {
		return true;
	}

	isErr(): this is Err<T, E> {
		return false;
	}

	/** Devolve o valor de sucesso. */
	unwrap(): T {
		return this.value;
	}

	/** Nunca deve ser chamado num `Ok` — lança. */
	unwrapErr(): never {
		throw new Error("Chamou unwrapErr() em um Ok");
	}
}

export class Err<T, E> {
	readonly error: E;

	constructor(error: E) {
		this.error = error;
	}

	isOk(): this is Ok<T, E> {
		return false;
	}

	isErr(): this is Err<T, E> {
		return true;
	}

	/** Nunca deve ser chamado num `Err` — lança o erro contido. */
	unwrap(): never {
		throw this.error instanceof Error
			? this.error
			: new Error(`Chamou unwrap() em um Err: ${String(this.error)}`);
	}

	/** Devolve o erro. */
	unwrapErr(): E {
		return this.error;
	}
}

/** Constrói um resultado de sucesso. */
export function ok<T, E = never>(value: T): Result<T, E> {
	return new Ok<T, E>(value);
}

/** Constrói um resultado de falha. */
export function err<E, T = never>(error: E): Result<T, E> {
	return new Err<T, E>(error);
}
