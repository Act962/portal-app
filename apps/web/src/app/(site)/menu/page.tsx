import { Container } from "@portal-app/ui/components/container";
import type { Metadata } from "next";

import { SectionGrid } from "@/components/news/section-grid";
import { siteConfig } from "@/config/site";
import { getSections } from "@/data/queries";
import { routes } from "@/lib/routes";

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
				<h1 className={EYEBROW}>EDITORIAS</h1>
				<SectionGrid sections={sections} tone="dark" showCounts={false} className="mb-6" />

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
