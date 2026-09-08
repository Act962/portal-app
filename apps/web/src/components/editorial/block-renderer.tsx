import type {
	Block,
	BlockAlign,
	BlockLineHeight,
	InlineMark,
	InlineNode,
} from "@portal-app/editorial";
import { cn } from "@portal-app/ui/lib/utils";
import { Fragment } from "react";

/**
 * Renderizador próprio dos blocos do corpo (D1). É o que o PREVIEW do editor
 * usa; o portal público tem o seu (o público nunca carrega o editor). Imagens
 * são resolvidas por `imageUrls` (mediaId → URL).
 */
export function BlockRenderer({
	blocks,
	imageUrls = {},
}: {
	blocks: readonly Block[];
	imageUrls?: Record<string, string>;
}) {
	return (
		<div className="prose dark:prose-invert max-w-none">
			{blocks.map((block, index) => (
				<BlockView
					key={`${block.type}:${index}`}
					block={block}
					imageUrls={imageUrls}
				/>
			))}
		</div>
	);
}

/**
 * Formatação inline (ADR 0010, revisto em 08/09).
 *
 * As marcas são um CONJUNTO: um trecho pode ser negrito **e** sublinhado. Vira
 * um encadeamento de elementos, do mais externo para o mais interno, e não uma
 * pilha de `if`s exclusivos — era esse `if/else` que fazia "negrito e
 * sublinhado" render só um dos dois.
 */
const MARK_TAG = {
	strong: "strong",
	em: "em",
	underline: "u",
	strike: "s",
} as const satisfies Record<InlineMark, string>;

function withMarks(
	text: React.ReactNode,
	marks: readonly InlineMark[] | undefined,
): React.ReactNode {
	// `reduceRight`: a primeira marca da lista termina como o elemento de FORA,
	// que é a ordem em que a barra as apresenta.
	return (marks ?? []).reduceRight<React.ReactNode>((inner, mark) => {
		const Tag = MARK_TAG[mark];
		return <Tag>{inner}</Tag>;
	}, text);
}

function Inline({ nodes }: { nodes: readonly InlineNode[] }) {
	return nodes.map((node, index) => {
		const key = `${node.type}:${index}`;
		const content = withMarks(node.text, node.marks);

		if (node.type === "link") {
			return (
				<a
					key={key}
					href={node.href}
					target="_blank"
					rel="noreferrer"
					className="text-brand-accent-ink underline"
				>
					{content}
				</a>
			);
		}
		return <Fragment key={key}>{content}</Fragment>;
	});
}

function BlockView({
	block,
	imageUrls,
}: {
	block: Block;
	imageUrls: Record<string, string>;
}) {
	switch (block.type) {
		case "paragraph":
			return (
				<p
					className={cn(
						"my-3 leading-relaxed",
						alignClass(block.align),
						lineHeightClass(block.lineHeight),
					)}
				>
					<Inline nodes={block.content} />
				</p>
			);
		case "heading":
			return block.level === 2 ? (
				<h2
					className={cn("mt-6 mb-2 font-bold text-xl", alignClass(block.align))}
				>
					<Inline nodes={block.content} />
				</h2>
			) : (
				<h3
					className={cn("mt-5 mb-2 font-bold text-lg", alignClass(block.align))}
				>
					<Inline nodes={block.content} />
				</h3>
			);
		case "image": {
			const url = imageUrls[block.mediaId];
			return (
				<figure className="my-4">
					{url ? (
						<img
							src={url}
							alt={block.caption ?? ""}
							className="w-full rounded"
						/>
					) : (
						<div className="rounded border border-dashed p-4 text-muted-foreground text-sm">
							[imagem {block.mediaId}]
						</div>
					)}
					{block.caption ? (
						<figcaption className="mt-1 text-muted-foreground text-sm">
							{block.caption}
						</figcaption>
					) : null}
				</figure>
			);
		}
		case "list": {
			const items = block.items.map((item, index) => (
				<li key={`item:${index}`}>
					<Inline nodes={item} />
				</li>
			));
			return block.ordered ? (
				<ol className="my-3 list-decimal pl-6">{items}</ol>
			) : (
				<ul className="my-3 list-disc pl-6">{items}</ul>
			);
		}
		case "quote":
			return (
				<blockquote className="my-4 border-brand-accent-ink border-l-4 pl-4 italic">
					<Inline nodes={block.content} />
					{block.cite ? (
						<cite className="mt-1 block text-muted-foreground text-sm">
							— {block.cite}
						</cite>
					) : null}
				</blockquote>
			);
		case "embed":
			return (
				<p className="my-3">
					<a
						href={block.url}
						className="text-brand-accent-ink underline"
						target="_blank"
						rel="noreferrer"
					>
						{block.url}
					</a>
				</p>
			);
	}
}

/**
 * O alinhamento como classe. Sem `align` a classe some — herdar do contêiner é
 * exatamente o que "alinhado à esquerda" significa num portal em português, e
 * uma classe `text-left` explícita atrapalharia um dia em que o contêiner
 * mudasse.
 */
function alignClass(align: BlockAlign | undefined): string | undefined {
	if (align === "center") {
		return "text-center";
	}
	if (align === "right") {
		return "text-right";
	}
	return align === "justify" ? "text-justify" : undefined;
}

/** Mapa literal pela mesma razão do renderizador do portal: classe montada por
 * interpolação não é gerada pelo Tailwind. */
const LINE_HEIGHT_CLASS: Record<BlockLineHeight, string> = {
	"1.15": "leading-[1.15]",
	"1.5": "leading-[1.5]",
	"2": "leading-[2]",
};

function lineHeightClass(
	lineHeight: BlockLineHeight | undefined,
): string | undefined {
	return lineHeight ? LINE_HEIGHT_CLASS[lineHeight] : undefined;
}
