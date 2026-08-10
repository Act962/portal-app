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
import { cn } from "@portal-app/ui/lib/utils";
import CharacterCount from "@tiptap/extension-character-count";
import Typography from "@tiptap/extension-typography";
import { Placeholder } from "@tiptap/extensions";
import type { Editor } from "@tiptap/react";
import { EditorContent, useEditor, useEditorState } from "@tiptap/react";
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
	const [expanded, setExpanded] = useState(false);
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
				// Por NÓ, não só no documento vazio: um H2 em branco no meio do texto
				// diz "Título da seção" em vez de ficar uma linha muda.
				placeholder: ({ node }) => {
					if (node.type.name === "heading") {
						return "Título da seção";
					}
					return "Escreva a matéria… Use a barra acima para formatar.";
				},
			}),
			// Substituições tipográficas enquanto digita: aspas retas viram aspas
			// curvas, `--` vira travessão, `...` vira reticências. É o que separa
			// texto de portal de texto de bloco de notas — e é seguro para o
			// domínio, porque mexe só no TEXTO, nunca na estrutura dos blocos.
			Typography,
			// Contagem de palavras/caracteres. Não impõe limite: a régua de tamanho
			// é editorial, não técnica.
			CharacterCount,
			MediaImage,
			Embed,
		],
		content: blocksToDoc(initialBlocks),
		editorProps: {
			attributes: {
				class:
					"prose prose-neutral dark:prose-invert max-w-none px-6 py-5 focus:outline-none",
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

	// Esc sai do modo expandido. Um overlay que só fecha por clique num botão é
	// armadilha para quem escreve com as mãos no teclado.
	useEffect(() => {
		if (!expanded) {
			return;
		}
		const onKeyDown = (event: KeyboardEvent) => {
			if (event.key === "Escape") {
				setExpanded(false);
			}
		};
		document.addEventListener("keydown", onKeyDown);
		// Trava a rolagem do formulário atrás do overlay — sem isto a roda do
		// mouse rola a página de baixo quando o texto acaba.
		const previousOverflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKeyDown);
			document.body.style.overflow = previousOverflow;
		};
	}, [expanded]);

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
			{/* Expandido é o MESMO elemento com outra moldura, e não uma segunda
			    árvore: remontar o `EditorContent` faria o TipTap recriar a view e o
			    cursor voltaria para o começo a cada vez que se entra ou sai. */}
			{/* SEM `overflow-hidden` quando encaixotado. Ele transforma esta caixa em
			    contexto de rolagem, e aí o `sticky top-14` da barra passa a se medir
			    contra ELA em vez de contra a página: a barra fica presa 56px abaixo
			    do topo da caixa para sempre, e aqueles 56px viram um buraco em
			    branco. O canto arredondado sai nos filhos (barra e rodapé). */}
			<div
				className={cn(
					"article-editor flex flex-col bg-background",
					expanded ? "fixed inset-0 z-50" : "rounded-lg border",
				)}
			>
				<Toolbar
					editor={editor}
					expanded={expanded}
					onToggleExpanded={() => setExpanded((value) => !value)}
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

				{/* Expandido, a rolagem é DESTE painel — não da página. Encaixotado,
				    o editor cresce com o texto e quem rola é o formulário. */}
				{/* Só o modo expandido rola por dentro. Encaixotado, quem rola é a
				    página — e um `overflow-y-auto` aqui recriaria o mesmo contexto de
				    rolagem que quebra o `sticky` da barra. */}
				<div className={cn(expanded ? "flex-1 overflow-y-auto" : "min-h-[24rem]")}>
					{/* A largura de leitura vale mesmo em tela cheia: linha de 1400px
					    é ilegível, e o corpo publicado sai em coluna estreita. Escrever
					    na medida em que se lê é o resto do WYSIWYG. */}
					<div className={cn(expanded && "mx-auto w-full max-w-[68ch]")}>
						<EditorContent editor={editor} />
					</div>
				</div>

				<EditorFooter editor={editor} expanded={expanded} />
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

/**
 * Rodapé do editor: contagem e o lembrete de como sair da tela cheia.
 *
 * Componente à parte porque `useEditorState` assina as mudanças do editor — no
 * corpo do `ArticleBodyEditor` ele rerenderizaria o formulário inteiro a cada
 * tecla digitada.
 */
function EditorFooter({
	editor,
	expanded,
}: {
	editor: Editor;
	expanded: boolean;
}) {
	const { words, characters } = useEditorState({
		editor,
		selector: ({ editor: instance }) => ({
			words: instance.storage.characterCount.words(),
			characters: instance.storage.characterCount.characters(),
		}),
	});

	return (
		<div
			className={cn(
				"flex items-center justify-between gap-3 border-t bg-muted/30 px-4 py-1.5 text-muted-foreground text-xs",
				!expanded && "rounded-b-lg",
			)}
		>
			<span>
				{words} {words === 1 ? "palavra" : "palavras"} · {characters}{" "}
				{characters === 1 ? "caractere" : "caracteres"}
			</span>
			{expanded ? (
				<span className="font-mono text-[10px] uppercase tracking-wider">
					Esc para sair da tela cheia
				</span>
			) : null}
		</div>
	);
}
