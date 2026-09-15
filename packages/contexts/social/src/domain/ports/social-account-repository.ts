import type { SocialPlatform } from "../platform";
import type { SocialAccount } from "../social-account";

/**
 * As credenciais de uma conta conectada.
 *
 * Tipo separado do agregado, e é toda a razão de este arquivo existir em vez de
 * um campo a mais em `SocialAccount`: o token só é buscado no instante da
 * chamada à Meta, por quem vai fazê-la. Ele não passa pelo tRPC, não entra em
 * DTO, não vira linha de auditoria e não aparece em log de erro — porque nunca
 * esteve no objeto que trafega por esses caminhos.
 */
export type AccountCredentials = {
	accountId: string;
	platform: SocialPlatform;
	accountRemoteId: string;
	accessToken: string;
};

export interface SocialAccountRepository {
	/**
	 * Grava a conta JUNTO com o token — o único caminho por onde um segredo
	 * entra. Separado do `save` de propósito: assim é impossível salvar o
	 * agregado sem querer e apagar o token, e é impossível precisar do token em
	 * mãos para uma operação que não tem nada a ver com ele.
	 */
	connect(account: SocialAccount, accessToken: string): Promise<void>;

	/** Atualiza o agregado **sem tocar no segredo**. */
	save(account: SocialAccount): Promise<void>;

	/**
	 * A conta conectada de uma rede. **Uma por rede**, e não uma lista: o portal
	 * é um veículo, com um Instagram e uma Página. Permitir várias custaria uma
	 * escolha de destino em toda tela para resolver um problema que este cliente
	 * não tem — e voltar atrás depois é mais barato do que remover uma escolha
	 * que a redação já aprendeu a fazer.
	 */
	findByPlatform(platform: SocialPlatform): Promise<SocialAccount | null>;

	listAll(): Promise<readonly SocialAccount[]>;

	/** Lido só pelo adapter da Meta, no momento da chamada. */
	credentialsFor(platform: SocialPlatform): Promise<AccountCredentials | null>;

	/**
	 * APAGA o token e desliga a conta — o pedido de exclusão de dados da Meta.
	 *
	 * Diferente de `disconnect` + `save`, que guardam o token para uma reconexão
	 * sem novo login: aqui o segredo deixa de existir. O registro da conta fica,
	 * porque o histórico do que foi publicado aponta para ele e não contém dado
	 * do usuário da Meta. Devolve `false` quando a rede não tinha conta.
	 */
	forget(platform: SocialPlatform): Promise<boolean>;
}
