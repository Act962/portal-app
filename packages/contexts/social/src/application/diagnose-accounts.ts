import { can, Forbidden, type StaffMember } from "@portal-app/identity";
import { type Clock, err, ok, type Result } from "@portal-app/shared-kernel";

import {
	PLATFORM_LABEL,
	SOCIAL_PLATFORMS,
	type SocialPlatform,
} from "../domain/platform";
import type {
	ConnectionProbe,
	PublishingQuota,
} from "../domain/ports/connection-probe";
import type { SocialAccountRepository } from "../domain/ports/social-account-repository";
import { mediaUrlProblem } from "../domain/public-media-url";

export type DiagnoseDeps = {
	accounts: SocialAccountRepository;
	/** `null` quando o ambiente não tem o App da Meta configurado. */
	probe: ConnectionProbe | null;
	clock: Clock;
	/** Uma URL de imagem como o armazenamento a montaria — é ela que diz se a
	 * Meta vai conseguir baixar as fotos. */
	mediaSampleUrl: string;
};

/**
 * - `PRONTA`: publica.
 * - `ATENCAO`: publica, mas algo vai parar a fila em breve.
 * - `BLOQUEADA`: não publica; `problems` diz por quê.
 */
export type DiagnosisVerdict = "PRONTA" | "ATENCAO" | "BLOQUEADA";

export type AccountDiagnosis = {
	platform: SocialPlatform;
	verdict: DiagnosisVerdict;
	problems: readonly string[];
	warnings: readonly string[];
	quota: PublishingQuota | null;
};

/** A partir de que fração da cota diária o painel começa a avisar. */
export const QUOTA_WARNING_RATIO = 0.8;

/**
 * "Esta rede consegue publicar agora?" — respondido sem publicar nada.
 *
 * Junta, por rede, tudo que já derrubou uma publicação: conta ausente ou
 * vencida, App não configurado, token revogado do lado da Meta, permissão que
 * faltou no login, cota do dia, e armazenamento que a Meta não alcança. É o
 * primeiro passo do roteiro do go-live (spec 08, §14): o primeiro contato com a
 * Meta real é este botão, não uma notícia.
 *
 * `social:publish` basta, como na lista de contas: quem aprova post precisa
 * entender por que a fila não anda. Nenhum token sai daqui.
 */
export async function diagnoseAccounts(
	actor: StaffMember,
	deps: DiagnoseDeps,
): Promise<Result<readonly AccountDiagnosis[], Forbidden>> {
	if (!can(actor, "social:publish")) {
		return err(new Forbidden());
	}
	const mediaProblem = mediaUrlProblem(deps.mediaSampleUrl);
	const report: AccountDiagnosis[] = [];
	for (const platform of SOCIAL_PLATFORMS) {
		report.push(await diagnose(platform, deps, mediaProblem));
	}
	return ok(report);
}

async function diagnose(
	platform: SocialPlatform,
	deps: DiagnoseDeps,
	mediaProblem: string | null,
): Promise<AccountDiagnosis> {
	const label = PLATFORM_LABEL[platform];
	const now = deps.clock.now();
	const problems: string[] = [];
	const warnings: string[] = [];
	let quota: PublishingQuota | null = null;

	const done = (): AccountDiagnosis => ({
		platform,
		verdict:
			problems.length > 0
				? "BLOQUEADA"
				: warnings.length > 0
					? "ATENCAO"
					: "PRONTA",
		problems,
		warnings,
		quota,
	});

	// Vale para as duas redes e independe da conta: sem imagem alcançável, nada
	// sai, esteja a conta conectada ou não.
	if (mediaProblem) {
		problems.push(
			`O ${label} não vai conseguir baixar as imagens: ${mediaProblem}. Aponte o armazenamento de mídia para um endereço público.`,
		);
	}

	const account = await deps.accounts.findByPlatform(platform);
	if (!account) {
		problems.push(`Nenhuma conta do ${label} está conectada.`);
		return done();
	}
	const unusable = account.unusableReasonAt(now);
	if (unusable) {
		problems.push(`A conta não pode publicar: ${unusable}.`);
		return done();
	}
	if (account.stateAt(now) === "EXPIRANDO") {
		warnings.push(
			"A autorização vence em breve. Refaça o login da Meta para a fila não parar.",
		);
	}

	if (!deps.probe) {
		problems.push(
			"A integração com a Meta não está configurada neste ambiente (META_APP_ID e META_APP_SECRET).",
		);
		return done();
	}
	const credentials = await deps.accounts.credentialsFor(platform);
	if (!credentials) {
		problems.push(
			`A credencial do ${label} não foi encontrada. Reconecte com a Meta.`,
		);
		return done();
	}

	const inspection = await deps.probe.inspect(credentials);
	problems.push(...inspection.problems);
	quota = inspection.quota;
	if (quota && quota.used >= quota.total) {
		problems.push(
			`O limite de ${quota.total} publicações em 24 horas foi atingido.`,
		);
	} else if (quota && quota.used >= quota.total * QUOTA_WARNING_RATIO) {
		warnings.push(
			`${quota.used} de ${quota.total} publicações usadas nas últimas 24 horas.`,
		);
	}
	return done();
}
