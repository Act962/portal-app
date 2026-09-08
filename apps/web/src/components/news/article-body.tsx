import { cn } from "@portal-app/ui/lib/utils";
import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";

import type {
	ArticleBlock,
	BlockAlign,
	InlineMark,
	InlineNode,
} from "@/data/types";

/**
 * Renders the block document that makes up an article body.
 *
 * This is the pay-off of storing content as blocks rather than HTML
 * (docs/stack.md, Decisão 5): the same array can be rendered here for the web,
 * and by a different renderer for the newsletter or a partner feed, without
 * the newsroom re-authoring anything.
 */

/** O índice entra na chave porque dois trechos idênticos no mesmo parágrafo
 * deixaram de ser exceção depois que o texto ganhou formatação inline. */
function inlineKey(node: InlineNode, index: number): string {
	return `${node.kind}:${index}:${node.text}`;
}

function blockKey(block: ArticleBlock, index: number): string {
	return `${block.kind}:${index}`;
}

/**
 * A marca do domínio e o elemento que a representa no HTML publicado.
 *
 * `<u>` e `<s>` (e não `<span class="underline">`): o portal serve conteúdo
 * jornalístico, e o elemento certo é o que dá sentido ao trecho para um leitor
 * de tela, para o Google Notícias e para quem reaproveita o feed. A aparência
 * vem depois, e é a mesma.
 */
const MARK_TAG = {
	strong: "strong",
	em: "em",
	underline: "u",
	strike: "s",
} as const satisfies Record<InlineMark, string>;

/** Classe própria por marca, onde o padrão do navegador não serve à tipografia
 * do portal. Vazio quando o elemento sozinho já dá conta. */
const MARK_CLASS: Partial<Record<InlineMark, string>> = {
	strong: "font-semibold",
	// O sublinhado do navegador corta as descidas do "g" e do "p" na serifada
	// do corpo; afastá-lo devolve a linha inteira.
	underline: "underline underline-offset-2",
};

/**
 * Aninha as marcas de um trecho, da primeira (mais externa) à última.
 *
 * Era uma cadeia de `if`s exclusivos, um por marca — o que fazia um trecho
 * negrito E sublinhado sair só negrito. As marcas são um CONJUNTO desde 08/09,
 * e aqui elas se compõem.
 */
function withMarks(
	text: React.ReactNode,
	marks: readonly InlineMark[] | undefined,
): React.ReactNode {
	return (marks ?? []).reduceRight<React.ReactNode>((inner, mark) => {
		const Tag = MARK_TAG[mark];
		return <Tag className={MARK_CLASS[mark]}>{inner}</Tag>;
	}, text);
}

function InlineContent({ nodes }: { nodes: InlineNode[] }) {
	return nodes.map((node, index) => {
		const key = inlineKey(node, index);
		const content = withMarks(node.text, node.marks);

		if (node.kind === "link") {
			// Link externo é âncora, não `next/link`: prefetch de um domínio de
			// fora não faz sentido e a URL absoluta não é uma rota tipada.
			return /^https?:\/\//.test(node.href) ? (
				<a
					key={key}
					href={node.href}
					target="_blank"
					rel="noreferrer"
					className="text-brand-accent-ink underline-offset-2 hover:underline"
				>
					{content}
				</a>
			) : (
				<Link
					key={key}
					href={node.href as Route}
					className="text-brand-accent-ink underline-offset-2 hover:underline"
				>
					{content}
				</Link>
			);
		}

		return <Fragment key={key}>{content}</Fragment>;
	});
}

/**
 * O alinhamento como classe.
 *
 * Sem `align` nenhuma classe é emitida: herdar do contêiner é o que "alinhado
 * à esquerda" significa aqui, e o corpo da matéria já é uma coluna estreita
 * alinhada à esquerda.
 */
function alignClass(align: BlockAlign | undefined): string | undefined {
	if (align === "center") {
		return "text-center";
	}
	if (align === "right") {
		return "text-right";
	}
	// `hyphens-auto` acompanha o justificado, e não é enfeite: numa coluna de
	// leitura estreita, justificar sem hifenização abre rios de espaço em
	// branco entre as palavras — o defeito clássico do texto justificado na
	// web. O `lang="pt-BR"` do documento é o que dá ao navegador o dicionário.
	return align === "justify" ? "text-justify hyphens-auto" : undefined;
}

function Block({ block }: { block: ArticleBlock }) {
	if (block.kind === "subheading") {
		return (
			<h2
				className={cn(
					"font-extrabold font-sans text-brand-ink text-xl leading-tight tracking-[-0.02em] md:text-2xl",
					alignClass(block.align),
				)}
			>
				<InlineContent nodes={block.content} />
			</h2>
		);
	}

	if (block.kind === "quote") {
		return (
			<blockquote className="border-brand-accent-ink border-l-[3px] py-0.5 pl-3.5 text-[19px] text-brand-ink italic leading-[1.35] md:border-l-4 md:py-1 md:pl-5 md:text-2xl">
				<p>
					“<InlineContent nodes={block.content} />”
				</p>
				{block.attribution ? (
					<cite className="mt-2 block font-sans font-semibold text-meta text-xs uppercase not-italic tracking-[0.1em]">
						{block.attribution}
					</cite>
				) : null}
			</blockquote>
		);
	}

	if (block.kind === "image") {
		return (
			<figure className="-mx-4 my-1 md:mx-0">
				{/* biome-ignore lint/a11y/useAltText: alt aplicado via prop */}
				<img
					src={block.url}
					alt={block.alt}
					className="w-full md:rounded-card"
				/>
				{block.caption ? (
					<figcaption className="px-4 pt-1.5 font-mono text-[9.5px] text-meta leading-relaxed md:px-0 md:text-[10px]">
						{block.caption}
					</figcaption>
				) : null}
			</figure>
		);
	}

	if (block.kind === "list") {
		const items = block.items.map((item, index) => (
			// biome-ignore lint/suspicious/noArrayIndexKey: a ordem É a identidade do item
			<li key={index}>
				<InlineContent nodes={item} />
			</li>
		));
		return block.ordered ? (
			<ol className="list-decimal pl-6">{items}</ol>
		) : (
			<ul className="list-disc pl-6">{items}</ul>
		);
	}

	return (
		<p className={cn(alignClass(block.align))}>
			<InlineContent nodes={block.content} />
		</p>
	);
}

type ArticleBodyProps = {
	blocks: ArticleBlock[];
	/** Index after which an in-content ad is inserted. Omit for no ad. */
	adAfterBlock?: number;
	/**
	 * O anúncio, pronto, vindo de quem chama.
	 *
	 * Chega como `ReactNode` em vez de este componente montar o `AdPlacement`
	 * sozinho porque a veiculação precisa saber a EDITORIA da página (campanha
	 * segmentada não aparece fora do que foi vendido), e o corpo da matéria não
	 * conhece nem quer conhecer isso — ele recebe blocos e os desenha. Assim ele
	 * também segue renderizável sem banco, que é o que o mantém testável.
	 */
	ad?: React.ReactNode;
};

export function ArticleBody({ blocks, adAfterBlock, ad }: ArticleBodyProps) {
	return (
		<div className="flex max-w-reading flex-col gap-4 pt-4.5 font-serif text-[16.5px] text-ink leading-[1.65] md:gap-5 md:pt-stack md:text-[18.5px] md:leading-[1.68]">
			{blocks.map((block, index) => (
				<Fragment key={blockKey(block, index)}>
					<Block block={block} />
					{adAfterBlock === index ? ad : null}
				</Fragment>
			))}
		</div>
	);
}
