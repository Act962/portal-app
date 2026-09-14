"use client";

import type { ArtDesign, ArtElement, ElementKind } from "@portal-app/social";
import { cn } from "@portal-app/ui/lib/utils";
import {
	Circle,
	Eye,
	EyeOff,
	GripVertical,
	ImageIcon,
	Lock,
	LockOpen,
	Minus,
	Square,
	Type,
	UserSquare,
} from "lucide-react";
import { useState } from "react";

import { layerName, moveToIndex, updateElements } from "./editor-model";

export const KIND_ICON: Record<ElementKind, typeof Square> = {
	PHOTO: UserSquare,
	IMAGE: ImageIcon,
	RECT: Square,
	ELLIPSE: Circle,
	LINE: Minus,
	TEXT: Type,
};

/**
 * As camadas, de cima (na frente) para baixo (no fundo), como em toda
 * ferramenta de design. Arrasta para reordenar; o olho oculta, o cadeado trava;
 * duplo clique renomeia. Clique com Shift ou Ctrl soma à seleção.
 */
export function LayersPanel({
	design,
	selection,
	canDesign,
	onSelect,
	onChange,
}: {
	design: ArtDesign;
	selection: readonly string[];
	canDesign: boolean;
	onSelect: (ids: string[]) => void;
	onChange: (next: ArtDesign) => void;
}) {
	const [dragging, setDragging] = useState<string | null>(null);
	const [over, setOver] = useState<number | null>(null);
	const [renaming, setRenaming] = useState<string | null>(null);
	const rows = [...design.elements].reverse();

	if (rows.length === 0) {
		return (
			<p className="m-3 rounded-md border border-dashed p-4 text-center text-muted-foreground text-xs">
				Nenhuma camada ainda. Comece pela foto da matéria e pela moldura, na aba
				Elementos.
			</p>
		);
	}

	const toggle = (element: ArtElement, field: "visible" | "locked") =>
		onChange(
			updateElements(design, [element.id], (current) => ({
				...current,
				[field]: !current[field],
			})),
		);

	return (
		<ul className="flex flex-col gap-0.5 p-2">
			{rows.map((element, row) => {
				const Icon = KIND_ICON[element.kind];
				const selected = selection.includes(element.id);
				return (
					<li
						key={element.id}
						draggable={canDesign && renaming !== element.id}
						onDragStart={(event) => {
							setDragging(element.id);
							event.dataTransfer.effectAllowed = "move";
						}}
						onDragOver={(event) => {
							if (dragging) {
								event.preventDefault();
								setOver(row);
							}
						}}
						onDragEnd={() => {
							setDragging(null);
							setOver(null);
						}}
						onDrop={(event) => {
							event.preventDefault();
							if (dragging && dragging !== element.id) {
								onChange(
									moveToIndex(
										design,
										dragging,
										design.elements.length - 1 - row,
									),
								);
							}
							setDragging(null);
							setOver(null);
						}}
						className={cn(
							"group flex h-8 items-center gap-1 rounded-md border border-transparent pr-1 text-xs",
							selected ? "border-sky-500/60 bg-sky-500/10" : "hover:bg-muted",
							over === row && dragging !== element.id && "border-t-sky-500",
							dragging === element.id && "opacity-40",
							!element.visible && "text-muted-foreground",
						)}
					>
						<GripVertical
							aria-hidden
							className={cn(
								"size-3.5 shrink-0 text-muted-foreground/60",
								canDesign ? "cursor-grab" : "invisible",
							)}
						/>
						<Icon
							aria-hidden
							className="size-3.5 shrink-0 text-muted-foreground"
						/>
						{renaming === element.id ? (
							<input
								// biome-ignore lint/a11y/noAutofocus: renomear começa no campo, como em toda ferramenta
								autoFocus
								aria-label="Nome da camada"
								defaultValue={element.name}
								className="h-6 min-w-0 flex-1 rounded border bg-background px-1 text-xs outline-none"
								onBlur={(event) => {
									setRenaming(null);
									const name = event.target.value.slice(0, 60);
									if (name !== element.name) {
										onChange(
											updateElements(design, [element.id], (current) => ({
												...current,
												name,
											})),
										);
									}
								}}
								onKeyDown={(event) => {
									if (event.key === "Enter") {
										event.currentTarget.blur();
									} else if (event.key === "Escape") {
										setRenaming(null);
									}
								}}
							/>
						) : (
							<button
								type="button"
								className="min-w-0 flex-1 truncate py-1 text-left"
								onClick={(event) => {
									const additive =
										event.shiftKey || event.ctrlKey || event.metaKey;
									onSelect(
										additive
											? selected
												? selection.filter((id) => id !== element.id)
												: [...selection, element.id]
											: [element.id],
									);
								}}
								onDoubleClick={() => canDesign && setRenaming(element.id)}
								title="Duplo clique para renomear"
							>
								{layerName(element)}
							</button>
						)}
						<LayerToggle
							label={element.visible ? "Ocultar" : "Mostrar"}
							active={!element.visible}
							disabled={!canDesign}
							onClick={() => toggle(element, "visible")}
						>
							{element.visible ? (
								<Eye className="size-3.5" />
							) : (
								<EyeOff className="size-3.5" />
							)}
						</LayerToggle>
						<LayerToggle
							label={element.locked ? "Destravar" : "Travar"}
							active={element.locked}
							disabled={!canDesign}
							onClick={() => toggle(element, "locked")}
						>
							{element.locked ? (
								<Lock className="size-3.5" />
							) : (
								<LockOpen className="size-3.5" />
							)}
						</LayerToggle>
					</li>
				);
			})}
		</ul>
	);
}

function LayerToggle({
	label,
	active,
	disabled,
	onClick,
	children,
}: {
	label: string;
	active: boolean;
	disabled: boolean;
	onClick: () => void;
	children: React.ReactNode;
}) {
	return (
		<button
			type="button"
			aria-label={label}
			title={label}
			disabled={disabled}
			onClick={onClick}
			className={cn(
				"flex size-6 shrink-0 items-center justify-center rounded text-muted-foreground hover:bg-background hover:text-foreground",
				active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
			)}
		>
			{children}
		</button>
	);
}
