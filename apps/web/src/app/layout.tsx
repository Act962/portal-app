import type { Metadata } from "next";

import "../index.css";
import { siteConfig } from "@/config/site";
import { fontVariables } from "@/lib/fonts";

export const metadata: Metadata = {
	metadataBase: new URL(siteConfig.url),
	title: {
		default: `${siteConfig.name} — Notícias do Piauí`,
		template: `%s | ${siteConfig.name}`,
	},
	description: siteConfig.description,
	applicationName: siteConfig.name,
	alternates: {
		types: {
			"application/rss+xml": [
				{ url: "/rss.xml", title: `${siteConfig.name} — Últimas notícias` },
			],
		},
	},
	openGraph: {
		type: "website",
		locale: "pt_BR",
		siteName: siteConfig.name,
		url: siteConfig.url,
	},
	twitter: { card: "summary_large_image" },
	robots: {
		index: true,
		follow: true,
		// Large previews are effectively a requirement for Google Discover.
		"max-image-preview": "large",
	},
};

export default function RootLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return (
		// The font variables belong on <html>, not <body>: `--font-sans` is
		// declared at `:root`, so a `var(--font-archivo)` defined lower down
		// would be invalid at computed-value time and silently fall back to serif.
		<html lang="pt-BR" className={fontVariables} suppressHydrationWarning>
			<body className="antialiased">{children}</body>
		</html>
	);
}
