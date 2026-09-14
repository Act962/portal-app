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

export type SocialError =
	| SocialPostNotFound
	| SocialAccountNotFound
	| CaptionRequired
	| InvalidMediaSelection
	| UnknownPlatform
	| PostNotReady
	| InvalidPostTransition
	| AccountNotUsable;
