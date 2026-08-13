"use client";

import type { Link as SiteLinkData } from "@portal-app/settings";
import {
	Sheet,
	SheetContent,
	SheetTitle,
	SheetTrigger,
} from "@portal-app/ui/components/sheet";
import { Menu, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

import { SiteLink } from "@/components/layout/site-link";
import type { Section } from "@/data/types";
import { routes } from "@/lib/routes";

/**
 * A navegação do portal, num painel lateral.
 *
 * Substituiu a rota `/menu`, que era uma página inteira só para listar links.
 * O painel abre por cima da matéria que o leitor já está lendo — ele escolhe
 * para onde ir sem perder o lugar, e fechar não custa uma volta no histórico.
 *
 * É um Client Component por um motivo que não dá para contornar — abrir e
 * fechar é estado do navegador —, mas o custo para no componente: os dados
 * chegam prontos por prop, do `SiteHeader`, e nenhuma consulta atravessa para
 * o cliente. Na moldura ele acompanha o `AnchorAd`, que já era cliente pelo
 * mesmo tipo de razão (o leitor fecha o banner).
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

export function SiteMenu({
	sections,
	institutional,
}: {
	sections: Section[];
	institutional: readonly SiteLinkData[];
}) {
	const [open, setOpen] = useState(false);

	// Fechar no clique é explícito, e não um efeito que observa a rota: o
	// painel precisa sumir mesmo quando o leitor clica no link da página em que
	// já está — caso em que a rota não muda e um efeito não dispararia.
	const close = () => setOpen(false);

	return (
		<Sheet open={open} onOpenChange={setOpen}>
			<SheetTrigger
				className="flex w-fit items-center gap-2.5 py-2 pr-3 font-semibold text-[13px] text-white uppercase tracking-[0.12em] transition-colors hover:text-on-brand-muted md:gap-3 md:text-sm"
				aria-label="Abrir o menu"
			>
				<Menu size={22} aria-hidden />
				Menu
			</SheetTrigger>

			<SheetContent
				side="left"
				showCloseButton={false}
				// Sem largura aqui: o `SheetContent` já traz `w-3/4` e `sm:max-w-sm`
				// atrás de `data-[side=left]`, e um `w-*` solto não conflita com eles
				// para o tailwind-merge — ficaria escrito e sem efeito.
				className="gap-0 overflow-y-auto border-on-brand-rule bg-brand-deep p-5 text-white"
			>
				<div className="mb-5 flex items-center justify-between gap-3">
					<SheetTitle className="font-mono text-[10px] text-on-brand-muted uppercase tracking-[0.16em]">
						Navegação
					</SheetTitle>

					{/* O botão padrão do `SheetContent` é um `Button` do painel, que
					    sobre o marrom fica quase invisível — daí o próprio, com os
					    44px de alvo que a WCAG 2.5.8 pede. */}
					<button
						type="button"
						onClick={close}
						aria-label="Fechar o menu"
						className="-mr-2 flex size-11 shrink-0 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10"
					>
						<X size={20} aria-hidden />
					</button>
				</div>

				<nav aria-label="Principal">
					<ul className="mb-6 flex flex-col">
						{PRIMARY_NAV.map((item) => (
							<li key={item.href}>
								<Link href={item.href} onClick={close} className={ITEM}>
									{item.label}
									<span aria-hidden className="text-on-brand-muted">
										→
									</span>
								</Link>
							</li>
						))}
					</ul>
				</nav>

				{sections.length > 0 ? (
					<nav aria-label="Editorias">
						<h3 className={EYEBROW}>EDITORIAS</h3>
						<ul className="mb-6 grid grid-cols-2 gap-x-4">
							{sections.map((section) => (
								<li key={section.slug}>
									<Link
										href={routes.section(section.slug)}
										onClick={close}
										className={ITEM}
									>
										{section.name}
									</Link>
								</li>
							))}
						</ul>
					</nav>
				) : null}

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
