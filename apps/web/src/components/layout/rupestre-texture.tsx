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
 * **Onde pode ficar é uma questão de contraste, não de gosto.** E sobre a
 * placa vermelha #ff0009 a questão ficou mais dura: aquela superfície já tem
 * um TETO de 4,00:1 (o branco puro), e a textura, sendo branca, CLAREIA o
 * fundo — ou seja, come a pouca folga que existe:
 *
 * | alfa da textura | fundo efetivo | branco por cima |
 * |-----------------|---------------|-----------------|
 * | 0% (placa nua)  | `#ff0009`     |         4,00:1  |
 * | 10%             | `#ff1a22`     |         3,88:1  |
 * | 20% (o de antes)| `#ff333a`     |         3,63:1  |
 * | 35%             | `#ff595f`     |         3,06:1  |
 *
 * **Por que 10% e não os 20% de antes.** No vinho, 20% ainda deixava branco a
 * 8,0:1 e `on-brand-soft` a 5,8:1 — havia folga de sobra para gastar. No
 * vermelho não há: 20% derrubaria o branco para 3,63:1, e nenhum tom da escala
 * `on-brand` sobreviveria por perto. 10% é o alfa em que a textura ainda se vê
 * e o branco fica em 3,88:1, o mais perto do teto que dá para chegar tendo
 * textura. Acima disso, a textura passa a custar legibilidade que a placa não
 * tem para dar.
 *
 * Ou seja: a textura fica na MARGEM do bloco — sangrando pela borda, no
 * respiro que o padding já reserva — e não atrás de corpo de texto. Onde ela
 * inevitavelmente encosta em texto, o texto é branco. Cada chamada posiciona a
 * sua pelo `className`, porque só quem conhece a geometria do bloco sabe onde
 * está o espaço vazio.
 *
 * Decorativa e nada mais: `aria-hidden`, `-z-10` e sem evento de ponteiro.
 */

/** Ver a tabela acima: cada ponto de alfa sai do contraste do branco. */
const OPACITY = "opacity-10";

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
