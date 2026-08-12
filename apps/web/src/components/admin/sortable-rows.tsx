"use client";

import {
	closestCenter,
	DndContext,
	type DragEndEvent,
	KeyboardSensor,
	PointerSensor,
	useSensor,
	useSensors,
} from "@dnd-kit/core";
import {
	restrictToParentElement,
	restrictToVerticalAxis,
} from "@dnd-kit/modifiers";
import {
	arrayMove,
	SortableContext,
	sortableKeyboardCoordinates,
	useSortable,
	verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { TableRow } from "@portal-app/ui/components/table";
import { cn } from "@portal-app/ui/lib/utils";
import { GripVertical } from "lucide-react";

/**
 * Reordenação por arrastar-e-soltar em tabela.
 *
 * Substitui o par de setas sobe/desce. As setas funcionam, mas cobram um clique
 * por posição: levar o sexto colunista para o primeiro lugar custava cinco
 * cliques e cinco idas ao servidor, cada uma reescrevendo a ordem inteira. Com
 * a ordem sendo justamente o que essas telas existem para definir, esse era o
 * gesto mais caro da tela.
 *
 * O TECLADO continua atendido, e é por isso que a troca não é uma perda de
 * acessibilidade: a alça é focável, espaço levanta a linha, as setas movem e
 * espaço solta — com anúncio em português para quem usa leitor de tela. Sem
 * isso, trocar setas por arrastar deixaria a reordenação inalcançável para
 * quem não usa mouse.
 */
export function SortableRows<T extends { id: string }>({
	items,
	onReorder,
	labelOf,
	children,
}: {
	items: readonly T[];
	/** Recebe os ids JÁ na ordem nova. Quem persiste é a tela. */
	onReorder: (ids: string[]) => void;
	/**
	 * Como chamar cada item nos anúncios do leitor de tela. Sem isto, o que se
	 * ouve é o uuid — "sobre a posição de 9608eb9d-960f-4baa…" —, que é a mesma
	 * coisa que não anunciar nada.
	 */
	labelOf: (id: string) => string;
	/**
	 * A TABELA INTEIRA, e não as linhas.
	 *
	 * O `DndContext` renderiza DOM próprio — as regiões de anúncio do leitor de
	 * tela, que são `<div>`. Dentro do `<tbody>` isso é HTML inválido: o
	 * navegador expulsa a div da tabela ao analisar o documento, e o React
	 * reclama de hidratação porque a árvore que ele montou deixou de bater com a
	 * que o navegador construiu. Envolvendo a tabela, as divs caem num lugar
	 * legítimo — e o `SortableContext`, que não renderiza nada, vai junto.
	 */
	children: React.ReactNode;
}) {
	const sensors = useSensors(
		// A distância mínima separa ARRASTAR de CLICAR: sem ela, um clique com um
		// tremor de 1px na alça viraria um arrasto de zero posições, e cada um
		// desses dispararia uma gravação da ordem inteira.
		useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
		useSensor(KeyboardSensor, {
			coordinateGetter: sortableKeyboardCoordinates,
		}),
	);

	const onDragEnd = (event: DragEndEvent) => {
		const { active, over } = event;
		// Soltar fora, ou no mesmo lugar, não é reordenação — e gravar assim mesmo
		// encheria a auditoria de mudanças que não mudaram nada.
		if (!over || active.id === over.id) {
			return;
		}
		const from = items.findIndex((item) => item.id === active.id);
		const to = items.findIndex((item) => item.id === over.id);
		if (from === -1 || to === -1) {
			return;
		}
		onReorder(arrayMove([...items], from, to).map((item) => item.id));
	};

	return (
		<DndContext
			sensors={sensors}
			collisionDetection={closestCenter}
			// Só na vertical e dentro da tabela: numa lista em coluna, o eixo
			// horizontal não significa nada, e deixar a linha vagar pela página só
			// dificulta mirar o lugar certo.
			modifiers={[restrictToVerticalAxis, restrictToParentElement]}
			onDragEnd={onDragEnd}
			accessibility={{
				announcements: {
					onDragStart: ({ active }) =>
						`${labelOf(String(active.id))} levantado. Use as setas para mover e espaço para soltar.`,
					onDragOver: ({ over }) =>
						over
							? `Na posição de ${labelOf(String(over.id))}.`
							: "Fora de qualquer posição.",
					onDragEnd: ({ active, over }) =>
						over
							? `${labelOf(String(active.id))} solto na posição de ${labelOf(String(over.id))}.`
							: `${labelOf(String(active.id))} voltou ao lugar.`,
					onDragCancel: ({ active }) =>
						`Reordenação cancelada. ${labelOf(String(active.id))} voltou ao lugar.`,
				},
			}}
		>
			<SortableContext
				items={items.map((item) => item.id)}
				strategy={verticalListSortingStrategy}
			>
				{children}
			</SortableContext>
		</DndContext>
	);
}

/**
 * Uma linha arrastável. Entrega a ALÇA para quem a renderiza decidir em que
 * célula ela fica — a alça precisa estar dentro de um `<td>`, e só a tela sabe
 * qual é a primeira coluna.
 */
export function SortableRow({
	id,
	label,
	children,
}: {
	id: string;
	/** O que a alça anuncia: "Reordenar {label}". */
	label: string;
	children: (handle: React.ReactNode) => React.ReactNode;
}) {
	const {
		attributes,
		listeners,
		setNodeRef,
		setActivatorNodeRef,
		transform,
		transition,
		isDragging,
	} = useSortable({ id });

	const handle = (
		<button
			type="button"
			ref={setActivatorNodeRef}
			aria-label={`Reordenar ${label}`}
			className="flex size-8 cursor-grab touch-none items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring active:cursor-grabbing"
			{...attributes}
			{...listeners}
		>
			<GripVertical className="size-4" />
		</button>
	);

	return (
		<TableRow
			ref={setNodeRef}
			style={{ transform: CSS.Transform.toString(transform), transition }}
			// A linha arrastada sobe acima das outras e fica translúcida: sem isso
			// ela desliza POR BAIXO das vizinhas e some justamente enquanto se mira.
			className={cn(isDragging && "relative z-10 bg-muted/60 opacity-90")}
		>
			{children(handle)}
		</TableRow>
	);
}
