import { cn } from "@portal-app/ui/lib/utils";
import Image from "next/image";

/**
 * A marca no cabeçalho: o símbolo do "7" seguido da assinatura "Portal
 * Cidades", em branco sobre o marrom.
 *
 * **Por que o símbolo vem de um arquivo e a assinatura é texto.** A arte
 * entregue pelo cliente (`logo-7-cidades.png`) é o lockup EMPILHADO — símbolo
 * em cima, "Portal Cidades" embaixo, num quadrado. Num cabeçalho de 80px ele
 * caberia com 80px de largura, e a assinatura ficaria com ~10px de altura:
 * ilegível. O mockup pede o arranjo HORIZONTAL, que não veio na pasta. Até a
 * arte horizontal em branco chegar, o símbolo sai do arquivo oficial
 * (`icon-512.png`, só o "7") e a assinatura é composta em Montserrat — a
 * família geométrica que o design system já carrega, e a mais próxima do
 * desenho arredondado do original.
 *
 * Quando a arte definitiva chegar ela substitui este componente inteiro: vira
 * um `<Image>` no lugar do bloco de texto, num arquivo só.
 *
 * **Por que NÃO usa o logo das Configurações.** Aquele campo (D8) alimenta
 * schema.org, RSS, Open Graph e manifest — lugares onde o pedido é uma arte
 * QUADRADA, e onde a do cliente serve bem. O cabeçalho tem a exigência oposta:
 * horizontal, monocromática e legível numa altura fixa de 48px. Atender os dois
 * com o mesmo arquivo foi o que produziu o estado anterior — um quadrado de
 * 150×150 espremido em 48px, com a assinatura ilegível dentro dele.
 *
 * **O branco vem de filtro, não de um segundo arquivo.** `brightness-0 invert`
 * sobre um PNG transparente devolve branco puro preservando o antisserrilhado
 * das bordas — evita manter duas versões do mesmo símbolo em `public/`, que é
 * como versões de logo começam a divergir.
 *
 * E é por isso que o arquivo é `symbol.png`, e não o `icon-512.png` do
 * manifest: aquele é a arte CHAPADA sobre o marrom (ícone de tela inicial não
 * pode ser transparente), e o filtro a transformaria num quadrado branco.
 */

const SYMBOL = "/brand/symbol.png";

export function SiteLogo({ className }: { className?: string }) {
	return (
		<span className={cn("flex items-center gap-2.5 md:gap-3", className)}>
			<Image
				src={SYMBOL}
				alt=""
				width={128}
				height={128}
				priority
				className="block h-9 w-auto shrink-0 brightness-0 invert md:h-12"
			/>

			<span className="flex flex-col font-heading text-white leading-none">
				<span className="font-semibold text-[11px] tracking-[0.18em] md:text-[13px]">
					PORTAL
				</span>
				<span className="font-extrabold text-[19px] tracking-[-0.02em] md:text-[26px]">
					Cidades
				</span>
			</span>
		</span>
	);
}
