"use client";

import { Container } from "@portal-app/ui/components/container";
import { cn } from "@portal-app/ui/lib/utils";
import { Search } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

import type { Section } from "@/data/types";
import { routes } from "@/lib/routes";

/**
 * Section rail. Client-side only because the active item is derived from the
 * current path — the route group layout cannot read route params itself.
 *
 * Light band with navy type on mobile, navy band with white type on desktop.
 */
export function MainNav({ sections }: { sections: Section[] }) {
	const pathname = usePathname();

	return (
		<nav
			aria-label="Editorias"
			className="sticky top-0 z-20 border-hairline border-b bg-surface md:border-b-0 md:bg-brand-navy"
		>
			<Container className="flex items-stretch gap-4 md:gap-6">
				<ul className="rail flex min-w-0 flex-1 items-stretch gap-4 md:gap-6">
					{[{ slug: "ultimas", name: "Últimas" }, ...sections].map(
						(section) => {
							const href =
								section.slug === "ultimas"
									? routes.latest
									: routes.section(section.slug);
							const isActive = pathname === href;

							return (
								<li key={section.slug} className="flex">
									<Link
										href={href}
										aria-current={isActive ? "page" : undefined}
										className={cn(
											// A borda inferior já mudava de cor no hover; o que faltava
											// era a transição — sem ela a marca vermelha PISCA para
											// dentro e para fora a cada passada do mouse pela barra.
											"flex items-center whitespace-nowrap border-b-[3px] pt-2.5 pb-2 font-bold text-[12.5px] text-brand-navy uppercase tracking-[0.04em] transition-colors duration-200 hover:border-brand-red hover:text-brand-red md:py-3.5 md:text-[13px] md:text-white md:tracking-[0.06em] md:hover:text-brand-red-soft",
											isActive ? "border-brand-red" : "border-transparent",
										)}
									>
										{section.name}
									</Link>
								</li>
							);
						},
					)}
				</ul>

				<Link
					href={routes.search}
					className="hidden shrink-0 items-center gap-2 text-on-navy-muted hover:text-white md:flex"
				>
					<Search size={15} aria-hidden />
					<span className="font-mono text-[11px] tracking-[0.1em]">BUSCAR</span>
				</Link>
			</Container>
		</nav>
	);
}
