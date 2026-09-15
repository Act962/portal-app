/** Erros do contexto de redes sociais. O `name` é estável: a raiz de composição
 * o traduz em código HTTP, e renomear a classe muda a resposta da API. */

export class SocialPostNotFound extends Error {
	override readonly name = "SocialPostNotFound";
	constructor(id: string) {
		super(`Publicação não encontrada: ${id}`);
	}
}

export class SocialAccountNotFound extends Error {
	override readonly name = "SocialAccountNotFound";
	constructor(platform: string) {
		super(`Nenhuma conta do ${platform} está conectada.`);
	}
}

export class CaptionRequired extends Error {
	override readonly name = "CaptionRequired";
	constructor() {
		super("A publicação precisa de uma legenda.");
	}
}

export class InvalidMediaSelection extends Error {
	override readonly name = "InvalidMediaSelection";
	constructor(reason: string) {
		super(`Seleção de imagens inválida: ${reason}`);
	}
}

export class UnknownPlatform extends Error {
	override readonly name = "UnknownPlatform";
	constructor(value: string) {
		super(`Rede social desconhecida: ${value}`);
	}
}

/**
 * Impede aprovar um post que ainda não pode ir ao ar, com a lista do que falta.
 *
 * A lista viaja junto pelo mesmo motivo do `CampaignNotReady` da publicidade: a
 * tela precisa dizer o que corrigir ANTES do clique. "Não foi possível
 * publicar" sem o porquê é o que faz alguém abrir chamado.
 */
export class PostNotReady extends Error {
	override readonly name = "PostNotReady";
	constructor(readonly blockers: readonly string[]) {
		/* v8 ignore next -- o `??` é só para o tipo: quem constrói este erro é
		   `approve`, e só quando há ao menos um impedimento. */
		super(blockers[0] ?? "A publicação não está pronta para ir ao ar.");
	}
}

/**
 * A operação não cabe no estado atual do post — aprovar o que já foi publicado,
 * editar o que está a caminho da Meta.
 *
 * Diz o estado atual na mensagem porque a causa real, quase sempre, é DUAS
 * ABAS abertas: alguém aprovou na outra, e nesta o botão continuava lá.
 */
export class InvalidPostTransition extends Error {
	override readonly name = "InvalidPostTransition";
	constructor(operation: string, currentStatus: string) {
		super(
			`Não é possível ${operation}: a publicação está com status ${currentStatus}.`,
		);
	}
}

/**
 * A operação não cabe no estado de UMA entrega — confirmar a publicação manual
 * de um story que ainda não tem arte, dispensar o que já está no ar (spec 11).
 * Mesma causa provável do `InvalidPostTransition`: outra aba já agiu.
 */
export class InvalidDeliveryTransition extends Error {
	override readonly name = "InvalidDeliveryTransition";
	constructor(operation: string, destinationLabel: string, status: string) {
		super(
			`Não é possível ${operation} em ${destinationLabel}: a entrega está com status ${status}.`,
		);
	}
}

/**
 * A conta conectada não serve para publicar agora — token expirado, acesso
 * revogado pelo dono da Página, ou conta desligada no painel.
 */
export class AccountNotUsable extends Error {
	override readonly name = "AccountNotUsable";
	constructor(
		readonly platform: string,
		reason: string,
	) {
		super(`A conta do ${platform} não pode publicar: ${reason}`);
	}
}

/**
 * A arte escolhida não serve ao post — destino que o post não tem, ou padrão
 * num formato que o destino não aceita (4:5 nos Stories).
 */
export class InvalidArtChoice extends Error {
	override readonly name = "InvalidArtChoice";
}

/**
 * Aprovar a publicação de uma matéria que ainda não está no ar (spec 09, F6).
 * O link da matéria não existe antes da publicação — o post iria para as redes
 * apontando para nada. Preparar como rascunho continua valendo.
 */
export class ArticleNotPublished extends Error {
	override readonly name = "ArticleNotPublished";
	constructor() {
		super(
			"Publique a matéria antes de aprovar a publicação nas redes — até lá, o link dela ainda não existe. Dá para salvar como rascunho.",
		);
	}
}

export class ArtTemplateNotFound extends Error {
	override readonly name = "ArtTemplateNotFound";
	constructor(id: string) {
		super(`Padrão de arte não encontrado: ${id}`);
	}
}

export type SocialError =
	| ArtTemplateNotFound
	| InvalidArtChoice
	| SocialPostNotFound
	| SocialAccountNotFound
	| CaptionRequired
	| InvalidMediaSelection
	| UnknownPlatform
	| PostNotReady
	| InvalidPostTransition
	| InvalidDeliveryTransition
	| AccountNotUsable;
