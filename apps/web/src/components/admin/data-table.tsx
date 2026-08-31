"use client";

import { cn } from "@portal-app/ui/lib/utils";
import {
	type CSSProperties,
	type KeyboardEvent as ReactKeyboardEvent,
	type PointerEvent as ReactPointerEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";

import {
	type ColumnSpec,
	type ColumnWidths,
	clampWidth,
	defaultWidths,
	hasCustomWidths,
	pinnedKeys,
	pinnedOffsets,
	readStoredWidths,
	resizeColumn,
	serializeWidths,
	tableMinWidth,
} from "@/lib/table-columns";

/**
 * A casca das tabelas do painel: colunas CONGELADAS à esquerda e colunas que o
 * usuário REDIMENSIONA.
 *
 * O problema que ela resolve é o da lista de matérias com muitas colunas: rolar
 * para a direita para ver o autor fazia o título sair da tela, e aí a linha
 * vira um punhado de valores sem sujeito — "Política · João Gabriel · Publicada"
 * não diz de qual matéria se está falando. Congelar título e caixinha devolve o
 * sujeito a cada linha durante a rolagem.
 *
 * O redimensionamento existe pelo motivo inverso: uma largura fixa boa para
 * manchete curta desperdiça meia tela, e uma boa para manchete longa espreme
 * todo o resto. Não há número certo — só o usuário sabe, e ele muda de ideia
 * conforme a tarefa. Por isso a largura é dele, e fica guardada.
 *
 * A ARITMÉTICA (limites, deslocamento das congeladas, o que se guarda) mora em
 * `@/lib/table-columns`, testada. Aqui fica só o DOM e o arrasto.
 */

/** A largura de cada coluna vira uma variável CSS no `<table>`. É isso que
 * permite o arrasto correr sem re-renderizar a tabela a cada pixel: durante o
 * gesto escrevemos direto no nó, e só o SOLTAR vira estado do React. */
function cssVars(
	specs: readonly ColumnSpec[],
	widths: ColumnWidths,
): CSSProperties {
	const vars: Record<string, string> = {};
	for (const spec of specs) {
		vars[`--col-${spec.key}`] = `${widths[spec.key] ?? spec.width}px`;
	}
	const offsets = pinnedOffsets(specs, widths);
	for (const [key, left] of Object.entries(offsets)) {
		vars[`--pin-${key}`] = `${left}px`;
	}
	vars["--table-min-width"] = `${tableMinWidth(specs, widths)}px`;
	return vars as CSSProperties;
}

function writeVars(
	node: HTMLTableElement | null,
	specs: readonly ColumnSpec[],
	widths: ColumnWidths,
) {
	if (!node) {
		return;
	}
	for (const [name, value] of Object.entries(
		cssVars(specs, widths) as Record<string, string>,
	)) {
		node.style.setProperty(name, value);
	}
}

export function useColumnWidths(
	specs: readonly ColumnSpec[],
	storageKey: string,
) {
	// Começa no PADRÃO, sempre. Ler o disco na inicialização faria o servidor
	// renderizar uma largura e o cliente outra — e a hidratação do React reclama
	// disso com razão. O ajuste vem logo depois, no efeito.
	const [widths, setWidths] = useState<ColumnWidths>(() =>
		defaultWidths(specs),
	);
	const tableRef = useRef<HTMLTableElement | null>(null);

	// biome-ignore lint/correctness/useExhaustiveDependencies: ler o disco UMA vez, na montagem
	useEffect(() => {
		try {
			setWidths(readStoredWidths(localStorage.getItem(storageKey), specs));
		} catch {
			// Janela anônima, site data bloqueado: o padrão serve.
		}
	}, [storageKey]);

	const persist = useCallback(
		(next: ColumnWidths) => {
			try {
				localStorage.setItem(storageKey, serializeWidths(specs, next));
			} catch {
				// Não poder guardar a preferência não é motivo para perder o gesto.
			}
		},
		[specs, storageKey],
	);

	const commit = useCallback(
		(key: string, width: number) => {
			setWidths((current) => {
				const next = resizeColumn(current, specs, key, width);
				if (next !== current) {
					persist(next);
				}
				return next;
			});
		},
		[persist, specs],
	);

	/** Durante o arrasto: escreve no nó, sem passar pelo React. */
	const preview = useCallback(
		(key: string, width: number) => {
			const spec = specs.find((s) => s.key === key);
			if (!spec) {
				return;
			}
			writeVars(tableRef.current, specs, {
				...widths,
				[key]: clampWidth(spec, width),
			});
		},
		[specs, widths],
	);

	const reset = useCallback(() => {
		const next = defaultWidths(specs);
		setWidths(next);
		persist(next);
	}, [persist, specs]);

	return {
		widths,
		tableRef,
		preview,
		commit,
		reset,
		canReset: hasCustomWidths(specs, widths),
		style: cssVars(specs, widths),
	};
}

export type ColumnWidthsApi = ReturnType<typeof useColumnWidths>;

/** O passo do teclado. A alça não pode ser exclusiva do mouse: ela é um
 * controle, e controle que só responde a arrasto exclui quem navega por tab. */
const STEP = 16;
const STEP_LARGE = 48;

export function ColumnResizeHandle({
	spec,
	api,
	label,
}: {
	spec: ColumnSpec;
	api: ColumnWidthsApi;
	/** O nome da coluna, para o leitor de tela dizer o que está sendo ajustado. */
	label: string;
}) {
	/**
	 * O gesto em curso vive num REF, não no estado.
	 *
	 * Não é preciosismo: `setState` não muda a variável do render atual, e num
	 * arrasto rápido `pointerdown`, `pointermove` e `pointerup` caem no MESMO
	 * tick — os três handlers leriam `dragging === false`, o movimento seria
	 * ignorado e o `pointerup` abortaria antes de gravar a largura. O gesto some
	 * inteiro, e some só quando é rápido, que é a pior categoria de defeito.
	 *
	 * O estado abaixo continua existindo, mas só para o DESTAQUE visual — se ele
	 * chegar um render atrasado, ninguém perde nada.
	 */
	const drag = useRef<{ x: number; width: number } | null>(null);
	const [dragging, setDragging] = useState(false);
	const current = api.widths[spec.key] ?? spec.width;

	const onPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
		// Só o botão principal. Arrastar com o botão do meio abriria a rolagem
		// automática do navegador POR CIMA do gesto.
		if (event.button !== 0) {
			return;
		}
		event.preventDefault();
		drag.current = { x: event.clientX, width: current };
		setDragging(true);
		// Captura: o ponteiro sai da alça no primeiro pixel de movimento, e sem
		// isto o arrasto morre assim que o cursor passa para a célula vizinha.
		event.currentTarget.setPointerCapture(event.pointerId);
	};

	const onPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
		const started = drag.current;
		if (!started) {
			return;
		}
		api.preview(spec.key, started.width + (event.clientX - started.x));
	};

	const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
		const started = drag.current;
		if (!started) {
			return;
		}
		drag.current = null;
		setDragging(false);
		if (event.currentTarget.hasPointerCapture(event.pointerId)) {
			event.currentTarget.releasePointerCapture(event.pointerId);
		}
		api.commit(spec.key, started.width + (event.clientX - started.x));
	};

	const onKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
		const step = event.shiftKey ? STEP_LARGE : STEP;
		if (event.key === "ArrowLeft") {
			event.preventDefault();
			api.commit(spec.key, current - step);
		} else if (event.key === "ArrowRight") {
			event.preventDefault();
			api.commit(spec.key, current + step);
		} else if (event.key === "Home") {
			event.preventDefault();
			api.commit(spec.key, spec.width);
		}
	};

	return (
		// biome-ignore lint/a11y/useSemanticElements: `separator` com arrasto é o papel certo; um <button> anunciaria "clique para acionar", que não é o que este controle faz
		<div
			role="separator"
			aria-orientation="vertical"
			aria-label={`Largura da coluna ${label}`}
			aria-valuenow={current}
			aria-valuemin={spec.minWidth}
			aria-valuemax={spec.maxWidth ?? 720}
			tabIndex={0}
			onPointerDown={onPointerDown}
			onPointerMove={onPointerMove}
			onPointerUp={endDrag}
			onPointerCancel={endDrag}
			onKeyDown={onKeyDown}
			// Duplo clique devolve o padrão: é o desfazer que não exige mirar.
			onDoubleClick={() => api.commit(spec.key, spec.width)}
			className={cn(
				// A alça é ESTREITA e a área de pegada é LARGA (o `after`): mirar 2px
				// com o mouse é um teste de pontaria, não uma interface.
				"absolute inset-y-0 right-0 z-20 w-px cursor-col-resize bg-border transition-colors",
				"after:absolute after:inset-y-0 after:-right-2 after:-left-2 after:content-['']",
				"hover:bg-brand-accent focus-visible:bg-brand-accent focus-visible:outline-none",
				"focus-visible:ring-2 focus-visible:ring-brand-accent/40",
				dragging && "bg-brand-accent",
			)}
		/>
	);
}

/**
 * O container rolável + o `<table>` + o `<colgroup>`.
 *
 * Substitui o `Table` do shadcn (só nas tabelas com coluna congelada) porque
 * aquele esconde o div de rolagem, e é justamente nele que se descobre se a
 * tabela está rolada — o que decide a sombra na borda da última congelada.
 */
export function DataTable({
	specs,
	api,
	children,
	className,
}: {
	specs: readonly ColumnSpec[];
	api: ColumnWidthsApi;
	children: React.ReactNode;
	className?: string;
}) {
	const [scrolled, setScrolled] = useState(false);
	const containerRef = useRef<HTMLDivElement | null>(null);

	// A sombra só aparece quando há o que esconder à esquerda. Sombra permanente
	// vira enfeite; a que acende ao rolar DIZ que existe conteúdo fora da vista.
	useEffect(() => {
		const node = containerRef.current;
		if (!node) {
			return;
		}
		const update = () => setScrolled(node.scrollLeft > 0);
		update();
		node.addEventListener("scroll", update, { passive: true });
		return () => node.removeEventListener("scroll", update);
	}, []);

	return (
		<div
			ref={containerRef}
			data-scrolled={scrolled ? "" : undefined}
			className={cn("group/table relative w-full overflow-x-auto", className)}
		>
			<table
				ref={api.tableRef}
				style={api.style}
				// `fixed` não é detalhe de estilo: sem ele o navegador ignora as
				// larguras e redistribui tudo pelo conteúdo — e aí a conta do
				// deslocamento das congeladas passa a mentir.
				className="w-full min-w-[var(--table-min-width)] table-fixed caption-bottom text-sm"
			>
				<colgroup>
					{specs.map((spec) => (
						<col key={spec.key} style={{ width: `var(--col-${spec.key})` }} />
					))}
					{/* A coluna-sobra. Com `table-fixed`, numa tela mais larga que a
					    soma das colunas o navegador distribuiria o excedente entre
					    TODAS elas — e as congeladas mediriam diferente do que a conta
					    do deslocamento supõe. Esta coluna sem largura absorve a folga
					    sozinha e mantém as demais no pixel pedido. */}
					<col />
				</colgroup>
				{children}
			</table>
		</div>
	);
}

/**
 * As props de uma célula CONGELADA. Devolve classe e estilo juntos porque os
 * dois são inseparáveis: o `left` sem o `position` não gruda, e o `position`
 * sem o fundo opaco deixa o conteúdo rolar POR BAIXO, visível.
 *
 * `bg-inherit` e não uma cor fixa: a linha muda de fundo ao passar o mouse e ao
 * ser selecionada, e uma célula com cor própria ficaria como um retalho parado
 * no meio da linha inteira acesa.
 */
export function pinnedProps(
	specs: readonly ColumnSpec[],
	key: string,
	options?: { header?: boolean },
): { className: string; style?: CSSProperties } {
	const pinned = pinnedKeys(specs);
	const index = pinned.indexOf(key);
	if (index === -1) {
		return { className: "" };
	}
	const last = index === pinned.length - 1;
	return {
		style: { left: `var(--pin-${key})` },
		className: cn(
			"sticky bg-inherit",
			options?.header ? "z-20" : "z-10",
			// A sombra vai só na ÚLTIMA congelada: é a fronteira entre o que fica
			// e o que rola. Nas outras, seria uma listra no meio do bloco parado.
			last &&
				"after:absolute after:inset-y-0 after:right-0 after:w-4 after:translate-x-full after:bg-gradient-to-r after:from-black/12 after:to-transparent after:opacity-0 after:transition-opacity after:content-[''] group-data-[scrolled]/table:after:opacity-100 dark:after:from-black/40",
		),
	};
}
