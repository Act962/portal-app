import { loadSiteSettings } from "@/data/queries";

import { type SiteIdentity, siteIdentityFrom } from "./site-identity";

/**
 * A identidade do veículo, lida do banco (spec 07, D1).
 *
 * Separada de `site-identity.ts` para que a parte pura continue testável sem
 * Postgres: aqui mora o único ponto que toca dados. Não precisa de `cache()`
 * próprio — `loadSiteSettings` já é `cache()`, então metadata, schema.org e
 * feeds da mesma renderização compartilham a mesma consulta.
 */
export async function loadSiteIdentity(): Promise<SiteIdentity> {
	return siteIdentityFrom(await loadSiteSettings());
}
