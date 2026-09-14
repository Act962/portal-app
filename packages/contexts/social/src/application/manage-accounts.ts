import { can, Forbidden, type StaffMember } from "@portal-app/identity";
import {
	type Clock,
	err,
	type IdGenerator,
	ok,
	type Result,
} from "@portal-app/shared-kernel";

import { SocialAccountNotFound } from "../domain/errors";
import { PLATFORM_LABEL, type SocialPlatform } from "../domain/platform";
import type { SocialAccountRepository } from "../domain/ports/social-account-repository";
import { SocialAccount } from "../domain/social-account";

/**
 * Casos de uso das contas conectadas.
 *
 * Autorização `social:manage`, que na matriz é só de ADMIN (D11): conectar uma
 * conta é entregar à aplicação um token que fala em nome do veículo, e trocar a
 * conta conectada redireciona tudo que sai daqui.
 */
export type AccountDeps = {
	accounts: SocialAccountRepository;
	clock: Clock;
	ids: IdGenerator;
};

export type ConnectInput = {
	platform: SocialPlatform;
	remoteId: string;
	displayName: string;
	avatarUrl?: string | null;
	accessToken: string;
	tokenExpiresAt: Date | null;
};

/**
 * Registra a conta autorizada no fim do fluxo OAuth.
 *
 * O `accessToken` entra por aqui e **não sai mais**: o repositório o cifra, e
 * nenhum dos objetos devolvidos por este módulo o contém.
 */
export async function connectAccount(
	actor: StaffMember,
	input: ConnectInput,
	deps: AccountDeps,
): Promise<Result<SocialAccount, Forbidden>> {
	if (!can(actor, "social:manage")) {
		return err(new Forbidden());
	}
	const account = SocialAccount.connect({
		id: deps.ids.generate(),
		platform: input.platform,
		remoteId: input.remoteId,
		displayName: input.displayName,
		avatarUrl: input.avatarUrl ?? null,
		tokenExpiresAt: input.tokenExpiresAt,
		connectedAt: deps.clock.now(),
		connectedByStaffId: actor.id,
	});
	await deps.accounts.connect(account, input.accessToken);
	return ok(account);
}

/**
 * Desliga a conta. O registro FICA (o histórico de posts aponta para ele) e o
 * token continua guardado, cifrado, até uma reconexão substituí-lo — apagá-lo
 * aqui obrigaria um novo login da Meta para desfazer um clique errado.
 */
export async function disconnectAccount(
	actor: StaffMember,
	input: { platform: SocialPlatform },
	deps: Pick<AccountDeps, "accounts">,
): Promise<Result<SocialAccount, Forbidden | SocialAccountNotFound>> {
	if (!can(actor, "social:manage")) {
		return err(new Forbidden());
	}
	const account = await deps.accounts.findByPlatform(input.platform);
	if (!account) {
		return err(new SocialAccountNotFound(PLATFORM_LABEL[input.platform]));
	}
	account.disconnect();
	await deps.accounts.save(account);
	return ok(account);
}

/** Lista para a tela de contas. Leitura, então basta `social:publish`: quem
 * aprova post precisa saber se a conta está no ar para entender uma falha. */
export async function listAccounts(
	actor: StaffMember,
	deps: Pick<AccountDeps, "accounts">,
): Promise<Result<readonly SocialAccount[], Forbidden>> {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	return ok(await deps.accounts.listAll());
}
