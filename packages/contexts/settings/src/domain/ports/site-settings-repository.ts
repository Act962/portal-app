import type { SiteSettings } from "../site-settings";

/**
 * Porta de persistência da configuração. `load` nunca devolve `null`: quando não
 * há linha, o adapter monta o agregado a partir dos defaults (D7) — assim quem
 * chama não precisa tratar "ainda não configurado" em lugar nenhum.
 */
export type SiteSettingsRepository = {
	load(): Promise<SiteSettings>;
	save(settings: SiteSettings): Promise<void>;
};
