import { AdSlot } from "@portal-app/ui/components/ad-slot";
import type { Route } from "next";
import Link from "next/link";
import { Fragment } from "react";

import type { ArticleBlock, InlineNode } from "@/data/types";

/**
 * Renders the block document that makes up an article body.
 *
 * This is the pay-off of storing content as blocks rather than HTML
 * (docs/stack.md, Decisão 5): the same array can be rendered here for the web,
 * and by a different renderer for the newsletter or a partner feed, without
 * the newsroom re-authoring anything.
 */

function inlineKey(node: InlineNode): string {
	return `${node.kind}:${node.text}`;
}

function blockKey(block: ArticleBlock): string {
	const sample =
		block.kind === "paragraph"
			? block.content.map((node) => node.text).join("")
			: block.text;

	return `${block.kind}:${sample.slice(0, 48)}`;
}

function InlineContent({ nodes }: { nodes: InlineNode[] }) {
	return nodes.map((node) => {
		if (node.kind === "strong") {
			return (
				<strong key={inlineKey(node)} className="font-semibold">
					{node.text}
				</strong>
			);
		}

		if (node.kind === "link") {
			return (
				<Link
					key={inlineKey(node)}
					href={node.href as Route}
					className="text-brand-red underline-offset-2 hover:underline"
				>
					{node.text}
				</Link>
			);
		}

		return <Fragment key={inlineKey(node)}>{node.text}</Fragment>;
	});
}

function Block({ block }: { block: ArticleBlock }) {
	if (block.kind === "subheading") {
		return (
			<h2 className="font-extrabold font-sans text-brand-navy text-xl leading-tight tracking-[-0.02em] md:text-2xl">
				{block.text}
			</h2>
		);
	}

	if (block.kind === "quote") {
		return (
			<blockquote className="border-brand-red border-l-[3px] py-0.5 pl-3.5 text-[19px] text-brand-navy italic leading-[1.35] md:border-l-4 md:py-1 md:pl-5 md:text-2xl">
				<p>“{block.text}”</p>
				{block.attribution ? (
					<cite className="mt-2 block font-sans font-semibold text-meta text-xs uppercase not-italic tracking-[0.1em]">
						{block.attribution}
					</cite>
				) : null}
			</blockquote>
		);
	}

	return (
		<p>
			<InlineContent nodes={block.content} />
		</p>
	);
}

type ArticleBodyProps = {
	blocks: ArticleBlock[];
	/** Index after which an in-content ad is inserted. Omit for no ad. */
	adAfterBlock?: number;
};

export function ArticleBody({ blocks, adAfterBlock }: ArticleBodyProps) {
	return (
		<div className="flex max-w-reading flex-col gap-4 pt-4.5 font-serif text-[16.5px] text-ink leading-[1.65] md:gap-5 md:pt-stack md:text-[18.5px] md:leading-[1.68]">
			{blocks.map((block, index) => (
				<Fragment key={blockKey(block)}>
					<Block block={block} />
					{adAfterBlock === index ? <AdSlot format="in-content" /> : null}
				</Fragment>
			))}
		</div>
	);
}
