import { createPrismaClient } from "@portal-app/db";
import { env } from "@portal-app/env/server";
import { SystemClock, UuidGenerator } from "@portal-app/shared-kernel";
import {
	type ConnectionProbe,
	type DiagnoseDeps,
	forgetAllCredentials,
	type SocialPlatform,
} from "@portal-app/social";
import {
	EnvironmentInstagramAccountRepository,
	environmentInstagramFrom,
} from "@portal-app/social/infrastructure/environment-instagram";
import { MetaGraphClient } from "@portal-app/social/infrastructure/meta/graph-client";
import { InstagramLoginProbe } from "@portal-app/social/infrastructure/meta/instagram-login-probe";
import { MetaConnectionProbe } from "@portal-app/social/infrastructure/meta/meta-connection-probe";
import {
	buildAuthorizeUrl,
	MetaOAuth,
	type MetaOAuthConfig,
} from "@portal-app/social/infrastructure/meta/meta-oauth";
import { MetaSocialPublisher } from "@portal-app/social/infrastructure/meta/meta-social-publisher";
import {
	parseSignedRequest,
	type SignedRequest,
} from "@portal-app/social/infrastructure/meta/signed-request";
import { PrismaArtTemplateRepository } from "@portal-app/social/infrastructure/prisma-art-template-repository";
import { PrismaSocialAccountRepository } from "@portal-app/social/infrastructure/prisma-social-account-repository";
import { PrismaSocialPostRepository } from "@portal-app/social/infrastructure/prisma-social-post-repository";
import { TokenCipher } from "@portal-app/social/infrastructure/token-cipher";
import { UnconfiguredSocialPublisher } from "@portal-app/social/infrastructure/unconfigured-social-publisher";

import { mediaDeps, mediaStorage } from "./media";
import { ArtRenderer } from "./social-art";
import { CroppedImageSource } from "./social-image";

/**
 * Raiz de composição das redes sociais. Como nos demais contextos, é AQUI que a
 * infraestrutura é instanciada — o resto do app só conhece as portas.
 */
const prisma = createPrismaClient();

/**
 * A chave de cifragem dos tokens vem do `BETTER_AUTH_SECRET` (spec 08, D9): um
 * segredo que já existe, já tem mínimo de 32 caracteres e já é tratado como
 * segredo em todo ambiente. O preço — trocá-lo obriga a reconectar as contas —
 * está documentado em `TokenCipher`.
 */
const cipher = new TokenCipher(env.BETTER_AUTH_SECRET);

/**
 * O Instagram do cliente pelo `.env` (spec 08, §15). Configuração inválida NÃO
 * derruba o servidor: o modo fica desligado, o erro vai para o log e o painel
 * mostra o Instagram como não conectado.
 */
const parsedEnvironmentInstagram = environmentInstagramFrom({
	accessToken: env.META_INSTAGRAM_ACCESS_TOKEN,
	userId: env.META_INSTAGRAM_USER_ID,
	username: env.META_INSTAGRAM_USERNAME,
	tokenExpiresAt: env.META_INSTAGRAM_TOKEN_EXPIRES_AT,
});
if (parsedEnvironmentInstagram.isErr()) {
	console.error(`[social] ${parsedEnvironmentInstagram.unwrapErr()}`);
}
const environmentInstagram = parsedEnvironmentInstagram.isOk()
	? parsedEnvironmentInstagram.unwrap()
	: null;

export const socialAccountRepo = new EnvironmentInstagramAccountRepository(
	new PrismaSocialAccountRepository(prisma, cipher),
	environmentInstagram,
);

/** A conta desta rede vem do `.env`? A tela esconde conectar/desconectar. */
export function isAccountFromEnvironment(platform: SocialPlatform): boolean {
	return socialAccountRepo.isManagedByEnvironment(platform);
}

/** O caminho da volta do login. Precisa estar cadastrado, igual, no App. */
export const META_CALLBACK_PATH = "/api/social/meta/callback";

/**
 * A configuração do App da Meta, ou `null` quando o ambiente não tem as chaves.
 *
 * `null` é estado válido e é o de dev, build e CI (N10): a tela não oferece o
 * login e o publisher recusa dizendo por quê, em vez de tentar e morrer com
 * erro de credencial.
 */
export const metaConfig: MetaOAuthConfig | null =
	env.META_APP_ID && env.META_APP_SECRET
		? {
				appId: env.META_APP_ID,
				appSecret: env.META_APP_SECRET,
				version: env.META_GRAPH_VERSION,
				redirectUri: `${env.BETTER_AUTH_URL.replace(/\/+$/, "")}${META_CALLBACK_PATH}`,
			}
		: null;

const graph = new MetaGraphClient({ version: env.META_GRAPH_VERSION });

/** O host do token do login do Instagram — só usado com o Instagram do `.env`. */
const instagramGraph = new MetaGraphClient({
	version: env.META_GRAPH_VERSION,
	baseUrl: "https://graph.instagram.com",
});

export const metaOAuth = metaConfig ? new MetaOAuth(metaConfig, graph) : null;

/**
 * A URL do diálogo de login, ou `null` sem App configurado. Exposta daqui para a
 * rota do app não importar a infraestrutura do contexto (`infra-nao-vaza`).
 */
export function metaAuthorizeUrl(state: string): string | null {
	return metaConfig ? buildAuthorizeUrl(metaConfig, state) : null;
}

export const socialDeps = {
	repo: new PrismaSocialPostRepository(prisma),
	accounts: socialAccountRepo,
	// Com o App configurado, o adapter real. Sem ele, o que RECUSA e diz por quê
	// — nunca um dublê que finja sucesso (D17).
	// O Instagram do `.env` publica sem App configurado: o token já é a
	// autorização inteira. O Facebook, nesse caso, cai em "nenhuma conta".
	publisher:
		metaConfig || environmentInstagram
			? new MetaSocialPublisher({
					client: graph,
					instagramClient: environmentInstagram ? instagramGraph : undefined,
					credentialsFor: (platform) =>
						socialAccountRepo.credentialsFor(platform),
				})
			: new UnconfiguredSocialPublisher(),
	images: new CroppedImageSource({
		media: mediaDeps.repo,
		storage: mediaStorage,
	}),
	clock: new SystemClock(),
	ids: new UuidGenerator(),
};

/**
 * O desenhista dos padrões (spec 09, F3): a prévia do editor e a arte que vai
 * ao ar saem dele, do mesmo código.
 */
export const artRenderer = new ArtRenderer({
	media: mediaDeps.repo,
	storage: mediaStorage,
});

/** Os padrões de arte (spec 09). */
export const templateDeps = {
	templates: new PrismaArtTemplateRepository(prisma),
	clock: socialDeps.clock,
	ids: socialDeps.ids,
};

/** As redes que recebem o post automático de cada matéria publicada. */
export const AUTO_POST_PLATFORMS = ["INSTAGRAM", "FACEBOOK"] as const;

/**
 * O diagnóstico das contas (spec 08, §14). A URL de amostra sai do MESMO
 * armazenamento que monta as imagens publicadas: é ela que diz se a Meta vai
 * conseguir baixá-las.
 */
const metaProbe = metaConfig
	? new MetaConnectionProbe({
			client: graph,
			appId: metaConfig.appId,
			appSecret: metaConfig.appSecret,
		})
	: null;

const instagramProbe = environmentInstagram
	? new InstagramLoginProbe({ client: instagramGraph })
	: null;

/** Cada conta é inspecionada pela sonda do tipo de token que ela usa. */
const accountProbe: ConnectionProbe | null =
	metaProbe || instagramProbe
		? {
				inspect: (credentials) => {
					if (credentials.platform === "INSTAGRAM" && instagramProbe) {
						return instagramProbe.inspect(credentials);
					}
					if (metaProbe) {
						return metaProbe.inspect(credentials);
					}
					return Promise.resolve({
						problems: [
							"O login da Meta não está configurado neste ambiente (META_APP_ID e META_APP_SECRET).",
						],
						quota: null,
					});
				},
			}
		: null;

export const diagnoseDeps: DiagnoseDeps = {
	accounts: socialAccountRepo,
	probe: accountProbe,
	clock: socialDeps.clock,
	mediaSampleUrl: mediaStorage.publicUrl("social/diagnostico.jpg"),
};

// ── avisos que a Meta manda ao portal ─────────────────────────────────────────

/**
 * Lê e confere o `signed_request` de um aviso da Meta (remoção do App, pedido
 * de exclusão de dados). `null` sem App configurado, sem o campo, ou com
 * assinatura que não bate — as rotas respondem 400 nos três casos.
 */
export async function metaSignedRequestFrom(
	request: Request,
): Promise<SignedRequest | null> {
	if (!metaConfig) {
		return null;
	}
	const form = await request.formData().catch(() => null);
	const signed = form?.get("signed_request");
	return typeof signed === "string"
		? parseSignedRequest(signed, metaConfig.appSecret)
		: null;
}

/** Apaga as credenciais da Meta guardadas pelo portal. */
export function forgetMetaCredentials() {
	return forgetAllCredentials({ accounts: socialAccountRepo });
}

// ── cookies do login da Meta ──────────────────────────────────────────────────

/** O `state` anti-CSRF, conferido na volta do login. */
export const META_STATE_COOKIE = "portal_meta_state";

/**
 * O token de USUÁRIO entre a volta do login e a escolha da Página.
 *
 * Existe porque a pessoa pode administrar várias Páginas (agência, rede de
 * lojas), e a escolha é uma tela, não um parâmetro. O token precisa sobreviver
 * entre dois pedidos sem ir para o banco — ele dá acesso a TODAS as Páginas da
 * pessoa, e só uma vai ser conectada.
 *
 * Por isso: cifrado com a mesma chave dos tokens guardados, `httpOnly`,
 * restrito ao caminho do tRPC, e com prazo embutido no próprio conteúdo — dez
 * minutos, conferidos no servidor, sem confiar só no `maxAge` do navegador.
 */
export const META_PENDING_COOKIE = "portal_meta_pending";

export const META_COOKIE_MAX_AGE_SECONDS = 600;

export function sealPendingToken(userToken: string, now: Date): string {
	return cipher.encrypt(
		JSON.stringify({
			t: userToken,
			exp: now.getTime() + META_COOKIE_MAX_AGE_SECONDS * 1000,
		}),
	);
}

/** Devolve o token ou `null` se o cookie falta, foi adulterado ou venceu. */
export function unsealPendingToken(
	sealed: string | undefined,
	now: Date,
): string | null {
	if (!sealed) {
		return null;
	}
	try {
		const payload = JSON.parse(cipher.decrypt(sealed)) as {
			t?: string;
			exp?: number;
		};
		if (!payload.t || !payload.exp || payload.exp < now.getTime()) {
			return null;
		}
		return payload.t;
	} catch {
		return null;
	}
}

/** Lê um cookie do cabeçalho — o contexto do tRPC só tem os headers crus. */
export function readCookie(headers: Headers, name: string): string | undefined {
	const header = headers.get("cookie");
	if (!header) {
		return undefined;
	}
	for (const part of header.split(";")) {
		const [key, ...rest] = part.trim().split("=");
		if (key === name) {
			return decodeURIComponent(rest.join("="));
		}
	}
	return undefined;
}
