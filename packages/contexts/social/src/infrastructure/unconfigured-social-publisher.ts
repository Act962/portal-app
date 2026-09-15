import { err, type Result } from "@portal-app/shared-kernel";

import { PLATFORM_LABEL } from "../domain/platform";
import type {
	PublishFailure,
	PublishRequest,
	PublishSuccess,
	SocialPublisher,
} from "../domain/ports/social-publisher";

/**
 * O publisher enquanto o adapter da Meta não existe (fatia F4).
 *
 * Ele **falha, e diz por quê** — não finge que publicou. A tentação era um
 * dublê que devolvesse sucesso para a tela ficar bonita na demonstração, e é
 * exatamente o que não se pode fazer: a fila mostraria "PUBLICADO" em posts que
 * não existem em rede nenhuma, e alguém confiaria nisso. Melhor uma fila
 * honesta cheia de "falta conectar" do que um painel que mente.
 *
 * `retryable: false` de propósito: repetir não resolve falta de código.
 */
export class UnconfiguredSocialPublisher implements SocialPublisher {
	publish(
		request: PublishRequest,
	): Promise<Result<PublishSuccess, PublishFailure>> {
		return Promise.resolve(
			err({
				reason: `A integração com o ${PLATFORM_LABEL[request.platform]} ainda não foi ligada. Conecte a conta em Redes sociais → Contas.`,
				retryable: false,
				providerCode: "NAO_CONFIGURADO",
			}),
		);
	}
}
