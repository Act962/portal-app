import { SOCIAL_PLATFORMS, type SocialPlatform } from "../domain/platform";
import type { SocialAccountRepository } from "../domain/ports/social-account-repository";

/**
 * Apaga as credenciais da Meta guardadas pelo portal.
 *
 * É a resposta aos dois avisos que a Meta manda (spec 08, §14): alguém removeu o
 * App das próprias configurações, ou pediu a exclusão dos dados. **Sem ator**,
 * porque quem chama é a Meta — a autenticação é a assinatura do pedido,
 * conferida na rota antes de chegar aqui.
 *
 * Apaga TODAS as redes, e não só as de quem pediu: o portal não guarda o id do
 * usuário da Meta que fez o login (só os ids da Página e do Instagram), e as
 * duas contas nascem do MESMO login (§6.4). Apagar a mais é reversível com um
 * novo "Conectar com a Meta"; apagar a menos manteria um token que alguém
 * pediu para sumir.
 */
export async function forgetAllCredentials(deps: {
	accounts: SocialAccountRepository;
}): Promise<readonly SocialPlatform[]> {
	const forgotten: SocialPlatform[] = [];
	for (const platform of SOCIAL_PLATFORMS) {
		if (await deps.accounts.forget(platform)) {
			forgotten.push(platform);
		}
	}
	return forgotten;
}
