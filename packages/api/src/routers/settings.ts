import {
	getSiteSettings,
	type SettingsError,
	type SiteSettings,
	updateSiteSettings,
} from "@portal-app/settings";
import type { Result } from "@portal-app/shared-kernel";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { dispatchEditorialEvents } from "../editorial";
import { requirePermission, router, staffProcedure } from "../index";
import { settingsDeps } from "../settings";

const linkSchema = z.object({
	label: z.string(),
	// Sem validação de formato aqui de propósito: quem recusa `javascript:` é o
	// domínio (D9), num lugar só. O zod da borda checa a FORMA, não a regra.
	href: z.string(),
});

/**
 * Todos os campos são opcionais: a tela salva por aba, mandando só o que mexeu.
 * O agregado aplica apenas as chaves presentes e valida o resultado inteiro.
 */
const updateSchema = z.object({
	name: z.string().optional(),
	shortName: z.string().optional(),
	tagline: z.string().optional(),
	description: z.string().optional(),
	url: z.string().optional(),
	city: z.string().optional(),
	state: z.string().optional(),
	logoMediaId: z.string().nullable().optional(),

	radioFrequency: z.string().nullable().optional(),
	radioBand: z.string().nullable().optional(),
	radioStreamUrl: z.string().nullable().optional(),

	contactNewsroom: z.string().nullable().optional(),
	contactWhatsapp: z.string().nullable().optional(),
	contactEmail: z.string().nullable().optional(),
	contactAddress: z.string().nullable().optional(),

	social: z.array(linkSchema).optional(),
	institutional: z.array(linkSchema).optional(),
	popularSearches: z.array(z.string()).optional(),

	legal: z.string().nullable().optional(),
});

function unwrap(result: Result<SiteSettings, SettingsError>) {
	if (result.isErr()) {
		// Erro de REGRA, não de sistema: o formulário mostra a mensagem do domínio,
		// que já vem em pt-BR e explica o que consertar.
		throw new TRPCError({
			code: "BAD_REQUEST",
			message: result.unwrapErr().message,
		});
	}
	return result.unwrap().data;
}

export const settingsRouter = router({
	/**
	 * Leitura liberada a qualquer membro ativo: o painel inteiro mostra nome e
	 * logo do veículo, não só quem administra. Exigir `settings:manage` aqui
	 * repetiria o defeito que já apareceu em `taxonomy.sections.list`, onde
	 * REDATOR e EDITOR levavam FORBIDDEN numa leitura inofensiva.
	 */
	get: staffProcedure.query(
		async () => (await getSiteSettings(settingsDeps)).data,
	),

	update: requirePermission("settings:manage")
		.input(updateSchema)
		.mutation(async ({ input }) => {
			const result = await updateSiteSettings(input, settingsDeps);
			const data = unwrap(result);

			// Leva o SiteSettingsChanged do outbox até a auditoria (D10). Mesmo
			// despacho do editorial — é um relay só, para um outbox só.
			await dispatchEditorialEvents();

			return data;
		}),
});
