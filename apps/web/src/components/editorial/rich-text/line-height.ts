import {
	BLOCK_LINE_HEIGHTS,
	type BlockLineHeight,
} from "@portal-app/editorial";
import { Extension } from "@tiptap/core";

/**
 * Espaçamento entre linhas, por BLOCO (pedido da redação, 08/09).
 *
 * **Por que não a extensão oficial.** O TipTap tem uma `LineHeight`, dentro de
 * `@tiptap/extension-text-style`, e ela não serve aqui: guarda o valor no MARK
 * `textStyle`, isto é, num trecho de texto. São duas coisas erradas de uma vez.
 * A primeira é de modelo — o nosso `InlineNode` carrega marcas booleanas de um
 * conjunto fechado (negrito, itálico, sublinhado, riscado) e não tem onde pôr
 * um valor; espaçamento é propriedade de parágrafo, como o alinhamento, e é
 * assim que o domínio o guarda. A segunda é de CSS: `line-height` num `<span>`
 * no meio da linha não muda de forma confiável a entrelinha do parágrafo — o
 * navegador usa a altura do bloco. Selecionar meia frase e "abrir o
 * espaçamento" daria um resultado que ninguém pediu.
 *
 * Então esta é a mesma receita que o TipTap documenta para o `TextAlign`:
 * `addGlobalAttributes` pendurando um atributo nos nós de bloco. Trinta linhas,
 * nenhuma dependência nova, e o valor cai exatamente onde `Block` o espera.
 *
 * O que sai daqui é `attrs.lineHeight`; quem o converte para o domínio é
 * `serialize.ts`, como faz com o `textAlign`.
 */

declare module "@tiptap/core" {
	interface Commands<ReturnType> {
		portalLineHeight: {
			setLineHeight: (value: BlockLineHeight) => ReturnType;
			unsetLineHeight: () => ReturnType;
		};
	}
}

/** Os blocos que aceitam espaçamento — os mesmos que aceitam alinhamento, e
 * pela mesma razão: são os únicos em que `Block` tem onde guardar. */
const TYPES = ["paragraph", "heading"] as const;

/**
 * Roda a operação nos dois tipos de bloco e diz se ALGUM aceitou.
 *
 * O `.some` no fim é o detalhe que custou caro. `updateAttributes` devolve
 * `false` para um tipo que não está na seleção — com o cursor num título, a
 * chamada para `paragraph` reprova. Escrito com `.every()` (que é como se
 * escreve por instinto, e como a documentação do TextAlign sugere), o comando
 * inteiro devolvia `false`, e um comando que reprova ABORTA a chain: nada era
 * despachado, sem erro nenhum no console. O menu abria, o clique chegava, o
 * comando rodava, e a tela não mudava.
 *
 * `map` antes do `some`, e não `some` direto: `some` para no primeiro `true` e
 * deixaria o segundo tipo sem aplicar numa seleção que abrange título E
 * parágrafo.
 */
function applyToBlocks(run: (type: string) => boolean): boolean {
	return TYPES.map((type) => run(type)).some(Boolean);
}

export const LineHeight = Extension.create({
	name: "portalLineHeight",

	addGlobalAttributes() {
		return [
			{
				types: [...TYPES],
				attributes: {
					lineHeight: {
						// `null`, e não "1": ausente significa "o espaçamento do
						// portal". Um default concreto carimbaria o atributo em todo
						// parágrafo que ninguém tocou e engordaria o corpo salvo.
						default: null,
						parseHTML: (element) => element.style.lineHeight || null,
						renderHTML: (attributes) =>
							attributes.lineHeight
								? { style: `line-height: ${attributes.lineHeight}` }
								: {},
					},
				},
			},
		];
	},

	addCommands() {
		return {
			setLineHeight:
				(value: BlockLineHeight) =>
				({ commands }) => {
					// Recusa valor fora da lista em vez de gravá-lo: o domínio o
					// descartaria depois, e o texto voltaria diferente do que a tela
					// mostrou — a classe de defeito que este editor já teve.
					if (!BLOCK_LINE_HEIGHTS.includes(value)) {
						return false;
					}
					return applyToBlocks((type) =>
						commands.updateAttributes(type, { lineHeight: value }),
					);
				},

			unsetLineHeight:
				() =>
				({ commands }) =>
					applyToBlocks((type) => commands.resetAttributes(type, "lineHeight")),
		};
	},
});
