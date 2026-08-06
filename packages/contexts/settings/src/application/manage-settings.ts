import type { Clock, Result } from "@portal-app/shared-kernel";

import type { SettingsError } from "../domain/errors";
import type { SiteSettingsRepository } from "../domain/ports/site-settings-repository";
import type { SiteSettings, SiteSettingsData } from "../domain/site-settings";

/**
 * Casos de uso da configuração do site.
 *
 * A AUTORIZAÇÃO fica na fronteira da API (`requirePermission("settings:manage")`),
 * não aqui — é o mesmo arranjo da taxonomia, e é o que mantém este contexto sem
 * importar `identity`, satisfazendo `contextos-isolados`.
 */
type Deps = {
	repo: SiteSettingsRepository;
	clock: Clock;
};

export function getSiteSettings(
	deps: Pick<Deps, "repo">,
): Promise<SiteSettings> {
	return deps.repo.load();
}

export async function updateSiteSettings(
	patch: Partial<SiteSettingsData>,
	deps: Deps,
): Promise<Result<SiteSettings, SettingsError>> {
	const settings = await deps.repo.load();

	const updated = settings.update(patch, deps.clock.now());
	if (updated.isErr()) {
		return updated;
	}

	await deps.repo.save(updated.unwrap());
	return updated;
}
