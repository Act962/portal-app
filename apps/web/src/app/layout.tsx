import { env } from "@portal-app/env/server";
import type { Metadata, Viewport } from "next";

import "../index.css";
import { loadSiteSettings } from "@/data/queries";
import { fontVariables } from "@/lib/fonts";
import { ogImageUrl } from "@/lib/seo/metadata";

/**
 * Metadata dinâmica (spec 05b): título, descrição e og:* saem do banco.
 *
 * Era um objeto estático, o que deixaria a aba do navegador com o nome antigo
 * depois de o cliente renomear o veículo nas configurações — o tipo de
 * inconsistência que ele nota no mesmo dia. `loadSiteSettings` é `cache()`, então
 * isto não custa uma consulta a mais por página.
 */
export async function generateMetadata(): Promise<Metadata> {
	const site = await loadSiteSettings();

	return {
		metadataBase: new URL(site.url),
		title: {
			default: `${site.name} — Notícias do Piauí`,
			template: `%s | ${site.name}`,
		},
		description: site.description,
		applicationName: site.name,
		alternates: {
			types: {
				"application/rss+xml": [
					{ url: "/rss.xml", title: `${site.name} — Últimas notícias` },
				],
			},
		},
		/*
		 * O Open Graph da RAIZ é só a rede de segurança do grupo `(app)` e de
		 * qualquer rota que ainda não passe por `pageMetadata` (spec 07, D2).
		 *
		 * Ele não serve às páginas do portal: o Next mescla metadata de forma
		 * RASA, então a página que declara o próprio `openGraph` substitui este
		 * objeto inteiro — `siteName` e `locale` sumiriam do HTML sem nada
		 * quebrar. Por isso `pageMetadata` monta o bloco completo em cada página,
		 * em vez de complementar daqui.
		 *
		 * Sem `url` aqui, e de propósito: herdado, ele fazia `/ultimas`,
		 * `/colunistas` e as demais anunciarem a HOME como sua URL social.
		 */
		openGraph: {
			type: "website",
			locale: "pt_BR",
			siteName: site.name,
			title: `${site.name} — Notícias do Piauí`,
			description: site.description,
			// A arte cadastrada nas Configurações quando existe; o cartão gerado
			// enquanto não existe. Mesma ordem que `pageMetadata` aplica ao portal.
			images: site.socialImage
				? [
						{
							url: site.socialImage.url,
							alt: site.socialImage.alt,
							...(site.socialImage.width && site.socialImage.height
								? {
										width: site.socialImage.width,
										height: site.socialImage.height,
									}
								: {}),
						},
					]
				: [
						{
							url: ogImageUrl({ title: site.name, eyebrow: site.shortName }),
							width: 1200,
							height: 630,
							alt: site.name,
						},
					],
		},
		twitter: { card: "summary_large_image" },
		// Verificação de propriedade no Search Console (D7). Sem a variável, nada
		// é emitido — dev, build e CI não dependem de conta em serviço nenhum.
		...(env.GOOGLE_SITE_VERIFICATION
			? { verification: { google: env.GOOGLE_SITE_VERIFICATION } }
			: {}),
		/*
		 * O ícone da aba, vindo das Configurações (item do cliente).
		 *
		 * Precisou sair do `app/favicon.ico`: aquele arquivo é uma CONVENÇÃO de
		 * arquivo do Next — ele o injeta sozinho no `<head>`, e não há como o
		 * banco sobrepô-lo; com os dois presentes, saíam duas tags `icon` e o
		 * navegador escolhia. O arquivo virou `public/brand/favicon.ico` e é o
		 * fallback explícito daqui, o que também mantém o portal com ícone quando
		 * o banco está fora do ar (`loadSiteSettings` degrada para os defaults).
		 */
		icons: site.faviconUrl
			? { icon: site.faviconUrl }
			: {
					icon: [
						{ url: "/brand/favicon.ico", sizes: "any" },
						{ url: "/brand/icon-192.png", type: "image/png", sizes: "192x192" },
					],
					apple: "/brand/apple-icon.png",
				},
		robots: {
			index: true,
			follow: true,
			// Large previews are effectively a requirement for Google Discover.
			"max-image-preview": "large",
		},
	};
}

/**
 * `theme-color` pinta a barra do navegador no Android e a moldura do app quando
 * o portal é salvo na tela inicial. Separado da metadata porque o Next exige o
 * export `viewport` para isto desde a 14.
 */
export const viewport: Viewport = {
	themeColor: "#6b0206",
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		// The font variables belong on <html>, not <body>: `--font-sans` is
		// declared at `:root`, so a `var(--font-nunito)` defined lower down
		// would be invalid at computed-value time and silently fall back to serif.
		<html lang="pt-BR" className={fontVariables} suppressHydrationWarning>
			<body className="antialiased">{children}</body>
		</html>
	);
}
