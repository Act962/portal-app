import { AggregateRoot, DomainEvent } from "@portal-app/shared-kernel";
import { describe, expect, it } from "vitest";

class Published extends DomainEvent {
	readonly eventName = "Published";

	constructor(
		readonly articleId: string,
		occurredAt: Date,
	) {
		super(occurredAt);
	}
}

class Article extends AggregateRoot<string> {
	publish(at: Date): void {
		this.record(new Published(this.id, at));
	}
}

function anArticle(id = "art-1"): Article {
	// Subclasse anônima só para poder instanciar (o construtor é protegido).
	return new (class extends Article {
		constructor() {
			super(id);
		}
	})();
}

describe("AggregateRoot", () => {
	it("T04: pullEvents() devolve os eventos e esvazia a fila", () => {
		const article = anArticle();
		article.publish(new Date("2026-08-03T10:00:00.000Z"));

		const events = article.pullEvents();

		expect(events).toHaveLength(1);
		expect(events).toContainEventOfType(Published);
		expect(article.pullEvents()).toHaveLength(0);
	});

	it("não emite evento quando nada acontece", () => {
		expect(anArticle().pullEvents()).toHaveLength(0);
	});
});
