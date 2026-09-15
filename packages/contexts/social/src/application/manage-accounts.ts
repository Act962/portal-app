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

/** Uma Página escolhida no fim do login da Meta — o recorte que este caso de
 * uso precisa, sem o formato da resposta da Graph API. */
export type MetaPageChoice = {
	pageId: string;
	pageName: string;
	pageAccessToken: string;
	pagePictureUrl: string | null;
	instagram: {
		id: string;
		username: string;
		pictureUrl: string | null;
	} | null;
};

/**
 * Conecta a Página escolhida — e o Instagram vinculado a ela, se houver.
 *
 * **Um login, duas contas.** É o que justificou o login do Facebook em vez do
 * login do Instagram (spec 08, §6.4): a Página devolve o próprio token e o id do
 * Instagram Business vinculado, e o MESMO token de Página publica nos dois.
 *
 * `tokenExpiresAt: null` nos dois porque o token de Página derivado de um token
 * de usuário longo não expira. Ele pode ser REVOGADO (senha trocada, App
 * removido), e isso chega como erro 190 na hora de publicar.
 *
 * Página sem Instagram vinculado conecta só o Facebook, e o resultado diz isso:
 * a tela precisa avisar que o Instagram continua desconectado, e por quê.
 */
export async function connectMetaPage(
	actor: StaffMember,
	choice: MetaPageChoice,
	deps: AccountDeps,
): Promise<Result<readonly SocialAccount[], Forbidden>> {
	if (!can(actor, "social:manage")) {
		return err(new Forbidden());
	}

	const connected: SocialAccount[] = [];

	const facebook = await connectAccount(
		actor,
		{
			platform: "FACEBOOK",
			remoteId: choice.pageId,
			displayName: choice.pageName,
			avatarUrl: choice.pagePictureUrl,
			accessToken: choice.pageAccessToken,
			tokenExpiresAt: null,
		},
		deps,
	);
	connected.push(facebook.unwrap());

	if (choice.instagram) {
		const instagram = await connectAccount(
			actor,
			{
				platform: "INSTAGRAM",
				remoteId: choice.instagram.id,
				displayName: `@${choice.instagram.username}`,
				avatarUrl: choice.instagram.pictureUrl,
				accessToken: choice.pageAccessToken,
				tokenExpiresAt: null,
			},
			deps,
		);
		connected.push(instagram.unwrap());
	}

	return ok(connected);
}
