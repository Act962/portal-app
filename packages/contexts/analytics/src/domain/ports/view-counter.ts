/**
 * Porta de contagem de visualização, atrás da qual mora o Redis (P05). Conta
 * por SLUG da matéria, não por id interno — o slug é o identificador público
 * e estável (imutável após a primeira publicação), e o portal não precisa
 * vazar o id do agregado `Article` para o contexto de analytics saber do que
 * está falando (`contextos-isolados`: este pacote não importa `editorial`).
 *
 * A janela de "mais lidas" é sempre as últimas 24h contadas a partir de
 * `now` — por isso `now` entra por parâmetro em vez de a implementação usar
 * `new Date()` (regra do CLAUDE.md), o que também é o que deixa
 * `InMemoryViewCounter` testável com um relógio congelado.
 */
export interface ViewCounterPort {
	/** Registra uma visualização da matéria agora. */
	recordView(articleSlug: string, now: Date): Promise<void>;
	/** Os `limit` slugs mais vistos nas últimas 24h antes de `now`, do mais para o menos visto. */
	topSlugs(limit: number, now: Date): Promise<string[]>;
}

const WINDOW_MS = 24 * 60 * 60 * 1000;

/**
 * Fake in-memory da porta. Mora junto do contrato — mesmo padrão de
 * `SectionRepository`/`ProgramRepository` — porque é o que legitima usar um
 * fake nos testes de aplicação: a mesma suíte de contrato roda contra ele e
 * contra o Redis.
 */
export class InMemoryViewCounter implements ViewCounterPort {
	private readonly events: Array<{ slug: string; at: number }> = [];

	recordView(articleSlug: string, now: Date): Promise<void> {
		this.events.push({ slug: articleSlug, at: now.getTime() });
		return Promise.resolve();
	}

	topSlugs(limit: number, now: Date): Promise<string[]> {
		const windowStart = now.getTime() - WINDOW_MS;
		const counts = new Map<string, number>();
		for (const event of this.events) {
			if (event.at >= windowStart && event.at <= now.getTime()) {
				counts.set(event.slug, (counts.get(event.slug) ?? 0) + 1);
			}
		}
		const ranked = [...counts.entries()]
			.sort((a, b) => b[1] - a[1])
			.slice(0, limit)
			.map(([slug]) => slug);
		return Promise.resolve(ranked);
	}

	clear(): void {
		this.events.length = 0;
	}
}
