import { Container } from "@portal-app/ui/components/container";
import Image from "next/image";
import Link from "next/link";

import { siteConfig } from "@/config/site";
import type { Section } from "@/data/types";
import { routes } from "@/lib/routes";

const HEADING =
	"mb-2.5 font-mono text-[9px] tracking-[0.16em] text-white md:text-[9.5px]";
const LINK = "text-on-navy-muted hover:text-white";

export function SiteFooter({ sections }: { sections: Section[] }) {
	return (
		<footer className="mt-stack bg-brand-navy text-on-navy-muted md:mt-major">
			<Container className="grid grid-cols-2 gap-x-5 gap-y-6 py-6 md:gap-8 md:py-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
				<div className="col-span-2 lg:col-span-1">
					<div className="mb-3 flex items-center gap-2.5 md:gap-3">
						<Image
							src={siteConfig.logo}
							alt=""
							width={44}
							height={44}
							unoptimized
							className="block size-8 rounded-lg md:size-11 md:rounded-[10px]"
						/>
						<span className="font-extrabold text-sm text-white uppercase md:text-[17px]">
							{siteConfig.name}
						</span>
					</div>
					<p className="max-w-[38ch] font-serif text-[13px] leading-relaxed md:text-sm">
						{siteConfig.radio.frequency} · {siteConfig.city} —{" "}
						{siteConfig.state}. Notícias do Piauí 24 horas no ar, em todo lugar.
					</p>
				</div>

				<nav aria-label="Editorias no rodapé">
					<h2 className={HEADING}>EDITORIAS</h2>
					<ul className="flex flex-col gap-1.5 text-[12.5px] md:text-[13.5px]">
						{sections.slice(0, 6).map((section) => (
							<li key={section.slug}>
								<Link href={routes.section(section.slug)} className={LINK}>
									{section.name}
								</Link>
							</li>
						))}
					</ul>
				</nav>

				<nav aria-label="Institucional">
					<h2 className={HEADING}>INSTITUCIONAL</h2>
					<ul className="flex flex-col gap-1.5 text-[12.5px] md:text-[13.5px]">
						{siteConfig.institutional.map((item) => (
							<li key={item}>
								<a href="#institucional" className={LINK}>
									{item}
								</a>
							</li>
						))}
					</ul>
				</nav>

				<div className="col-span-2 lg:col-span-1">
					<h2 className={HEADING}>CONTATO</h2>
					<ul className="flex flex-col gap-1.5 text-[12.5px] md:text-[13.5px]">
						<li>Redação · {siteConfig.contact.newsroom}</li>
						<li>WhatsApp · {siteConfig.contact.whatsapp}</li>
						<li>{siteConfig.contact.email}</li>
						<li>{siteConfig.contact.address}</li>
					</ul>
				</div>
			</Container>

			<div className="border-white/15 border-t">
				<Container className="flex flex-wrap justify-between gap-2 py-3.5 font-mono text-[9.5px] text-on-navy-dim tracking-[0.08em] md:text-[10px]">
					<span>
						© {new Date().getFullYear()} {siteConfig.name.toUpperCase()} · TODOS
						OS DIREITOS RESERVADOS
					</span>
					<span className="hidden md:inline">{siteConfig.legal}</span>
				</Container>
			</div>
		</footer>
	);
}
