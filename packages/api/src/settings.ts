import { createPrismaClient } from "@portal-app/db";
import type { SiteSettingsRepository } from "@portal-app/settings";
import { PrismaSiteSettingsRepository } from "@portal-app/settings/infrastructure/prisma-site-settings-repository";
import { SystemClock } from "@portal-app/shared-kernel";

/**
 * Raiz de composição do contexto de configurações. Como nos demais, a
 * infraestrutura é instanciada AQUI (camada de API) e não em `apps/web`, para
 * que `infra-nao-vaza` continue satisfazível quando o app entrar no scan do
 * dependency-cruiser.
 */
export const siteSettingsRepo: SiteSettingsRepository =
	new PrismaSiteSettingsRepository(createPrismaClient());

/** Dependências dos casos de uso (relógio real em produção). */
export const settingsDeps = {
	repo: siteSettingsRepo,
	clock: new SystemClock(),
};
