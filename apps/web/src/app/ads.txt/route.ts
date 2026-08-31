import { loadAdSense } from "@/data/ads";

/**
 * `/ads.txt` — a autorização IAB para o Google vender nosso inventário.
 *
 * Sem este arquivo no ar, o AdSense trata o inventário como não autorizado e a
 * receita despenca. É exigência da IAB, não recomendação.
 *
 * Gerado a partir do banco, e não um arquivo estático em `public/`, porque o
 * `publisherId` é configurável no painel: um arquivo fixo obrigaria um deploy a
 * cada troca, e um `ads.txt` desatualizado é pior do que nenhum — ele autoriza
 * quem não deveria.
 */
export const revalidate = 3600;

export async function GET(): Promise<Response> {
	const settings = await loadAdSense();
	const line = settings.adsTxtLine();

	// Sem AdSense configurado, um 404 é a resposta honesta: um arquivo vazio
	// diria "não autorizo ninguém", que é diferente de "ainda não uso isto".
	if (!line) {
		return new Response("Not found", { status: 404 });
	}

	return new Response(`${line}\n`, {
		headers: {
			"Content-Type": "text/plain; charset=utf-8",
			"Cache-Control": "public, max-age=3600, s-maxage=3600",
		},
	});
}
