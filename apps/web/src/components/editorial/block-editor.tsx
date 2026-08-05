"use client";
import type { Block } from "@portal-app/editorial";

type MediaOption = { id: string; label: string };

const BLOCK_LABELS: Record<Block["type"], string> = {
	paragraph: "Parágrafo",
	heading: "Título",
	image: "Imagem",
	list: "Lista",
	quote: "Citação",
	embed: "Embed",
};

/** Cria um bloco vazio do tipo pedido. */
function emptyBlock(type: Block["type"]): Block {
	switch (type) {
		case "paragraph":
			return { type, text: "" };
		case "heading":
			return { type, level: 2, text: "" };
		case "image":
			return { type, mediaId: "", caption: "" };
		case "list":
			return { type, ordered: false, items: [""] };
		case "quote":
			return { type, text: "", cite: "" };
		case "embed":
			return { type, url: "" };
	}
}

/**
 * Editor de blocos estruturado — produz exatamente a união do domínio (D1). O
 * rich-text (TipTap) sobre parágrafo/título é o refinamento seguinte; aqui o
 * modelo de blocos já funciona ponta a ponta (edição → JSON → preview → publica).
 */
export function BlockEditor({
	blocks,
	onChange,
	mediaOptions,
}: {
	blocks: Block[];
	onChange: (blocks: Block[]) => void;
	mediaOptions: MediaOption[];
}) {
	const update = (index: number, block: Block) => {
		const next = [...blocks];
		next[index] = block;
		onChange(next);
	};
	const remove = (index: number) => onChange(blocks.filter((_, i) => i !== index));
	const move = (index: number, dir: -1 | 1) => {
		const target = index + dir;
		if (target < 0 || target >= blocks.length) {
			return;
		}
		const next = [...blocks];
		[next[index], next[target]] = [next[target], next[index]];
		onChange(next);
	};
	const add = (type: Block["type"]) => onChange([...blocks, emptyBlock(type)]);

	return (
		<div className="flex flex-col gap-3">
			{blocks.map((block, index) => (
				<div key={index} className="rounded border p-3">
					<div className="mb-2 flex items-center justify-between">
						<span className="font-medium text-ink-muted text-xs uppercase">
							{BLOCK_LABELS[block.type]}
						</span>
						<div className="flex gap-1 text-sm">
							<button type="button" onClick={() => move(index, -1)} aria-label="Subir" className="px-1">
								↑
							</button>
							<button type="button" onClick={() => move(index, 1)} aria-label="Descer" className="px-1">
								↓
							</button>
							<button
								type="button"
								onClick={() => remove(index)}
								className="px-1 text-brand-red"
								aria-label="Remover"
							>
								✕
							</button>
						</div>
					</div>
					<BlockFields block={block} onChange={(b) => update(index, b)} mediaOptions={mediaOptions} />
				</div>
			))}

			<div className="flex flex-wrap gap-2">
				{(Object.keys(BLOCK_LABELS) as Block["type"][]).map((type) => (
					<button
						key={type}
						type="button"
						onClick={() => add(type)}
						className="rounded border px-2 py-1 text-sm"
					>
						+ {BLOCK_LABELS[type]}
					</button>
				))}
			</div>
		</div>
	);
}

function BlockFields({
	block,
	onChange,
	mediaOptions,
}: {
	block: Block;
	onChange: (block: Block) => void;
	mediaOptions: MediaOption[];
}) {
	const input = "w-full rounded border px-2 py-1 text-sm";

	switch (block.type) {
		case "paragraph":
			return (
				<textarea
					className={input}
					rows={3}
					value={block.text}
					onChange={(e) => onChange({ ...block, text: e.target.value })}
				/>
			);
		case "heading":
			return (
				<div className="flex gap-2">
					<select
						value={block.level}
						onChange={(e) => onChange({ ...block, level: Number(e.target.value) as 2 | 3 })}
						className="rounded border px-2 py-1 text-sm"
					>
						<option value={2}>H2</option>
						<option value={3}>H3</option>
					</select>
					<input
						className={input}
						value={block.text}
						onChange={(e) => onChange({ ...block, text: e.target.value })}
					/>
				</div>
			);
		case "image":
			return (
				<div className="flex flex-col gap-2">
					<select
						value={block.mediaId}
						onChange={(e) => onChange({ ...block, mediaId: e.target.value })}
						className="rounded border px-2 py-1 text-sm"
					>
						<option value="">selecione a imagem…</option>
						{mediaOptions.map((m) => (
							<option key={m.id} value={m.id}>
								{m.label}
							</option>
						))}
					</select>
					<input
						className={input}
						placeholder="Legenda (opcional)"
						value={block.caption ?? ""}
						onChange={(e) => onChange({ ...block, caption: e.target.value })}
					/>
				</div>
			);
		case "list":
			return (
				<div className="flex flex-col gap-2">
					<label className="flex items-center gap-2 text-sm">
						<input
							type="checkbox"
							checked={block.ordered}
							onChange={(e) => onChange({ ...block, ordered: e.target.checked })}
						/>
						Numerada
					</label>
					<textarea
						className={input}
						rows={3}
						placeholder="Um item por linha"
						value={block.items.join("\n")}
						onChange={(e) => onChange({ ...block, items: e.target.value.split("\n") })}
					/>
				</div>
			);
		case "quote":
			return (
				<div className="flex flex-col gap-2">
					<textarea
						className={input}
						rows={2}
						value={block.text}
						onChange={(e) => onChange({ ...block, text: e.target.value })}
					/>
					<input
						className={input}
						placeholder="Autor da citação (opcional)"
						value={block.cite ?? ""}
						onChange={(e) => onChange({ ...block, cite: e.target.value })}
					/>
				</div>
			);
		case "embed":
			return (
				<input
					className={input}
					placeholder="https://…"
					value={block.url}
					onChange={(e) => onChange({ ...block, url: e.target.value })}
				/>
			);
	}
}
