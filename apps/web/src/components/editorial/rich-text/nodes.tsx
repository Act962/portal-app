"use client";

import { Node } from "@tiptap/core";
import {
	type NodeViewProps,
	NodeViewWrapper,
	ReactNodeViewRenderer,
} from "@tiptap/react";
import { ImageOff, Link2, Trash2 } from "lucide-react";
import { createContext, useContext } from "react";

/**
 * Nós customizados do editor.
 *
 * A imagem NÃO guarda uma URL: guarda o `mediaId` do asset (ADR 0009/0003).
 * Trocar o storage, o recorte ou o CDN não reescreve o corpo das matérias. A URL
 * é resolvida na renderização, pelo contexto abaixo.
 */

type MediaInfo = { url: string; altText: string };

const MediaUrlContext = createContext<Record<string, MediaInfo>>({});

export function MediaUrlProvider({
	value,
	children,
}: {
	value: Record<string, MediaInfo>;
	children: React.ReactNode;
}) {
	return (
		<MediaUrlContext.Provider value={value}>
			{children}
		</MediaUrlContext.Provider>
	);
}

function MediaImageView({ node, updateAttributes, deleteNode }: NodeViewProps) {
	const media = useContext(MediaUrlContext);
	const mediaId = node.attrs.mediaId as string;
	const caption = (node.attrs.caption as string) ?? "";
	const info = media[mediaId];

	return (
		<NodeViewWrapper className="my-4">
			<figure
				className="overflow-hidden rounded-lg border"
				data-drag-handle
				draggable
			>
				{info ? (
					<img
						src={info.url}
						alt={info.altText}
						className="block max-h-96 w-full object-cover"
					/>
				) : (
					<div className="flex items-center gap-2 bg-muted p-6 text-muted-foreground text-sm">
						<ImageOff className="size-4" />
						Imagem não encontrada na biblioteca.
					</div>
				)}

				<div className="flex items-center gap-2 border-t bg-muted/40 p-2">
					<input
						value={caption}
						onChange={(event) =>
							updateAttributes({ caption: event.target.value })
						}
						placeholder="Legenda da imagem (opcional)"
						className="min-w-0 flex-1 bg-transparent px-1 text-sm outline-none placeholder:text-muted-foreground"
					/>
					<button
						type="button"
						onClick={deleteNode}
						aria-label="Remover imagem"
						className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
					>
						<Trash2 className="size-4" />
					</button>
				</div>
			</figure>
		</NodeViewWrapper>
	);
}

export const MediaImage = Node.create({
	name: "mediaImage",
	group: "block",
	atom: true,
	draggable: true,

	addAttributes() {
		return {
			mediaId: { default: "" },
			caption: { default: "" },
		};
	},

	parseHTML() {
		return [{ tag: "figure[data-media-id]" }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["figure", { "data-media-id": HTMLAttributes.mediaId }];
	},

	addNodeView() {
		return ReactNodeViewRenderer(MediaImageView);
	},
});

function EmbedView({ node, deleteNode }: NodeViewProps) {
	const url = node.attrs.url as string;

	return (
		<NodeViewWrapper className="my-4">
			<div className="flex items-center gap-2 rounded-lg border bg-muted/40 p-3 text-sm">
				<Link2 className="size-4 shrink-0 text-muted-foreground" />
				<span className="min-w-0 flex-1 truncate">{url}</span>
				<button
					type="button"
					onClick={deleteNode}
					aria-label="Remover incorporação"
					className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
				>
					<Trash2 className="size-4" />
				</button>
			</div>
		</NodeViewWrapper>
	);
}

export const Embed = Node.create({
	name: "embed",
	group: "block",
	atom: true,
	draggable: true,

	addAttributes() {
		return { url: { default: "" } };
	},

	parseHTML() {
		return [{ tag: "div[data-embed-url]" }];
	},

	renderHTML({ HTMLAttributes }) {
		return ["div", { "data-embed-url": HTMLAttributes.url }];
	},

	addNodeView() {
		return ReactNodeViewRenderer(EmbedView);
	},
});
