/**
 * Porta de USO: "esta editoria/tag ainda classifica conteúdo publicado?". É o
 * `SectionUsage` da spec (D2/D3), generalizado para tags — o que impede excluir
 * uma editoria ou tag em uso (só desativar, no caso da editoria).
 *
 * O contexto de taxonomia NÃO conhece `Article` (Fase 3). Por isso a pergunta é
 * uma porta: nesta fase o adapter responde SEMPRE "sem uso" (`StubNoUsage`);
 * quando o Editorial existir, ele passa a implementá-la de verdade e a
 * reatribuição de tags na mesclagem liga por aqui. Mantém `contextos-isolados`.
 */
export interface ContentUsage {
	sectionHasPublishedContent(sectionId: string): Promise<boolean>;
	tagHasPublishedContent(tagId: string): Promise<boolean>;
}

/**
 * Stub desta fase: nada está "em uso" porque ainda não há matérias. Trocado pela
 * implementação real do Editorial na Fase 3, sem tocar em taxonomia.
 */
export class StubNoUsage implements ContentUsage {
	sectionHasPublishedContent(): Promise<boolean> {
		return Promise.resolve(false);
	}

	tagHasPublishedContent(): Promise<boolean> {
		return Promise.resolve(false);
	}
}
