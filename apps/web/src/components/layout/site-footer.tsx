import { Container } from "@portal-app/ui/components/container";
import Link from "next/link";

import { RupestreTexture } from "@/components/layout/rupestre-texture";
import { SiteLink } from "@/components/layout/site-link";
import { SiteLogo } from "@/components/layout/site-logo";
import { loadSiteSettings } from "@/data/queries";
import type { Section } from "@/data/types";
import { routes } from "@/lib/routes";

const HEADING =
	"mb-2.5 font-mono text-[9px] tracking-[0.16em] text-white md:text-[9.5px]";
const LINK = "text-on-brand-muted hover:text-white";

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
		<footer className="mt-stack bg-brand-deep text-on-brand-muted md:mt-major">
			<Container className="grid grid-cols-2 gap-x-5 gap-y-6 py-6 md:gap-8 md:py-10 lg:grid-cols-[1.4fr_1fr_1fr_1fr]">
				<div className="col-span-2 lg:col-span-1">
					{/*
					  A MESMA marca do cabeçalho, e não o logo quadrado das Configurações
					  (D8): aquele arquivo existe para schema.org, RSS, Open Graph e
					  manifest, onde o pedido é uma arte quadrada. Aqui, como no topo, o
					  arranjo é horizontal sobre a placa — e as duas pontas da página
					  mostrando desenhos diferentes da marca era exatamente o problema.
					*/}
					{/* Com `alt`, ao contrário do cabeçalho: lá a marca mora dentro do
					    link para a home, que já se anuncia; aqui ela está sozinha, e sem
					    isto o rodapé abriria sem dizer de quem é o site. */}
					<SiteLogo className="mb-3" priority={false} alt={site.name} />
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

			{/*
			  A textura fica NESTA faixa, e não no corpo do rodapé acima: lá o texto
			  é `on-brand-muted`, que sobre o grafismo cai para 3,4:1. Aqui ela
			  ocupa o vão central — o copyright fica à esquerda, a razão social à
			  direita — e é o uso que a própria marca sugere no `barra_rupestre.png`:
			  os desenhos correndo numa tira. Só de `md` para cima, onde esse vão
			  existe; no celular as duas pontas se encontram.
			*/}
			<div className="relative overflow-hidden border-white/15 border-t">
				{/*
				  Mais alta que a faixa (56px contra ~46px), e por isso cortada em
				  cima e embaixo pelo `overflow-hidden` do pai. É de propósito: o
				  corte é o que a faz ler como uma TIRA que atravessa o rodapé, e não
				  como um carimbo solto no meio dele.
				*/}
				<RupestreTexture
					className="top-1/2 left-1/2 hidden h-14 -translate-x-1/2 -translate-y-1/2 md:block"
					sizes="280px"
				/>
				<Container className="flex flex-wrap justify-between gap-2 py-3.5 font-mono text-[9.5px] text-on-brand-dim tracking-[0.08em] md:text-[10px]">
					<span>
						© {new Date().getFullYear()} {site.name.toUpperCase()} · TODOS OS
						DIREITOS RESERVADOS
					</span>
					{/*
					  Privacidade e Termos NÃO ficam aqui — estão em "Institucional",
					  logo acima, e repeti-los a 200px de distância era ruído.
					  Esta faixa trazia "PRINCÍPIOS EDITORIAIS · PRIVACIDADE · TERMOS DE
					  USO" como uma STRING de configuração, impressa sem link nenhum: o
					  leitor lia "Privacidade" e não tinha como chegar lá. Sobrou o campo
					  `legal` para a linha de razão social, que é o que ele deveria ter
					  sido desde o início.
					*/}
					{site.legal ? (
						<span className="hidden md:inline">{site.legal}</span>
					) : null}
				</Container>
			</div>
		</footer>
	);
}
