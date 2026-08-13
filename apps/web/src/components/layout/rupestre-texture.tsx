import { cn } from "@portal-app/ui/lib/utils";
import Image from "next/image";

/**
 * Os grafismos rupestres da marca, como textura de fundo dos blocos marrons.
 *
 * É a referência ao Parque Nacional de Sete Cidades que dá nome ao veículo. A
 * arte veio na pasta de identidade junto com uma faixa (`barra_rupestre.png`)
 * que já era, em essência, este uso: os desenhos correndo na borda de uma
 * superfície marrom.
 *
 * **Onde pode ficar é uma questão de contraste, não de gosto.** A 35% sobre o
 * `brand-deep`, o fundo efetivo vira ~`#69503b`, e aí:
 *
 * | texto por cima      | contraste | serve? |
 * |---------------------|-----------|--------|
 * | branco              |    7,5:1  | sim    |
 * | `on-brand-soft`     |    4,6:1  | sim    |
 * | `on-brand-muted`    |    3,4:1  | NÃO    |
 * | `on-brand-dim`      |    2,3:1  | NÃO    |
 *
 * Ou seja: a textura fica na MARGEM do bloco — sangrando pela borda, no
 * respiro que o padding já reserva — e não atrás de corpo de texto. Onde ela
 * inevitavelmente encosta em texto, o texto é branco. Cada chamada posiciona a
 * sua pelo `className`, porque só quem conhece a geometria do bloco sabe onde
 * está o espaço vazio.
 *
 * Decorativa e nada mais: `aria-hidden`, `-z-10` e sem evento de ponteiro.
 */

/** Acima disto, `on-brand-soft` também começa a reprovar. */
const OPACITY = "opacity-35";

export function RupestreTexture({
	className,
	sizes = "310px",
}: {
	className?: string;
	/**
	 * Sem isto o Next serve a variante de 1920px para uma faixa desenhada com
	 * 310 — mais peso do que o PNG inteiro tem. Cada bloco informa a largura
	 * com que realmente desenha.
	 */
	sizes?: string;
}) {
	return (
		<Image
			src="/brand/rupestre.png"
			alt=""
			aria-hidden
			width={900}
			height={186}
			sizes={sizes}
			className={cn(
				"pointer-events-none absolute -z-10 w-auto select-none",
				OPACITY,
				className,
			)}
		/>
	);
}
