import { cn } from "@portal-app/ui/lib/utils";
import Image from "next/image";

/**
 * Os grafismos rupestres da marca, como textura de fundo dos blocos da placa.
 *
 * É a referência ao Parque Nacional de Sete Cidades que dá nome ao veículo. A
 * arte veio na pasta de identidade junto com uma faixa (`barra_rupestre.png`)
 * que já era, em essência, este uso: os desenhos correndo na borda de uma
 * superfície da cor institucional.
 *
 * **Onde pode ficar é uma questão de contraste, não de gosto.** A 20% sobre o
 * `brand-deep` vinho, o fundo efetivo vira ~`#893538`, e aí:
 *
 * | texto por cima      | contraste | serve? |
 * |---------------------|-----------|--------|
 * | branco              |    8,0:1  | sim    |
 * | `on-brand-soft`     |    5,8:1  | sim    |
 * | `on-brand-muted`    |    4,3:1  | NÃO    |
 * | `on-brand-dim`      |    2,9:1  | NÃO    |
 *
 * **Por que 20% e não os 35% de antes.** A arte de 21/08/2026 recolore o
 * grafismo de dourado (#785823) para BRANCO, mantendo o mesmo alfa. Branco
 * clareia a placa MUITO mais rápido: a 35% o fundo efetivo ia a `#904144`,
 * derrubando o branco para 4,9:1 e o `on-brand-soft` para 3,0:1 — os dois
 * abaixo do que esta tabela promete. 20% é o ponto que devolve as garantias
 * que a textura dourada dava a 35%.
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
const OPACITY = "opacity-20";

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
