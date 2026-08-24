import type { Block, InlineNode } from "@portal-app/editorial";
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

/** Formatação inline (ADR 0010): negrito, itálico e link dentro do texto. */
function Inline({ nodes }: { nodes: readonly InlineNode[] }) {
	return nodes.map((node, index) => {
		const key = `${node.type}:${index}`;
		if (node.type === "strong") {
			return <strong key={key}>{node.text}</strong>;
		}
		if (node.type === "em") {
			return <em key={key}>{node.text}</em>;
		}
		if (node.type === "link") {
			return (
				<a
					key={key}
					href={node.href}
					target="_blank"
					rel="noreferrer"
					className="text-brand-accent-ink underline"
				>
					{node.text}
				</a>
			);
		}
		return <Fragment key={key}>{node.text}</Fragment>;
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
				<p className="my-3 leading-relaxed">
					<Inline nodes={block.content} />
				</p>
			);
		case "heading":
			return block.level === 2 ? (
				<h2 className="mt-6 mb-2 font-bold text-xl">
					<Inline nodes={block.content} />
				</h2>
			) : (
				<h3 className="mt-5 mb-2 font-bold text-lg">
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
