import { Container } from "@portal-app/ui/components/container";
import type { Metadata } from "next";
import Link from "next/link";

import { SectionGrid } from "@/components/news/section-grid";
import { siteConfig } from "@/config/site";
import { getSections } from "@/data/queries";
import { routes } from "@/lib/routes";

/** Navegação principal do portal, exposta por completo no menu (P11). */
const PRIMARY_NAV = [
	{ label: "Início", href: routes.home },
	{ label: "Últimas notícias", href: routes.latest },
	{ label: "Ao vivo", href: routes.live },
	{ label: "Busca", href: routes.search },
] as const;

export const metadata: Metadata = {
	title: "Menu",
	description: "Todas as editorias e serviços da Rádio 7 Cidades.",
	alternates: { canonical: routes.menu },
	robots: { index: false, follow: true },
};

const EYEBROW =
	"mb-3 font-mono text-[9px] tracking-[0.16em] text-on-navy-muted";

/**
 * Full-screen navigation, reached from the masthead on small screens.
 *
 * A route rather than a JavaScript drawer: it is linkable, it restores with
 * the back button, and it works before hydration.
 */
export default async function MenuPage() {
	const sections = await getSections();
	return (
		<div className="bg-brand-navy">
			<Container className="py-5 pb-8">
				<h1 className={EYEBROW}>NAVEGAÇÃO</h1>
				<ul className="mb-6 flex flex-col">
					{PRIMARY_NAV.map((item) => (
						<li key={item.href} className="border-white/15 border-t">
							<Link
								href={item.href}
								className="flex min-h-11 items-center justify-between gap-3 py-3 font-semibold text-[15px] text-white hover:text-white"
							>
								{item.label}
								<span aria-hidden className="text-on-navy-muted">
									→
								</span>
							</Link>
						</li>
					))}
				</ul>

				<h2 className={EYEBROW}>EDITORIAS</h2>
				<SectionGrid
					sections={sections}
					tone="dark"
					showCounts={false}
					className="mb-6"
				/>

				<h2 className={EYEBROW}>SERVIÇOS</h2>
				<ul className="flex flex-col">
					{siteConfig.institutional.map((item) => (
						<li key={item} className="border-white/15 border-t">
							<a
								href="#institucional"
								className="flex min-h-11 items-center justify-between gap-3 py-3 font-semibold text-[15px] text-white hover:text-white"
							>
								{item}
								<span aria-hidden className="text-on-navy-muted">
									→
								</span>
							</a>
						</li>
					))}
				</ul>
			</Container>
		</div>
	);
}
