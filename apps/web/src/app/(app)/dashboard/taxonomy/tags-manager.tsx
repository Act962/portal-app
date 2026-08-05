"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

import { trpc } from "@/utils/trpc";

export function TagsManager() {
	const queryClient = useQueryClient();
	const tags = useQuery(trpc.taxonomy.tags.list.queryOptions());

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: trpc.taxonomy.tags.list.queryKey() });

	const create = useMutation(trpc.taxonomy.tags.create.mutationOptions({ onSuccess: invalidate }));
	const rename = useMutation(trpc.taxonomy.tags.rename.mutationOptions({ onSuccess: invalidate }));
	const remove = useMutation(trpc.taxonomy.tags.delete.mutationOptions({ onSuccess: invalidate }));
	const merge = useMutation(trpc.taxonomy.tags.merge.mutationOptions({ onSuccess: invalidate }));

	const [name, setName] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draft, setDraft] = useState("");
	const [sourceId, setSourceId] = useState("");
	const [targetId, setTargetId] = useState("");

	const list = tags.data ?? [];

	if (tags.isLoading) {
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
					create.mutate({ name });
					setName("");
				}}
			>
				<input
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Nova tag"
					className="rounded border px-2 py-1 text-sm"
				/>
				<button type="submit" className="rounded bg-brand-red px-3 py-1 text-sm text-white">
					Adicionar
				</button>
			</form>

			<ul className="mb-6 divide-y">
				{list.map((tag) => (
					<li key={tag.id} className="flex items-center gap-3 py-2 text-sm">
						{editingId === tag.id ? (
							<>
								<input
									value={draft}
									onChange={(event) => setDraft(event.target.value)}
									className="rounded border px-2 py-1"
								/>
								<button
									type="button"
									className="underline"
									onClick={() => {
										rename.mutate({ id: tag.id, name: draft });
										setEditingId(null);
									}}
								>
									Salvar
								</button>
								<button type="button" className="text-ink-muted underline" onClick={() => setEditingId(null)}>
									Cancelar
								</button>
							</>
						) : (
							<>
								<span className="flex-1">
									{tag.name} <span className="text-ink-muted">/{tag.slug}</span>
								</span>
								<button
									type="button"
									className="underline"
									onClick={() => {
										setEditingId(tag.id);
										setDraft(tag.name);
									}}
								>
									Renomear
								</button>
								<button
									type="button"
									className="text-brand-red underline"
									onClick={() => remove.mutate({ id: tag.id })}
								>
									Excluir
								</button>
							</>
						)}
					</li>
				))}
			</ul>

			<fieldset className="rounded border p-3">
				<legend className="px-1 text-sm">Mesclar duplicadas</legend>
				<div className="flex flex-wrap items-center gap-2 text-sm">
					<select
						value={sourceId}
						onChange={(event) => setSourceId(event.target.value)}
						className="rounded border px-2 py-1"
						aria-label="Tag de origem"
					>
						<option value="">origem…</option>
						{list.map((tag) => (
							<option key={tag.id} value={tag.id}>
								{tag.name}
							</option>
						))}
					</select>
					<span>→</span>
					<select
						value={targetId}
						onChange={(event) => setTargetId(event.target.value)}
						className="rounded border px-2 py-1"
						aria-label="Tag de destino"
					>
						<option value="">destino…</option>
						{list.map((tag) => (
							<option key={tag.id} value={tag.id}>
								{tag.name}
							</option>
						))}
					</select>
					<button
						type="button"
						disabled={!sourceId || !targetId || sourceId === targetId}
						className="rounded border px-3 py-1 disabled:opacity-30"
						onClick={() => {
							merge.mutate({ sourceId, targetId });
							setSourceId("");
							setTargetId("");
						}}
					>
						Mesclar
					</button>
				</div>
			</fieldset>
		</div>
	);
}
