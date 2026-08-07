import type { PageViewRecord } from "../aggregation";
import type { TrafficSource } from "../traffic-source";

export type RecordedPageView = {
	/** Gerado no CLIENTE, para o segundo beacon (tempo de leitura) achar a linha. */
	id: string;
	articleSlug: string;
	occurredAt: Date;
	source: TrafficSource;
};

/**
 * Log DURÁVEL de visualizações, em Postgres. Complementa o `ViewCounterPort`
 * (Redis), que só cobre as últimas 24h e existe para o portal responder
 * rápido: o painel de insights precisa de histórico por período, e isso não
 * cabe num cache descartável.
 *
 * `setReadingTime` é uma segunda escrita porque o tempo de leitura só se sabe
 * quando o leitor SAI da página — a visualização já foi registrada muito
 * antes. Atualizar por id (gerado no cliente) mantém a operação idempotente:
 * o mesmo beacon entregue duas vezes escreve o mesmo valor.
 */
export interface PageViewLogPort {
	record(view: RecordedPageView): Promise<void>;
	setReadingTime(viewId: string, seconds: number): Promise<void>;
	/** Visualizações do intervalo (inclusive nas duas pontas). */
	listBetween(from: Date, to: Date): Promise<PageViewRecord[]>;
}

/** Fake in-memory da porta, para os testes de aplicação. */
export class InMemoryPageViewLog implements PageViewLogPort {
	private readonly views = new Map<string, PageViewRecord>();

	record(view: RecordedPageView): Promise<void> {
		const existing = this.views.get(view.id);
		this.views.set(view.id, {
			articleSlug: view.articleSlug,
			occurredAt: view.occurredAt,
			source: view.source,
			// Registrar de novo não apaga um tempo de leitura já medido.
			readingSeconds: existing?.readingSeconds ?? null,
		});
		return Promise.resolve();
	}

	setReadingTime(viewId: string, seconds: number): Promise<void> {
		const existing = this.views.get(viewId);
		if (existing) {
			this.views.set(viewId, { ...existing, readingSeconds: seconds });
		}
		return Promise.resolve();
	}

	listBetween(from: Date, to: Date): Promise<PageViewRecord[]> {
		const inRange = [...this.views.values()].filter(
			(view) =>
				view.occurredAt.getTime() >= from.getTime() &&
				view.occurredAt.getTime() <= to.getTime(),
		);
		return Promise.resolve(inRange);
	}

	clear(): void {
		this.views.clear();
	}
}
