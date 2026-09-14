import { PLATFORM_LABEL, type SocialPlatform } from "../../domain/platform";
import type { PublishFailure } from "../../domain/ports/social-publisher";
import type { GraphError } from "./graph-client";

/**
 * Traduz o erro da Meta no que a redação precisa ler — e decide se vale
 * repetir.
 *
 * As frases dizem O QUE houve, nunca o que vai acontecer depois. Quem decide se
 * haverá nova tentativa é o agregado (`SocialPost.recordFailure`), que sabe
 * quantas já foram — prometer "será tentada de novo" aqui mentiria na terceira.
 *
 * As duas metades erram caro, em sentidos opostos. Repetir um "imagem inválida"
 * queima a cota de publicações da conta sem chance de sucesso; desistir de um
 * "tente em instantes" descarta um post que teria ido ao ar sozinho.
 *
 * Só os códigos que a documentação da Graph API estabelece com clareza têm
 * tradução própria. O resto cai no genérico, com a frase da Meta preservada:
 * inventar uma explicação para um código que não conhecemos seria pior do que
 * repetir a dela.
 */
export function toPublishFailure(
	error: GraphError,
	platform: SocialPlatform,
): PublishFailure {
	const label = PLATFORM_LABEL[platform];
	const providerCode =
		error.code === null
			? `HTTP_${error.status}`
			: `${error.code}${error.subcode ? `/${error.subcode}` : ""}`;

	const failure = (reason: string, retryable: boolean): PublishFailure => ({
		reason,
		retryable,
		providerCode,
	});

	// Nem chegou a responder: rede, DNS, timeout.
	if (error.status === 0) {
		return failure(`Não foi possível falar com o ${label} agora.`, true);
	}

	switch (error.code) {
		// Token inválido, expirado ou revogado — o dono da Página trocou a senha,
		// removeu o aplicativo ou tirou o acesso de quem conectou.
		case 190:
			return failure(
				`A autorização do ${label} expirou ou foi revogada. Reconecte a conta em Redes sociais → Contas — ou, se o token vem do .env, gere um novo.`,
				false,
			);
		// Permissão ausente: o App não foi aprovado para o escopo, ou a pessoa
		// desmarcou a permissão no login.
		case 10:
		case 200:
			return failure(
				`O aplicativo do portal não tem permissão para publicar no ${label}. Reconecte a conta aceitando todas as permissões.`,
				false,
			);
		// Limites de chamada da aplicação, do usuário ou da Página.
		case 4:
		case 17:
		case 32:
		case 613:
			return failure(
				`O ${label} pediu uma pausa por excesso de chamadas.`,
				true,
			);
		// Erros internos da Meta, documentados como temporários.
		case 1:
		case 2:
			return failure(`O ${label} está instável no momento.`, true);
		// A Meta não conseguiu baixar a imagem da URL informada.
		case 9004:
			return failure(
				`O ${label} não conseguiu baixar a imagem. Confira se o armazenamento de mídia está acessível pela internet.`,
				false,
			);
		// Imagem acima do limite de tamanho aceito.
		case 36000:
			return failure(`A imagem é grande demais para o ${label}.`, false);
		default:
			break;
	}

	if (error.isTransient || error.status >= 500) {
		return failure(`O ${label} está instável no momento.`, true);
	}

	return failure(
		`O ${label} recusou a publicação: ${error.userMessage ?? error.message}`,
		false,
	);
}
