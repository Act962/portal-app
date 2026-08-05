"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { trpc } from "@/utils/trpc";

export function SectionsManager() {
	const queryClient = useQueryClient();
	const sections = useQuery(trpc.taxonomy.sections.list.queryOptions());

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: trpc.taxonomy.sections.list.queryKey() });

	const create = useMutation(
		trpc.taxonomy.sections.create.mutationOptions({ onSuccess: invalidate }),
	);
	const setActive = useMutation(
		trpc.taxonomy.sections.setActive.mutationOptions({ onSuccess: invalidate }),
	);
	const remove = useMutation(
		trpc.taxonomy.sections.delete.mutationOptions({ onSuccess: invalidate }),
	);
	const reorder = useMutation(
		trpc.taxonomy.sections.reorder.mutationOptions({ onSuccess: invalidate }),
	);

	const [name, setName] = useState("");
	const [color, setColor] = useState("#2563eb");

	const list = sections.data ?? [];

	// Sobe/desce trocando a posição e persistindo a nova ordem completa. O
	// arrastar-e-soltar é um refinamento de UX; a reordenação já é funcional.
	const move = (index: number, direction: -1 | 1) => {
		const target = index + direction;
		if (target < 0 || target >= list.length) {
			return;
		}
		const next = [...list];
		const [moved] = next.splice(index, 1);
		next.splice(target, 0, moved);
		reorder.mutate({ orders: next.map((section, order) => ({ id: section.id, order })) });
	};

	if (sections.isLoading) {
		return <p>Carregando…</p>;
	}

	return (
		<div>
			<form
				className="mb-4 flex flex-wrap items-center gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					if (!name.trim()) {
						return;
					}
					create.mutate({ name, color });
					setName("");
				}}
			>
				<input
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Nova editoria"
					className="rounded border px-2 py-1 text-sm"
				/>
				<input
					type="color"
					value={color}
					onChange={(event) => setColor(event.target.value)}
					aria-label="Cor da editoria"
					className="h-8 w-10 rounded border"
				/>
				<button type="submit" className="rounded bg-brand-red px-3 py-1 text-sm text-white">
					Adicionar
				</button>
			</form>

			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-b text-left">
						<th className="py-2">Ordem</th>
						<th className="py-2">Nome</th>
						<th className="py-2">Slug</th>
						<th className="py-2">Status</th>
						<th className="py-2">Ações</th>
					</tr>
				</thead>
				<tbody>
					{list.map((section, index) => (
						<tr key={section.id} className="border-b">
							<td className="py-2">
								<button
									type="button"
									onClick={() => move(index, -1)}
									disabled={index === 0}
									aria-label="Subir"
									className="px-1 disabled:opacity-30"
								>
									↑
								</button>
								<button
									type="button"
									onClick={() => move(index, 1)}
									disabled={index === list.length - 1}
									aria-label="Descer"
									className="px-1 disabled:opacity-30"
								>
									↓
								</button>
							</td>
							<td className="py-2">
								<span
									className="mr-2 inline-block h-3 w-3 rounded-full align-middle"
									style={{ backgroundColor: section.color ?? "transparent" }}
								/>
								{section.name}
							</td>
							<td className="py-2 text-ink-muted">{section.slug}</td>
							<td className="py-2">{section.active ? "ativa" : "inativa"}</td>
							<td className="flex gap-3 py-2">
								<button
									type="button"
									className="underline"
									onClick={() =>
										setActive.mutate({ id: section.id, active: !section.active })
									}
								>
									{section.active ? "Desativar" : "Reativar"}
								</button>
								<button
									type="button"
									className="text-brand-red underline"
									onClick={() => remove.mutate({ id: section.id })}
								>
									Excluir
								</button>
							</td>
						</tr>
					))}
				</tbody>
			</table>
		</div>
	);
}
