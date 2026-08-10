"use client";
// O React Compiler memoiza leituras de `editor.isActive(...)` feitas no render e
// os botões param de refletir a seleção — o editor muda por mutação, não por
// state. `useEditorState` resolve a leitura; esta diretiva cobre o resto.
"use no memo";

import { Button } from "@portal-app/ui/components/button";
import { Separator } from "@portal-app/ui/components/separator";
import { cn } from "@portal-app/ui/lib/utils";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@portal-app/ui/components/tooltip";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
	Bold,
	Heading2,
	Heading3,
	ImagePlus,
	Italic,
	Link2,
	Link2Off,
	List,
	ListOrdered,
	Maximize2,
	Minimize2,
	Pilcrow,
	Quote,
	Redo2,
	Undo2,
} from "lucide-react";

type ToolbarProps = {
	editor: Editor;
	/** Editor ocupando a tela inteira. */
	expanded: boolean;
	onToggleExpanded: () => void;
	onPickImage: () => void;
	onAddEmbed: () => void;
	onSetLink: () => void;
};

/** Estado da seleção, lido pela API reativa do TipTap (e não no render). */
function useToolbarState(editor: Editor) {
	return useEditorState({
		editor,
		selector: ({ editor: e }) => ({
			isBold: e.isActive("bold"),
			isItalic: e.isActive("italic"),
			isLink: e.isActive("link"),
			isH2: e.isActive("heading", { level: 2 }),
			isH3: e.isActive("heading", { level: 3 }),
			isParagraph: e.isActive("paragraph"),
			isBulletList: e.isActive("bulletList"),
			isOrderedList: e.isActive("orderedList"),
			isQuote: e.isActive("blockquote"),
			canUndo: e.can().undo(),
			canRedo: e.can().redo(),
		}),
	});
}

function ToolButton({
	label,
	shortcut,
	active,
	disabled,
	onClick,
	children,
}: {
	label: string;
	shortcut?: string;
	active?: boolean;
	disabled?: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<Tooltip>
			<TooltipTrigger
				render={
					<Button
						type="button"
						size="icon"
						variant={active ? "secondary" : "ghost"}
						aria-label={label}
						aria-pressed={active}
						disabled={disabled}
						onClick={onClick}
					/>
				}
			>
				{children}
			</TooltipTrigger>
			<TooltipContent>
				{label}
				{shortcut ? (
					<span className="ml-2 text-muted-foreground">{shortcut}</span>
				) : null}
			</TooltipContent>
		</Tooltip>
	);
}

/**
 * Barra fixa do editor. Fica visível o tempo todo, em vez de só aparecer sobre a
 * seleção: numa ferramenta de redação, descoberta e memória muscular valem mais
 * que a elegância de esconder. A formatação inline também está no menu flutuante.
 */
export function Toolbar({
	editor,
	expanded,
	onToggleExpanded,
	onPickImage,
	onAddEmbed,
	onSetLink,
}: ToolbarProps) {
	const state = useToolbarState(editor);

	return (
		<div
			className={cn(
				"z-10 flex flex-wrap items-center gap-1 border-b bg-background/95 p-1.5 backdrop-blur",
				// Encaixotado, a barra gruda abaixo do cabeçalho do painel. Em tela
				// cheia ela JÁ é o topo — `sticky top-14` a empurraria para fora.
				// Sem o `overflow-hidden` do container, o canto arredondado precisa vir
				// daqui — senão a barra passa reto pela borda da caixa.
				!expanded && "sticky top-14 rounded-t-lg",
			)}
		>
			<ToolButton
				label="Negrito"
				shortcut="Ctrl+B"
				active={state.isBold}
				onClick={() => editor.chain().focus().toggleBold().run()}
			>
				<Bold className="size-4" />
			</ToolButton>
			<ToolButton
				label="Itálico"
				shortcut="Ctrl+I"
				active={state.isItalic}
				onClick={() => editor.chain().focus().toggleItalic().run()}
			>
				<Italic className="size-4" />
			</ToolButton>
			<ToolButton
				label={state.isLink ? "Remover link" : "Inserir link"}
				shortcut="Ctrl+K"
				active={state.isLink}
				onClick={() =>
					state.isLink ? editor.chain().focus().unsetLink().run() : onSetLink()
				}
			>
				{state.isLink ? (
					<Link2Off className="size-4" />
				) : (
					<Link2 className="size-4" />
				)}
			</ToolButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			<ToolButton
				label="Parágrafo"
				active={state.isParagraph}
				onClick={() => editor.chain().focus().setParagraph().run()}
			>
				<Pilcrow className="size-4" />
			</ToolButton>
			<ToolButton
				label="Título (H2)"
				active={state.isH2}
				onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}
			>
				<Heading2 className="size-4" />
			</ToolButton>
			<ToolButton
				label="Subtítulo (H3)"
				active={state.isH3}
				onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()}
			>
				<Heading3 className="size-4" />
			</ToolButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			<ToolButton
				label="Lista"
				active={state.isBulletList}
				onClick={() => editor.chain().focus().toggleBulletList().run()}
			>
				<List className="size-4" />
			</ToolButton>
			<ToolButton
				label="Lista numerada"
				active={state.isOrderedList}
				onClick={() => editor.chain().focus().toggleOrderedList().run()}
			>
				<ListOrdered className="size-4" />
			</ToolButton>
			<ToolButton
				label="Citação"
				active={state.isQuote}
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
			>
				<Quote className="size-4" />
			</ToolButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			<ToolButton label="Inserir imagem" onClick={onPickImage}>
				<ImagePlus className="size-4" />
			</ToolButton>
			<ToolButton label="Incorporar link (vídeo, post)" onClick={onAddEmbed}>
				<Link2 className="size-4" />
			</ToolButton>

			<div className="flex-1" />

			<ToolButton
				label="Desfazer"
				shortcut="Ctrl+Z"
				disabled={!state.canUndo}
				onClick={() => editor.chain().focus().undo().run()}
			>
				<Undo2 className="size-4" />
			</ToolButton>
			<ToolButton
				label="Refazer"
				shortcut="Ctrl+Shift+Z"
				disabled={!state.canRedo}
				onClick={() => editor.chain().focus().redo().run()}
			>
				<Redo2 className="size-4" />
			</ToolButton>

			<Separator orientation="vertical" className="mx-1 h-6" />

			<ToolButton
				label={expanded ? "Sair da tela cheia" : "Escrever em tela cheia"}
				shortcut={expanded ? "Esc" : undefined}
				active={expanded}
				onClick={onToggleExpanded}
			>
				{expanded ? (
					<Minimize2 className="size-4" />
				) : (
					<Maximize2 className="size-4" />
				)}
			</ToolButton>
		</div>
	);
}
