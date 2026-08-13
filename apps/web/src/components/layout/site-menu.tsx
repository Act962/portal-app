"use client";

import type { Link as SiteLinkData } from "@portal-app/settings";
import { Menu } from "lucide-react";
import dynamic from "next/dynamic";
import { useRef, useState } from "react";

import type { Section } from "@/data/types";

/**
 * O botão MENU do cabeçalho — e só ele.
 *
 * Substituiu a rota `/menu`, que era uma página inteira só para listar links.
 * O painel abre por cima da matéria que o leitor já está lendo: ele escolhe
 * para onde ir sem perder o lugar, e fechar não custa uma volta no histórico.
 *
 * **Por que o painel é carregado sob demanda.** Medido contra a `main`, com o
 * diálogo no pacote inicial a home saía de 190,8 KB para 234,2 KB comprimidos
 * — 43 KB a mais em TODA página pública, por um menu que a maior parte dos
 * leitores nunca abre. O orçamento do `ui-ux.md` §4 é 150 KB. Aqui sobra o
 * botão; o resto chega no primeiro contato.
 *
 * **E por que isso não custa espera.** O `preload` dispara no `pointerenter` e
 * no `pointerdown`, os dois ANTES do clique se completar: no desktop o pacote
 * já está em memória quando o dedo levanta, e no toque ele começa a baixar no
 * instante em que o dedo encosta. Sem isso, a primeira abertura pagaria uma
 * ida à rede — inaceitável para o que virou a única navegação do portal.
 */
const SiteMenuPanel = dynamic(
	() => import("@/components/layout/site-menu-panel"),
	// Painel fechado não tem o que renderizar no servidor, e é isso que mantém
	// o pacote fora do HTML inicial.
	{ ssr: false },
);

export function SiteMenu({
	sections,
	institutional,
}: {
	sections: Section[];
	institutional: readonly SiteLinkData[];
}) {
	const [open, setOpen] = useState(false);
	const botao = useRef<HTMLButtonElement>(null);

	// `preload` existe no componente que o `dynamic` devolve; a asserção é
	// porque a tipagem pública do `next/dynamic` não a expõe.
	const preload = () =>
		(SiteMenuPanel as unknown as { preload?: () => void }).preload?.();

	const aoMudar = (aberto: boolean) => {
		setOpen(aberto);
		// Sem o `SheetTrigger` do Base UI, a devolução do foco é nossa. Foco que
		// não volta deixa quem navega por teclado no início do documento, tendo
		// de reatravessar o cabeçalho inteiro (WCAG 2.4.3).
		if (!aberto) {
			botao.current?.focus();
		}
	};

	return (
		<>
			<button
				ref={botao}
				type="button"
				aria-label="Abrir o menu"
				aria-haspopup="dialog"
				aria-expanded={open}
				onPointerEnter={preload}
				onPointerDown={preload}
				onFocus={preload}
				onClick={() => setOpen(true)}
				className="flex w-fit items-center gap-2.5 py-2 pr-3 font-semibold text-[13px] text-white uppercase tracking-[0.12em] transition-colors hover:text-on-brand-muted md:gap-3 md:text-sm"
			>
				<Menu size={22} aria-hidden />
				Menu
			</button>

			{open ? (
				<SiteMenuPanel
					sections={sections}
					institutional={institutional}
					onOpenChange={aoMudar}
				/>
			) : null}
		</>
	);
}
