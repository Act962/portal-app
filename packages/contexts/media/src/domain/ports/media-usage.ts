/**
 * Porta de USO: "alguma matéria usa este arquivo?" (D4).
 *
 * O contexto de mídia NÃO conhece `Article`, e não pode passar a conhecer sem
 * quebrar `contextos-isolados`. Então a pergunta é uma porta: o adapter real
 * mora na raiz de composição (`packages/api`) e quem responde é o editorial.
 * É o mesmo arranjo do `ContentUsage` da taxonomia.
 *
 * Sem esta guarda, excluir uma imagem não dá erro em lugar nenhum: o portal
 * simplesmente passa a servir imagem quebrada, e ninguém descobre até um leitor
 * reclamar.
 */
export interface MediaUsage {
	/**
	 * A mídia é capa OU bloco do corpo de alguma matéria?
	 *
	 * Vale para qualquer estado, inclusive rascunho — bloquear só o publicado
	 * deixaria o redator apagar a foto do rascunho do colega, que é a mesma
	 * surpresa com menos testemunhas.
	 */
	isMediaInUse(mediaId: string): Promise<boolean>;
}

/**
 * Padrão do contexto isolado: nada está em uso. É o que roda nos testes de
 * domínio e o que sobra se ninguém plugar o adapter real — como o `StubNoUsage`
 * da taxonomia.
 */
export class StubNoMediaUsage implements MediaUsage {
	isMediaInUse(): Promise<boolean> {
		return Promise.resolve(false);
	}
}

/** Fake de teste: declara à mão quais ids estão em uso. */
export class InMemoryMediaUsage implements MediaUsage {
	constructor(private readonly inUse = new Set<string>()) {}

	isMediaInUse(mediaId: string): Promise<boolean> {
		return Promise.resolve(this.inUse.has(mediaId));
	}

	markInUse(mediaId: string): void {
		this.inUse.add(mediaId);
	}
}
