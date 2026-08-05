"use client";
// Ver a nota do React Compiler em `toolbar.tsx`.
"use no memo";

import type { Block } from "@portal-app/editorial";
import { Button } from "@portal-app/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import { Placeholder } from "@tiptap/extensions";
import { EditorContent, useEditor } from "@tiptap/react";
import { BubbleMenu } from "@tiptap/react/menus";
import StarterKit from "@tiptap/starter-kit";
import { Bold, Italic, Link2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";

import { MediaPickerDialog } from "@/components/media/media-picker-dialog";

import { Embed, MediaImage, MediaUrlProvider } from "./nodes";
import { blocksToDoc, docToBlocks } from "./serialize";
import { Toolbar } from "./toolbar";

type MediaInfo = { url: string; altText: string };

/**
 * O editor de corpo da matéria.
 *
 * Rich-text de verdade (negrito, itálico, link, títulos, listas, citação,
 * imagem e incorporação), que continua EMITINDO os blocos do domínio — o
 * contrato do ADR 0003. O documento do ProseMirror nunca é persistido; o que
 * sai daqui é `Block[]`, traduzido em `serialize.ts`.
 */
export function ArticleBodyEditor({
	articleId,
	initialBlocks,
	media,
	onChange,
}: {
	/** Troca de matéria = recarregar o documento. */
	articleId: string;
	initialBlocks: readonly Block[];
	media: Record<string, MediaInfo>;
	onChange: (blocks: Block[]) => void;
}) {
	const [pickingImage, setPickingImage] = useState(false);
	const [linkOpen, setLinkOpen] = useState(false);
	const [linkUrl, setLinkUrl] = useState("");
	const loadedFor = useRef(articleId);

	const editor = useEditor({
		// Obrigatório no App Router: sem isto o TipTap tenta renderizar no
		// servidor e a hidratação diverge.
		immediatelyRender: false,
		extensions: [
			StarterKit.configure({
				heading: { levels: [2, 3] },
				// O domínio não tem estes blocos — deixá-los ligados criaria
				// conteúdo que o serializador descartaria em silêncio.
				codeBlock: false,
				code: false,
				strike: false,
				underline: false,
				horizontalRule: false,
				link: {
					openOnClick: false,
					autolink: true,
					HTMLAttributes: {
						rel: "noopener noreferrer nofollow",
						target: "_blank",
					},
				},
			}),
			Placeholder.configure({
				placeholder: "Escreva a matéria… Use a barra acima para formatar.",
			}),
			MediaImage,
			Embed,
		],
		content: blocksToDoc(initialBlocks),
		editorProps: {
			attributes: {
				class:
					"prose prose-neutral dark:prose-invert max-w-none min-h-[24rem] px-4 py-4 focus:outline-none",
			},
		},
		onUpdate: ({ editor: instance }) => {
			onChange(docToBlocks(instance.getJSON()));
		},
	});

	// Só recarrega o documento quando a MATÉRIA muda. Realimentar a cada
	// alteração faria o cursor saltar para o início a cada tecla.
	useEffect(() => {
		if (editor && loadedFor.current !== articleId) {
			loadedFor.current = articleId;
			editor.commands.setContent(blocksToDoc(initialBlocks));
		}
	}, [editor, articleId, initialBlocks]);

	const insertImage = useCallback(
		(mediaId: string) => {
			editor
				?.chain()
				.focus()
				.insertContent({ type: "mediaImage", attrs: { mediaId, caption: "" } })
				.run();
			setPickingImage(false);
		},
		[editor],
	);

	const applyLink = useCallback(() => {
		const url = linkUrl.trim();
		if (url) {
			editor?.chain().focus().setLink({ href: url }).run();
		}
		setLinkUrl("");
		setLinkOpen(false);
	}, [editor, linkUrl]);

	const addEmbed = useCallback(() => {
		const url = window.prompt("Cole o endereço para incorporar:");
		if (url && /^https?:\/\/.+/.test(url.trim())) {
			editor
				?.chain()
				.focus()
				.insertContent({ type: "embed", attrs: { url: url.trim() } })
				.run();
		}
	}, [editor]);

	if (!editor) {
		return (
			<div className="min-h-[28rem] animate-pulse rounded-lg border bg-muted/30" />
		);
	}

	return (
		<MediaUrlProvider value={media}>
			<div className="overflow-hidden rounded-lg border bg-background">
				<Toolbar
					editor={editor}
					onPickImage={() => setPickingImage(true)}
					onAddEmbed={addEmbed}
					onSetLink={() => {
						setLinkUrl(editor.getAttributes("link").href ?? "");
						setLinkOpen(true);
					}}
				/>

				{/* Menu flutuante: a formatação inline ao alcance da seleção. */}
				<BubbleMenu
					editor={editor}
					className="flex gap-1 rounded-md border bg-popover p-1 shadow-md"
				>
					<Button
						type="button"
						size="icon"
						variant={editor.isActive("bold") ? "secondary" : "ghost"}
						aria-label="Negrito"
						onClick={() => editor.chain().focus().toggleBold().run()}
					>
						<Bold className="size-4" />
					</Button>
					<Button
						type="button"
						size="icon"
						variant={editor.isActive("italic") ? "secondary" : "ghost"}
						aria-label="Itálico"
						onClick={() => editor.chain().focus().toggleItalic().run()}
					>
						<Italic className="size-4" />
					</Button>
					<Button
						type="button"
						size="icon"
						variant={editor.isActive("link") ? "secondary" : "ghost"}
						aria-label="Link"
						onClick={() => {
							setLinkUrl(editor.getAttributes("link").href ?? "");
							setLinkOpen(true);
						}}
					>
						<Link2 className="size-4" />
					</Button>
				</BubbleMenu>

				<EditorContent editor={editor} />
			</div>

			<MediaPickerDialog
				open={pickingImage}
				onOpenChange={setPickingImage}
				onSelect={insertImage}
				title="Inserir imagem no texto"
			/>

			<Dialog open={linkOpen} onOpenChange={setLinkOpen}>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							applyLink();
						}}
					>
						<DialogHeader>
							<DialogTitle>Inserir link</DialogTitle>
							<DialogDescription>
								O endereço completo, começando por https://
							</DialogDescription>
						</DialogHeader>
						<div className="py-4">
							{/* biome-ignore lint/a11y/noAutofocus: campo único do diálogo */}
							<Input
								autoFocus
								value={linkUrl}
								onChange={(event) => setLinkUrl(event.target.value)}
								placeholder="https://exemplo.com/pagina"
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setLinkOpen(false)}
							>
								Cancelar
							</Button>
							<Button type="submit" disabled={!linkUrl.trim()}>
								Aplicar
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>
		</MediaUrlProvider>
	);
}
