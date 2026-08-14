"use client";

import type { Link as SiteLinkData } from "@portal-app/settings";
import {
	Sheet,
	SheetContent,
	SheetTitle,
} from "@portal-app/ui/components/sheet";
import { X } from "lucide-react";
import Link from "next/link";

import { RupestreTexture } from "@/components/layout/rupestre-texture";
import { SiteLink } from "@/components/layout/site-link";
import type { Section } from "@/data/types";
import { routes } from "@/lib/routes";

/**
 * O conteúdo do menu lateral — tudo que depende do Base UI.
 *
 * Vive num arquivo separado de `site-menu.tsx` por peso, não por organização:
 * o diálogo do Base UI (portal, armadilha de foco, trava de rolagem) custava
 * **43 KB comprimidos em TODA página pública**, medido contra a `main`. Aqui
 * ele é carregado sob demanda, e o botão que abre o menu fica com alguns bytes.
 *
 * Sem `SheetTrigger`: o gatilho mora no outro arquivo, para não arrastar este
 * pacote junto. A contrapartida é que a devolução do foco ao fechar passou a
 * ser explícita lá — o `Trigger` era quem fazia isso de graça.
 */

/** Os destinos que não são editoria e não vêm do banco (P11). */
const PRIMARY_NAV = [
	{ label: "Início", href: routes.home },
	{ label: "Últimas notícias", href: routes.latest },
	{ label: "Colunistas", href: routes.columnists },
	{ label: "Enquetes", href: routes.polls },
	{ label: "Busca", href: routes.search },
] as const;

const EYEBROW =
	"mb-2 font-mono text-[9px] text-on-brand-muted tracking-[0.16em]";

const ITEM =
	"flex min-h-11 items-center justify-between gap-3 border-on-brand-rule/50 border-t py-2.5 font-semibold text-[15px] text-white transition-colors hover:text-on-brand-soft";

export default function SiteMenuPanel({
	sections,
	institutional,
	onOpenChange,
}: {
	sections: Section[];
	institutional: readonly SiteLinkData[];
	onOpenChange: (open: boolean) => void;
}) {
	// Fechar no clique é explícito, e não um efeito que observa a rota: o painel
	// precisa sumir mesmo quando o leitor clica no link da página em que já
	// está — caso em que a rota não muda e um efeito não dispararia.
	const fechar = () => onOpenChange(false);

	return (
		<Sheet open onOpenChange={onOpenChange}>
			<SheetContent
				side="left"
				showCloseButton={false}
				// Sem largura aqui: o `SheetContent` já traz `w-3/4` e `sm:max-w-sm`
				// atrás de `data-[side=left]`, e um `w-*` solto não conflita com eles
				// para o tailwind-merge — ficaria escrito e sem efeito.
				className="gap-0 overflow-y-auto border-on-brand-rule bg-brand-deep p-5 text-white"
			>
				{/*
				  No pé do painel, ancorada na viewport (`fixed`, não `absolute`):
				  dentro de um contêiner que rola, `absolute` a prenderia ao fim do
				  CONTEÚDO e ela subiria junto com a rolagem.
				*/}
				<RupestreTexture
					className="fixed bottom-0 left-0 h-12 translate-y-3"
					sizes="300px"
				/>

				<div className="mb-5 flex items-center justify-between gap-3">
					{/* "Menu", e não mais "Navegação": este é o nome acessível do
					    diálogo, e o rótulo "NAVEGAÇÃO" agora pertence a um bloco
					    específico lá embaixo. Também é a palavra escrita no botão que
					    abre o painel — o leitor de tela anuncia o mesmo nome que ele
					    acabou de acionar. */}
					<SheetTitle className="font-mono text-[10px] text-on-brand-muted uppercase tracking-[0.16em]">
						Menu
					</SheetTitle>

					{/* O botão padrão do `SheetContent` é um `Button` do painel, que
					    sobre o marrom fica quase invisível — daí o próprio, com os
					    44px de alvo que a WCAG 2.5.8 pede. */}
					<button
						type="button"
						onClick={fechar}
						aria-label="Fechar o menu"
						className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
					>
						<X size={20} aria-hidden />
					</button>
				</div>

				{/*
				  As EDITORIAS vêm primeiro, antes dos destinos fixos: são o conteúdo
				  do portal, e o que a maioria vem procurar ao abrir o menu. "Início"
				  e "Busca" já têm atalho no cabeçalho — a marca e a lupa —, então
				  gastar o topo da lista com eles empurrava para baixo a única coisa
				  que só existe aqui.
				*/}
				{sections.length > 0 ? (
					<nav aria-label="Editorias">
						<h3 className={EYEBROW}>EDITORIAS</h3>
						<ul className="mb-6 grid grid-cols-2 gap-x-4">
							{sections.map((section) => (
								<li key={section.slug}>
									<Link
										href={routes.section(section.slug)}
										onClick={fechar}
										className={ITEM}
									>
										{section.name}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				) : null}

				{/*
				  Ganhou rótulo próprio ao descer: no topo ele era dispensável, porque
				  o título do painel logo acima já dizia o que a lista era. Solto entre
				  "EDITORIAS" e "SERVIÇOS", um bloco sem nome pareceria continuação do
				  anterior.
				*/}
				<nav aria-label="Principal">
					<h3 className={EYEBROW}>NAVEGAÇÃO</h3>
					<ul className="mb-6 flex flex-col">
						{PRIMARY_NAV.map((item) => (
							<li key={item.href}>
								<Link href={item.href} onClick={fechar} className={ITEM}>
									{item.label}
									<span aria-hidden className="text-on-brand-muted">
										→
									</span>
								</Link>
							</li>
						))}
					</ul>
				</nav>

				{institutional.length > 0 ? (
					<nav aria-label="Serviços">
						<h3 className={EYEBROW}>SERVIÇOS</h3>
						<ul className="flex flex-col">
							{institutional.map((item) => (
								<li key={item.label}>
									{/* Sem destino cadastrado o rótulo vira texto inerte, não
									    um clique morto (D9) — por isso `SiteLink`, e não um
									    `<Link>` cru. */}
									<SiteLink link={item} className={ITEM} />
								</li>
							))}
						</ul>
					</nav>
				) : null}
			</SheetContent>
		</Sheet>
	);
}
