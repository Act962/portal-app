"use client";
// O React Compiler memoiza leituras de `editor.isActive(...)` feitas no render e
// os botões param de refletir a seleção — o editor muda por mutação, não por
// state. `useEditorState` resolve a leitura; esta diretiva cobre o resto.
"use no memo";

import type { BlockLineHeight } from "@portal-app/editorial";
import { Button } from "@portal-app/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@portal-app/ui/components/select";
import { Separator } from "@portal-app/ui/components/separator";
import {
	Tooltip,
	TooltipContent,
	TooltipTrigger,
} from "@portal-app/ui/components/tooltip";
import { cn } from "@portal-app/ui/lib/utils";
import type { Editor } from "@tiptap/react";
import { useEditorState } from "@tiptap/react";
import {
	AlignCenter,
	AlignJustify,
	AlignLeft,
	AlignRight,
	Bold,
	Eraser,
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
	Strikethrough,
	Underline,
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
			isUnderline: e.isActive("underline"),
			isStrike: e.isActive("strike"),
			isLink: e.isActive("link"),
			isH2: e.isActive("heading", { level: 2 }),
			isH3: e.isActive("heading", { level: 3 }),
			isParagraph: e.isActive("paragraph"),
			isBulletList: e.isActive("bulletList"),
			isOrderedList: e.isActive("orderedList"),
			isQuote: e.isActive("blockquote"),
			/*
			 * O alinhamento vale para o BLOCO, e o TipTap responde `false` a
			 * `{ textAlign: "left" }` quando ninguém alinhou nada — o padrão da
			 * extensão é vazio, não "left" (ver `article-body-editor.tsx`). Sem
			 * este `||`, os quatro botões ficariam apagados num parágrafo comum,
			 * e a barra não diria qual é o alinhamento em vigor.
			 */
			isAlignLeft:
				e.isActive({ textAlign: "left" }) ||
				!(
					e.isActive({ textAlign: "center" }) ||
					e.isActive({ textAlign: "right" }) ||
					e.isActive({ textAlign: "justify" })
				),
			isAlignCenter: e.isActive({ textAlign: "center" }),
			isAlignRight: e.isActive({ textAlign: "right" }),
			isAlignJustify: e.isActive({ textAlign: "justify" }),
			/*
			 * A entrelinha em vigor. Pergunta ao título ANTES do parágrafo: quando
			 * o cursor está num H2 o `getAttributes("paragraph")` devolve `{}`, e a
			 * ordem inversa acabaria lendo o atributo do bloco errado.
			 *
			 * `null` = o espaçamento do portal, que é o padrão e não um valor.
			 */
			lineHeight:
				(e.getAttributes("heading").lineHeight as string | undefined) ??
				(e.getAttributes("paragraph").lineHeight as string | undefined) ??
				null,
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

/** O padrão do portal não é um valor de `line-height` — é a ausência dele. */
const PORTAL_DEFAULT = "padrao";

/**
 * As opções do menu, na ordem do Google Docs, que é a referência que a redação
 * trouxe. A primeira é "Padrão do portal" e não "Simples": o corpo da matéria é
 * desenhado em 1,65 por conforto de leitura, e um "simples" que apertasse o
 * texto para 1,0 seria um botão para estragar a tipografia do veículo sem
 * perceber. Ver `BLOCK_LINE_HEIGHTS` no domínio.
 */
const LINE_HEIGHT_OPTIONS = [
	{ value: PORTAL_DEFAULT, label: "Padrão do portal" },
	{ value: "1.15", label: "1,15" },
	{ value: "1.5", label: "1,5" },
	{ value: "2", label: "Duplo" },
] as const;

/**
 * Espaçamento entre linhas — o pedido "como no Google Docs" (08/09).
 *
 * Menu de escolha única, e não um botão que cicla entre valores: são quatro
 * opções e a pessoa precisa VER qual está em vigor antes de trocar. O
 * `RadioGroup` já desenha o ✓ ao lado da atual, que é exatamente o que o Docs
 * faz.
 */
function LineHeightMenu({
	editor,
	current,
}: {
	editor: Editor;
	current: string | null;
}) {
	const value = current ?? PORTAL_DEFAULT;

	return (
		/*
		 * `Select`, e não `DropdownMenu`. Os dois menus do Base UI foram tentados
		 * aqui e os dois abriram sem NUNCA ativar o item — nem por clique real,
		 * nem por teclado, nem despachando a sequência inteira de eventos de
		 * ponteiro. O mesmo `DropdownMenuItem` funciona na lista de matérias, o
		 * que aponta para alguma interferência desta posição (barra dentro do
		 * editor, com o ProseMirror e o menu flutuante disputando o foco) — não
		 * vale caçar isso agora.
		 *
		 * O `Select` é o dropdown que este painel já usa nos filtros da lista, e
		 * é o certo pelo significado: uma escolha entre alternativas mutuamente
		 * exclusivas, com a atual visível no gatilho. É mais informativo que o
		 * menu, aliás — o valor em vigor se lê sem abrir nada.
		 */
		<Select
			items={LINE_HEIGHT_OPTIONS.map((option) => ({
				value: option.value,
				label: option.label,
			}))}
			value={value}
			onValueChange={(next) => {
				const chain = editor.chain().focus();
				if (!next || next === PORTAL_DEFAULT) {
					chain.unsetLineHeight().run();
					return;
				}
				chain.setLineHeight(next as BlockLineHeight).run();
			}}
		>
			{/* Estreito de propósito: divide a barra com vinte botões. O rótulo
			    longo do padrão é encurtado no gatilho pelo `SelectValue`. */}
			<SelectTrigger
				size="sm"
				className="h-8 w-[7.5rem]"
				aria-label="Espaçamento entre linhas"
				title="Espaçamento entre linhas"
			>
				<SelectValue placeholder="Espaçamento" />
			</SelectTrigger>
			<SelectContent>
				{LINE_HEIGHT_OPTIONS.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

/**
 * O menu que aparece SOBRE a seleção.
 *
 * Vive aqui, e não em `article-body-editor.tsx`, porque a alternativa era o que
 * havia antes: quatro botões reescritos à mão lá, sem `aria-pressed`, sem
 * tooltip e sem o estado reativo — eles nem acendiam quando o trecho já estava
 * em negrito. Dois lugares desenhando o mesmo botão discordam com o tempo, e
 * foi exatamente o que aconteceu: a barra fixa ganhou sublinhado, riscado e
 * alinhamento, e o menu flutuante ficou para trás com os quatro de sempre.
 * Mesmo `ToolButton`, mesmo `useToolbarState`.
 *
 * **Não é a barra fixa inteira, e isso é decisão.** O que entra é o que se faz
 * COM UM TRECHO SELECIONADO: as marcas, o link, transformar o parágrafo em
 * título ou citação, virar lista, e limpar a formatação. Ficam de fora imagem,
 * incorporação, desfazer/refazer e tela cheia — nenhum deles fala da seleção —,
 * e também o alinhamento, que é do BLOCO e não do trecho. Este menu flutua POR
 * CIMA do texto que a pessoa está lendo: cada botão a mais é uma linha a menos
 * visível, então ele carrega o que a mão procura ali, não o catálogo.
 */
export function SelectionToolbar({
	editor,
	onSetLink,
}: {
	editor: Editor;
	onSetLink: () => void;
}) {
	const state = useToolbarState(editor);

	return (
		// `flex-wrap` porque o menu é posicionado pelo TipTap e pode nascer perto
		// da borda da janela: preso numa linha só, o último botão sairia da tela.
		<div className="flex max-w-[min(22rem,90vw)] flex-wrap items-center gap-0.5 rounded-md border bg-popover p-1 shadow-md">
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
				label="Sublinhado"
				shortcut="Ctrl+U"
				active={state.isUnderline}
				onClick={() => editor.chain().focus().toggleUnderline().run()}
			>
				<Underline className="size-4" />
			</ToolButton>
			<ToolButton
				label="Riscado"
				active={state.isStrike}
				onClick={() => editor.chain().focus().toggleStrike().run()}
			>
				<Strikethrough className="size-4" />
			</ToolButton>
			{/* Alterna, como na barra fixa: o menu abre justamente sobre um trecho
			    já linkado quando a intenção é TIRAR o link. */}
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

			<Separator orientation="vertical" className="mx-0.5 h-6" />

			{/* Transformar o bloco: é o segundo gesto mais comum sobre uma seleção
			    — marcar a linha e promovê-la a intertítulo ou a citação. */}
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
			<ToolButton
				label="Citação"
				active={state.isQuote}
				onClick={() => editor.chain().focus().toggleBlockquote().run()}
			>
				<Quote className="size-4" />
			</ToolButton>

			<Separator orientation="vertical" className="mx-0.5 h-6" />

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

			<Separator orientation="vertical" className="mx-0.5 h-6" />

			{/*
			  O botão que mais se procura aqui: cola-se um trecho de outro site, ele
			  vem com formatação que não é do portal, e o gesto seguinte é
			  selecionar o que foi colado. Diferente do da barra fixa, este NÃO
			  chama `clearNodes()` — ali a intenção é limpar o documento; aqui a
			  seleção pode ser meia frase, e transformar o bloco inteiro em
			  parágrafo por causa dela seria fazer mais do que se pediu.
			*/}
			<ToolButton
				label="Limpar formatação"
				onClick={() => editor.chain().focus().unsetAllMarks().run()}
			>
				<Eraser className="size-4" />
			</ToolButton>
		</div>
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
				label="Sublinhado"
				shortcut="Ctrl+U"
				active={state.isUnderline}
				onClick={() => editor.chain().focus().toggleUnderline().run()}
			>
				<Underline className="size-4" />
			</ToolButton>
			<ToolButton
				label="Riscado"
				shortcut="Ctrl+Shift+S"
				active={state.isStrike}
				onClick={() => editor.chain().focus().toggleStrike().run()}
			>
				<Strikethrough className="size-4" />
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

			{/*
			  Alinhamento. Os quatro juntos, e não só o "justificar" que a redação
			  pediu: um botão de justificar sozinho não tem como ser DESFEITO — a
			  pessoa justifica um parágrafo por engano e não encontra a volta.
			*/}
			<ToolButton
				label="Alinhar à esquerda"
				active={state.isAlignLeft}
				onClick={() => editor.chain().focus().setTextAlign("left").run()}
			>
				<AlignLeft className="size-4" />
			</ToolButton>
			<ToolButton
				label="Centralizar"
				active={state.isAlignCenter}
				onClick={() => editor.chain().focus().setTextAlign("center").run()}
			>
				<AlignCenter className="size-4" />
			</ToolButton>
			<ToolButton
				label="Alinhar à direita"
				active={state.isAlignRight}
				onClick={() => editor.chain().focus().setTextAlign("right").run()}
			>
				<AlignRight className="size-4" />
			</ToolButton>
			<ToolButton
				label="Justificar"
				active={state.isAlignJustify}
				onClick={() => editor.chain().focus().setTextAlign("justify").run()}
			>
				<AlignJustify className="size-4" />
			</ToolButton>

			<LineHeightMenu editor={editor} current={state.lineHeight} />

			<Separator orientation="vertical" className="mx-1 h-6" />

			<ToolButton label="Inserir imagem" onClick={onPickImage}>
				<ImagePlus className="size-4" />
			</ToolButton>
			<ToolButton label="Incorporar link (vídeo, post)" onClick={onAddEmbed}>
				<Link2 className="size-4" />
			</ToolButton>

			{/*
			  Limpar formatação. É o botão que salva quem colou de um site ou do
			  Word e trouxe junto negrito, sublinhado e alinhamento que não são do
			  portal — tirar tudo de uma vez é bem mais rápido que caçar marca por
			  marca. Tira as marcas E os blocos (título vira parágrafo), que é o
			  que "limpar" significa para quem clica.
			*/}
			<ToolButton
				label="Limpar formatação"
				onClick={() =>
					editor
						.chain()
						.focus()
						.unsetAllMarks()
						.clearNodes()
						.setTextAlign("left")
						.run()
				}
			>
				<Eraser className="size-4" />
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
