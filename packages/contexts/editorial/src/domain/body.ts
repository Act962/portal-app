import { err, ok, type Result, ValueObject } from "@portal-app/shared-kernel";

import { InvalidBlock } from "./errors";

/**
 * As marcas que podem cobrir um trecho de texto.
 *
 * Lista fechada, e a ordem é a da barra do editor — é ela que a interface e o
 * renderizador percorrem, então declarar aqui evita que as duas discordem.
 */
export const INLINE_MARKS = ["strong", "em", "underline", "strike"] as const;

export type InlineMark = (typeof INLINE_MARKS)[number];

/**
 * Nós inline — a formatação DENTRO de um texto (ADR 0010, revisto em 08/09).
 *
 * **As marcas agora são um CONJUNTO, não uma escolha.** O modelo original era
 * uma união plana (`{type:"strong"}`, `{type:"em"}`, …), em que cada trecho
 * carregava UMA marca, e o serializador achatava o resto por precedência. Isso
 * se sustentava com duas marcas; com sublinhado e riscado na barra, deixou de
 * se sustentar: "negrito **e** sublinhado" é o pedido mais comum da redação, e
 * a união plana devolveria só um dos dois — texto salvo que volta diferente do
 * que se escreveu, que é a pior classe de defeito num editor.
 *
 * Restam dois tipos, porque `link` é a única coisa que carrega DESTINO além de
 * aparência. Um link também aceita marcas: negrito dentro de link é normal.
 *
 * O formato antigo continua sendo LIDO (`normalizeInline` o converte na porta
 * de entrada) — há conteúdo gravado assim, e ele não vai ser migrado: a
 * conversão na leitura custa menos que uma migração de dados e não tem como
 * falhar pela metade.
 */
export type InlineNode =
	| { type: "text"; text: string; marks?: InlineMark[] }
	| { type: "link"; text: string; href: string; marks?: InlineMark[] };

/**
 * Alinhamento de um bloco de texto.
 *
 * `left` não é representado: é o padrão de um portal em português, e gravá-lo
 * encheria o JSON de `"align":"left"` em todo parágrafo — ruído que o
 * renderizador teria de ignorar de qualquer forma. Ausente significa esquerda.
 */
export const BLOCK_ALIGNMENTS = ["center", "right", "justify"] as const;

export type BlockAlign = (typeof BLOCK_ALIGNMENTS)[number];

/**
 * Espaçamento entre linhas de um bloco de texto (pedido da redação, 08/09 —
 * "como no Google Docs").
 *
 * **Ausente = o espaçamento do portal**, e não "1,0". No Docs a primeira opção
 * é "Simples", que é a entrelinha natural da fonte; aqui o corpo da matéria é
 * desenhado em 1,65 por conforto de leitura, e oferecer um "simples" que
 * apertasse o texto para 1,0 seria dar à redação um botão para estragar a
 * tipografia do veículo sem perceber. O padrão continua sendo o do portal; o
 * que se escolhe aqui é para ABRIR o texto, que é o que se pede na prática.
 *
 * Lista fechada, e guardada como string: o valor vira `line-height` no CSS, e
 * um número solto convidaria a gravar `1.4999999`. Os três valores são os do
 * Docs — 1,15, 1,5 e duplo.
 */
export const BLOCK_LINE_HEIGHTS = ["1.15", "1.5", "2"] as const;

export type BlockLineHeight = (typeof BLOCK_LINE_HEIGHTS)[number];

/**
 * Blocos do corpo (D1/ADR 0003, estendido pelo ADR 0010). União discriminada por
 * `type`, validada no domínio: o corpo é dado estruturado, não HTML —
 * renderização controlada e segura (sem `dangerouslySetInnerHTML`), e novos
 * blocos entram sem migração.
 */
export type Block =
	| {
			type: "paragraph";
			content: InlineNode[];
			align?: BlockAlign;
			lineHeight?: BlockLineHeight;
	  }
	| {
			type: "heading";
			level: 2 | 3;
			content: InlineNode[];
			align?: BlockAlign;
			lineHeight?: BlockLineHeight;
	  }
	| { type: "image"; mediaId: string; caption?: string }
	| { type: "list"; ordered: boolean; items: InlineNode[][] }
	| { type: "quote"; content: InlineNode[]; cite?: string }
	| { type: "embed"; url: string };

/**
 * O que é ACEITO na entrada. Além do formato atual, tolera o formato anterior ao
 * ADR 0010 (`text: string` no lugar de `content`, `items: string[]` na lista),
 * porque há conteúdo gravado assim. A normalização converte na porta de entrada;
 * de dentro para fora só existe o formato novo.
 */
/**
 * Um nó inline como a ESCRITA o aceita: o formato de hoje **ou** o anterior a
 * 08/09, em que a marca era o tipo do nó.
 *
 * O legado precisa estar aqui, e não só tolerado na normalização: o painel
 * carrega o corpo inteiro da matéria, inclusive o gravado no formato antigo, e
 * o devolve no autosave seguinte. Um tipo que só aceitasse o formato novo
 * recusaria o salvamento de toda matéria anterior a esta data.
 */
export type InlineNodeInput =
	| InlineNode
	| { type: "strong"; text: string }
	| { type: "em"; text: string };

export type InlineInput = readonly InlineNodeInput[] | string;

export type BlockInput =
	| {
			type: "paragraph";
			content: InlineInput;
			align?: BlockAlign;
			lineHeight?: BlockLineHeight;
	  }
	| {
			type: "paragraph";
			text: string;
			align?: BlockAlign;
			lineHeight?: BlockLineHeight;
	  }
	| {
			type: "heading";
			level: 2 | 3;
			content: InlineInput;
			align?: BlockAlign;
			lineHeight?: BlockLineHeight;
	  }
	| {
			type: "heading";
			level: 2 | 3;
			text: string;
			align?: BlockAlign;
			lineHeight?: BlockLineHeight;
	  }
	| { type: "quote"; content: InlineInput; cite?: string }
	| { type: "quote"; text: string; cite?: string }
	| { type: "image"; mediaId: string; caption?: string }
	| { type: "list"; ordered: boolean; items: readonly InlineInput[] }
	| { type: "embed"; url: string };

/**
 * Corpo da matéria — lista ordenada de blocos. Objeto de valor imutável.
 *
 * Duas portas, com semânticas deliberadamente diferentes:
 * - `create` (escrita) normaliza **e valida**: erro é erro.
 * - `fromRaw` (leitura) normaliza e descarta o irrecuperável, **nunca falha** —
 *   o portal público serve este conteúdo e não pode explodir por formato velho.
 *
 * Corpo vazio é permitido no rascunho; a publicação é que exige corpo
 * (invariante do agregado).
 */
export class Body extends ValueObject<{ blocks: readonly Block[] }> {
	private constructor(blocks: readonly Block[]) {
		super({ blocks });
	}

	static empty(): Body {
		return new Body([]);
	}

	static create(blocks: readonly BlockInput[]): Result<Body, InvalidBlock> {
		const normalized: Block[] = [];
		for (const input of blocks) {
			const block = normalizeBlock(input);
			if (!block) {
				return err(new InvalidBlock("bloco de tipo desconhecido"));
			}
			const problem = validate(block);
			if (problem) {
				return err(new InvalidBlock(problem));
			}
			normalized.push(block);
		}
		return ok(new Body(normalized));
	}

	/** Reidrata da persistência. Blocos irrecuperáveis são descartados em
	 * silêncio — uma matéria com um bloco corrompido ainda deve ser lida. */
	static fromRaw(raw: unknown): Body {
		if (!Array.isArray(raw)) {
			return Body.empty();
		}
		const blocks: Block[] = [];
		for (const input of raw) {
			const block = normalizeBlock(input as BlockInput);
			if (block && !validate(block)) {
				blocks.push(block);
			}
		}
		return new Body(blocks);
	}

	get blocks(): readonly Block[] {
		return this.props.blocks;
	}

	isEmpty(): boolean {
		return this.props.blocks.length === 0;
	}

	/** O texto corrido do corpo — para contagem de palavras, resumo e busca. */
	plainText(): string {
		return this.props.blocks.map(blockText).filter(Boolean).join(" ");
	}
}

// --- Normalização ----------------------------------------------------------

/** Converte a entrada (nova ou legada) num bloco canônico. `null` = tipo
 * desconhecido, que a escrita rejeita e a leitura descarta. */
function normalizeBlock(input: BlockInput | undefined | null): Block | null {
	if (!input || typeof input !== "object" || !("type" in input)) {
		return null;
	}

	switch (input.type) {
		case "paragraph":
			return {
				type: "paragraph",
				content: normalizeInline(contentOf(input)),
				...alignOf(input),
				...lineHeightOf(input),
			};
		case "heading":
			return {
				type: "heading",
				level: (input as { level: 2 | 3 }).level,
				content: normalizeInline(contentOf(input)),
				...alignOf(input),
				...lineHeightOf(input),
			};
		case "quote": {
			const cite = (input as { cite?: string }).cite;
			return {
				type: "quote",
				content: normalizeInline(contentOf(input)),
				...(cite ? { cite } : {}),
			};
		}
		case "image": {
			const { mediaId, caption } = input as {
				mediaId: string;
				caption?: string;
			};
			return {
				type: "image",
				mediaId: typeof mediaId === "string" ? mediaId : "",
				...(caption ? { caption } : {}),
			};
		}
		case "list": {
			const { ordered, items } = input as {
				ordered: boolean;
				items: readonly InlineInput[];
			};
			return {
				type: "list",
				ordered: Boolean(ordered),
				items: (Array.isArray(items) ? items : []).map((item) =>
					normalizeInline(item),
				),
			};
		}
		case "embed": {
			const { url } = input as { url: string };
			return { type: "embed", url: typeof url === "string" ? url : "" };
		}
		default:
			return null;
	}
}

/**
 * Extrai o conteúdo inline, aceitando `content` (novo) ou `text` (legado).
 *
 * `content` como STRING também entra. Ela sempre esteve no tipo (`InlineInput =
 * readonly InlineNode[] | string`) e no schema do tRPC, mas caía no `[]` daqui
 * — um parágrafo enviado assim virava "parágrafo sem texto" e derrubava o
 * salvamento inteiro com uma mensagem que não descrevia o problema.
 */
function contentOf(input: object): string | readonly unknown[] {
	if ("content" in input) {
		if (Array.isArray(input.content)) {
			return input.content;
		}
		if (typeof input.content === "string") {
			return input.content;
		}
	}
	if ("text" in input && typeof input.text === "string") {
		return input.text;
	}
	return [];
}

/** Uma string vira um único nó de texto; um array é filtrado nó a nó. */
function normalizeInline(value: string | readonly unknown[]): InlineNode[] {
	if (typeof value === "string") {
		return value ? [{ type: "text", text: value }] : [];
	}
	if (!Array.isArray(value)) {
		return [];
	}

	const nodes: InlineNode[] = [];
	for (const raw of value) {
		if (typeof raw === "string") {
			if (raw) {
				nodes.push({ type: "text", text: raw });
			}
			continue;
		}
		if (!raw || typeof raw !== "object") {
			continue;
		}
		const node = raw as {
			type?: string;
			text?: unknown;
			href?: unknown;
			marks?: unknown;
		};
		if (typeof node.text !== "string" || !node.text) {
			continue;
		}

		const marks = normalizeMarks(node.marks);

		if (node.type === "link") {
			// Link sem destino não é link — degrada para texto em vez de sumir.
			nodes.push(
				typeof node.href === "string" && node.href
					? { type: "link", text: node.text, href: node.href, ...marks }
					: { type: "text", text: node.text, ...marks },
			);
			continue;
		}

		// Formato anterior a 08/09: a marca era o TIPO do nó. Vira uma marca do
		// conjunto, e o conteúdo antigo passa a se comportar como o novo sem
		// migração de dados.
		if (node.type === "strong" || node.type === "em") {
			nodes.push({
				type: "text",
				text: node.text,
				marks: dedupe([node.type, ...(marks.marks ?? [])]),
			});
			continue;
		}

		nodes.push({ type: "text", text: node.text, ...marks });
	}
	return nodes;
}

/**
 * As marcas de um nó, saneadas.
 *
 * Devolve `{}` — e não `{ marks: [] }` — quando não há nenhuma: um array vazio
 * em todo trecho de texto engordaria o JSON do corpo sem dizer nada, e faria
 * duas gravações do MESMO texto compararem como diferentes.
 *
 * Marca desconhecida é descartada em silêncio: quem escreve o JSON é o editor,
 * e um nome fora da lista é sinal de conteúdo colado de outro lugar, não de
 * intenção editorial.
 */
function normalizeMarks(raw: unknown): { marks?: InlineMark[] } {
	if (!Array.isArray(raw)) {
		return {};
	}
	const marks = dedupe(raw);
	return marks.length > 0 ? { marks } : {};
}

/** Sem repetição e na ordem canônica de `INLINE_MARKS` — assim o mesmo texto
 * com as mesmas marcas produz sempre o mesmo JSON. */
function dedupe(raw: readonly unknown[]): InlineMark[] {
	return INLINE_MARKS.filter((mark) => raw.includes(mark));
}

/**
 * O espaçamento de um bloco, quando declarado e reconhecido.
 *
 * Valor fora da lista é DESCARTADO em silêncio, e não corrigido para o mais
 * próximo: quem escreve este JSON é o editor, e um número que não está na lista
 * é sinal de conteúdo vindo de outro lugar. O bloco cai no espaçamento do
 * portal, que é sempre legível.
 */
function lineHeightOf(input: object): { lineHeight?: BlockLineHeight } {
	if (!("lineHeight" in input)) {
		return {};
	}
	const value = (input as { lineHeight?: unknown }).lineHeight;
	return BLOCK_LINE_HEIGHTS.includes(value as BlockLineHeight)
		? { lineHeight: value as BlockLineHeight }
		: {};
}

/** O alinhamento de um bloco, quando declarado e reconhecido. */
function alignOf(input: object): { align?: BlockAlign } {
	if (!("align" in input)) {
		return {};
	}
	const align = (input as { align?: unknown }).align;
	return BLOCK_ALIGNMENTS.includes(align as BlockAlign)
		? { align: align as BlockAlign }
		: {};
}

// --- Validação -------------------------------------------------------------

function inlineText(nodes: readonly InlineNode[]): string {
	return nodes.map((node) => node.text).join("");
}

function blockText(block: Block): string {
	switch (block.type) {
		case "paragraph":
		case "heading":
		case "quote":
			return inlineText(block.content);
		case "list":
			return block.items.map(inlineText).join(" ");
		default:
			return "";
	}
}

/** Devolve a razão da invalidez, ou `null` se o bloco é válido. */
function validate(block: Block): string | null {
	switch (block.type) {
		case "paragraph":
			return inlineText(block.content).trim() ? null : "parágrafo sem texto";
		case "heading":
			if (block.level !== 2 && block.level !== 3) {
				return "título só aceita nível 2 ou 3";
			}
			return inlineText(block.content).trim() ? null : "título sem texto";
		case "image":
			return block.mediaId.trim() ? null : "imagem sem mídia";
		case "list":
			if (block.items.length === 0) {
				return "lista sem itens";
			}
			return block.items.every((item) => inlineText(item).trim() !== "")
				? null
				: "lista com item vazio";
		case "quote":
			return inlineText(block.content).trim() ? null : "citação sem texto";
		case "embed":
			return /^https?:\/\/.+/.test(block.url.trim())
				? null
				: "embed com URL inválida";
	}
}
