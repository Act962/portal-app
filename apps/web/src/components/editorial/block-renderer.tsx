import type { Block } from "@portal-app/editorial";

/**
 * Renderizador próprio dos blocos do corpo (D1). É o que o PREVIEW usa agora e o
 * que o portal público vai reusar na Fase 4 — o público nunca carrega o editor,
 * só este renderizador. Imagens são resolvidas por `imageUrls` (mediaId → URL).
 */
export function BlockRenderer({
	blocks,
	imageUrls = {},
}: {
	blocks: readonly Block[];
	imageUrls?: Record<string, string>;
}) {
	return (
		<div className="prose max-w-none">
			{blocks.map((block, index) => (
				<BlockView key={index} block={block} imageUrls={imageUrls} />
			))}
		</div>
	);
}

function BlockView({ block, imageUrls }: { block: Block; imageUrls: Record<string, string> }) {
	switch (block.type) {
		case "paragraph":
			return <p className="my-3 leading-relaxed">{block.text}</p>;
		case "heading":
			return block.level === 2 ? (
				<h2 className="mt-6 mb-2 font-bold text-xl">{block.text}</h2>
			) : (
				<h3 className="mt-5 mb-2 font-bold text-lg">{block.text}</h3>
			);
		case "image": {
			const url = imageUrls[block.mediaId];
			return (
				<figure className="my-4">
					{url ? (
						<img src={url} alt={block.caption ?? ""} className="w-full rounded" />
					) : (
						<div className="rounded border border-dashed p-4 text-ink-muted text-sm">
							[imagem {block.mediaId}]
						</div>
					)}
					{block.caption ? (
						<figcaption className="mt-1 text-ink-muted text-sm">{block.caption}</figcaption>
					) : null}
				</figure>
			);
		}
		case "list":
			return block.ordered ? (
				<ol className="my-3 list-decimal pl-6">
					{block.items.map((item, i) => (
						<li key={i}>{item}</li>
					))}
				</ol>
			) : (
				<ul className="my-3 list-disc pl-6">
					{block.items.map((item, i) => (
						<li key={i}>{item}</li>
					))}
				</ul>
			);
		case "quote":
			return (
				<blockquote className="my-4 border-brand-red border-l-4 pl-4 italic">
					{block.text}
					{block.cite ? <cite className="mt-1 block text-ink-muted text-sm">— {block.cite}</cite> : null}
				</blockquote>
			);
		case "embed":
			return (
				<p className="my-3">
					<a href={block.url} className="text-brand-red underline" target="_blank" rel="noreferrer">
						{block.url}
					</a>
				</p>
			);
	}
}
