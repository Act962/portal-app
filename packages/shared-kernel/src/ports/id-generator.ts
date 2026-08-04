/**
 * IdGenerator — porta que abstrai a geração de identificadores. Injetar em vez
 * de gerar id no meio do domínio mantém os agregados testáveis com ids
 * previsíveis.
 */
export interface IdGenerator {
	generate(): string;
}

/**
 * Implementação de produção: UUID v4 via Web Crypto, embutido no runtime (Node
 * 19+, edge, browser) — zero dependências.
 *
 * A spec citava um `CuidGenerator`, mas a regra de zero dependências externas do
 * shared-kernel prevalece (decisão de 04/08/2026). Um adapter cuid pode
 * substituir este atrás da mesma porta, sem tocar no domínio.
 */
export class UuidGenerator implements IdGenerator {
	generate(): string {
		return globalThis.crypto.randomUUID();
	}
}

/**
 * Implementação de teste: ids sequenciais e previsíveis (`id-1`, `id-2`, ...).
 * Mora aqui, junto da porta, porque é parte do contrato — permite asserções
 * exatas sobre ids em testes de domínio e de aplicação.
 */
export class SequentialIdGenerator implements IdGenerator {
	private counter = 0;
	private readonly prefix: string;

	constructor(prefix = "id") {
		this.prefix = prefix;
	}

	generate(): string {
		this.counter += 1;
		return `${this.prefix}-${this.counter}`;
	}
}
