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
		theme_color: "#3a1f0e",
		lang: site.locale,
		categories: ["news", "magazines"],
		/*
		 * Quando o cliente cadastra um ícone nas Configurações ele responde
		 * sozinho — é a identidade dele. Sem cadastro, entram os PNGs da marca:
		 * o `.ico` sozinho não serve para a tela inicial do Android, que pede
		 * 192 e 512 e, sem elas, desenha um atalho genérico do navegador.
		 */
		icons: settings.faviconUrl
			? [{ src: settings.faviconUrl, sizes: "any" }]
			: [
					{ src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
					{ src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
				],
	};
}
