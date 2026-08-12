import { Container } from "@portal-app/ui/components/container";
import Image from "next/image";
import Link from "next/link";

import { SiteLink } from "@/components/layout/site-link";
import { siteConfig } from "@/config/site";
import { loadSiteSettings } from "@/data/queries";
import type { Section } from "@/data/types";
import { routes } from "@/lib/routes";

const HEADING =
	"mb-2.5 font-mono text-[9px] tracking-[0.16em] text-white md:text-[9.5px]";
const LINK = "text-on-navy-muted hover:text-white";

export async function SiteFooter({ sections }: { sections: Section[] }) {
	const site = await loadSiteSettings();

	// Só as linhas preenchidas: um rótulo "WhatsApp ·" sem número ao lado é pior
	// do que a ausência da linha.
	const contact = [
		site.contactNewsroom ? `Redação · ${site.contactNewsroom}` : null,
		site.contactWhatsapp ? `WhatsApp · ${site.contactWhatsapp}` : null,
		site.contactEmail,
		site.contactAddress,
	].filter((line): line is string => Boolean(line));

	return (
		<footer className="mt-stack bg-brand-navy text-on-navy-muted md:mt-major">
			<Container className="grid grid-cols-2 gap-x-5 gap-y-6 py-6 md:gap-8 md:py-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
				<div className="col-span-2 lg:col-span-1">
					<div className="mb-3 flex items-center gap-2.5 md:gap-3">
						<Image
							src={site.logoUrl ?? siteConfig.logo}
							alt=""
							width={44}
							height={44}
							unoptimized
							className="block size-8 rounded-lg md:size-11 md:rounded-[10px]"
						/>
						<span className="font-extrabold text-sm text-white uppercase md:text-[17px]">
							{site.name}
						</span>
					</div>
					{/* A frase final é copy de rodapé, não identidade: o modelo não tem
					    campo para ela e inventar um agora custaria outra migration.
					    Registrado em pendencias.md. */}
					<p className="max-w-[38ch] font-serif text-[13px] leading-relaxed md:text-sm">
						{site.radioFrequency ? `${site.radioFrequency} · ` : ""}
						{site.city} — {site.state}. Notícias do Piauí 24 horas no ar, em
						todo lugar.
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
						{site.institutional.map((item) => (
							<li key={item.label}>
								<SiteLink link={item} className={LINK} />
							</li>
						))}

						{/*
						  Privacidade e Termos ficam FORA da lista configurável, e de
						  propósito. As duas páginas são rotas estáticas do código, então o
						  link para elas também é do código: entrando por
						  `site.institutional` eles poderiam ser apagados ou reapontados
						  para um endereço errado pela tela de Configurações — e são
						  justamente as duas que precisam estar sempre alcançáveis.
						  Também é o que os faz aparecer em produção sem depender de
						  alguém editar a linha de configuração que já existe lá.
						*/}
						<li>
							<Link href={routes.privacy} className={LINK}>
								Política de Privacidade
							</Link>
						</li>
						<li>
							<Link href={routes.terms} className={LINK}>
								Termos de Uso
							</Link>
						</li>
					</ul>
				</nav>

				<div className="col-span-2 lg:col-span-1">
					<h2 className={HEADING}>CONTATO</h2>
					<ul className="flex flex-col gap-1.5 text-[12.5px] md:text-[13.5px]">
						{contact.map((line) => (
							<li key={line}>{line}</li>
						))}
					</ul>
				</div>
			</Container>

			<div className="border-white/15 border-t">
				<Container className="flex flex-wrap justify-between gap-2 py-3.5 font-mono text-[9.5px] text-on-navy-dim tracking-[0.08em] md:text-[10px]">
					<span>
						© {new Date().getFullYear()} {site.name.toUpperCase()} · TODOS OS
						DIREITOS RESERVADOS
					</span>
					{/*
					  Estas três eram uma STRING de configuração — "PRINCÍPIOS EDITORIAIS
					  · PRIVACIDADE · TERMOS DE USO" — impressa como texto solto, sem
					  link nenhum. O leitor lia "Privacidade" no rodapé e não tinha como
					  chegar lá. Agora as duas que existem são links; o campo `legal`
					  segue disponível para a linha de razão social, que é o que ele
					  deveria ter sido desde o início.
					*/}
					<span className="flex flex-wrap items-center gap-x-2 gap-y-1">
						<Link href={routes.privacy} className={LINK}>
							PRIVACIDADE
						</Link>
						<span aria-hidden className="text-on-navy-rule">
							·
						</span>
						<Link href={routes.terms} className={LINK}>
							TERMOS DE USO
						</Link>
						{site.legal ? (
							<span className="hidden md:inline">· {site.legal}</span>
						) : null}
					</span>
				</Container>
			</div>
		</footer>
	);
}
