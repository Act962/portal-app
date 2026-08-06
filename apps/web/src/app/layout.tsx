import type { Metadata } from "next";

import "../index.css";
import { loadSiteSettings } from "@/data/queries";
import { fontVariables } from "@/lib/fonts";

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
		openGraph: {
			type: "website",
			locale: "pt_BR",
			siteName: site.name,
			url: site.url,
		},
		twitter: { card: "summary_large_image" },
		robots: {
			index: true,
			follow: true,
			// Large previews are effectively a requirement for Google Discover.
			"max-image-preview": "large",
		},
	};
}

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
