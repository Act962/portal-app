import type { MetadataRoute } from "next";
import { loadSiteSettings } from "@/data/queries";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";

/**
 * `/manifest.webmanifest` (spec 07, A16).
 *
 * O ganho aqui não é "virar app": é o leitor que salva o portal na tela inicial
 * do celular — comportamento comum em veículo local — abrir num ícone e num
 * nome do veículo em vez de num atalho genérico do navegador. Nome, cores e
 * ícone saem das Configurações, como tudo o mais da identidade (D7 da 05b).
 */
export default async function manifest(): Promise<MetadataRoute.Manifest> {
	const [site, settings] = await Promise.all([
		loadSiteIdentity(),
		loadSiteSettings(),
	]);

	return {
		name: site.name,
		short_name: site.shortName,
		description: site.description,
		start_url: "/",
		display: "standalone",
		background_color: "#faf9f7",
		theme_color: "#011c39",
		lang: site.locale,
		categories: ["news", "magazines"],
		icons: [
			{
				src: settings.faviconUrl ?? "/brand/favicon.ico",
				sizes: "any",
			},
		],
	};
}
