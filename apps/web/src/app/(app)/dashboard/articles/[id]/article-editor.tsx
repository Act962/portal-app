"use client";
import type { Block } from "@portal-app/editorial";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";

import { BlockEditor } from "@/components/editorial/block-editor";
import { BlockRenderer } from "@/components/editorial/block-renderer";
import { trpc } from "@/utils/trpc";

export function ArticleEditor({ id }: { id: string }) {
	const queryClient = useQueryClient();
	const article = useQuery(trpc.editorial.articles.get.queryOptions({ id }));
	const sections = useQuery(trpc.taxonomy.sections.list.queryOptions());
	const media = useQuery(trpc.media.library.queryOptions({}));

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: trpc.editorial.articles.get.queryKey({ id }) });

	const update = useMutation(trpc.editorial.articles.update.mutationOptions());
	const submit = useMutation(trpc.editorial.articles.submit.mutationOptions({ onSuccess: invalidate }));
	const approve = useMutation(trpc.editorial.articles.approve.mutationOptions({ onSuccess: invalidate }));
	const reject = useMutation(trpc.editorial.articles.reject.mutationOptions({ onSuccess: invalidate }));
	const publish = useMutation(trpc.editorial.articles.publish.mutationOptions({ onSuccess: invalidate }));
	const schedule = useMutation(trpc.editorial.articles.schedule.mutationOptions({ onSuccess: invalidate }));
	const cancelSchedule = useMutation(
		trpc.editorial.articles.cancelSchedule.mutationOptions({ onSuccess: invalidate }),
	);
	const archive = useMutation(trpc.editorial.articles.archive.mutationOptions({ onSuccess: invalidate }));

	const [headline, setHeadline] = useState("");
	const [kicker, setKicker] = useState("");
	const [standfirst, setStandfirst] = useState("");
	const [sectionId, setSectionId] = useState("");
	const [coverId, setCoverId] = useState("");
	const [blocks, setBlocks] = useState<Block[]>([]);
	const [preview, setPreview] = useState(false);
	const [reason, setReason] = useState("");
	const [at, setAt] = useState("");
	const [savedAt, setSavedAt] = useState<string | null>(null);

	const loaded = useRef(false);
	const status = article.data?.status;

	// Preenche o formulário uma vez, quando a matéria carrega.
	useEffect(() => {
		if (article.data && !loaded.current) {
			loaded.current = true;
			setHeadline(article.data.headline);
			setKicker(article.data.kicker);
			setStandfirst(article.data.standfirst);
			setSectionId(article.data.sectionId ?? "");
			setCoverId(article.data.cover?.mediaId ?? "");
			setBlocks([...article.data.body] as Block[]);
		}
	}, [article.data]);

	const imageUrls: Record<string, string> = {};
	for (const asset of media.data ?? []) {
		imageUrls[asset.id] = asset.url;
	}
	const mediaOptions = (media.data ?? []).map((a) => ({ id: a.id, label: a.filename }));

	// Autosave: 1s depois da última alteração, grava o conteúdo.
	const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
	useEffect(() => {
		if (!loaded.current) {
			return;
		}
		if (timer.current) {
			clearTimeout(timer.current);
		}
		timer.current = setTimeout(() => {
			const cover = coverId
				? {
						mediaId: coverId,
						altText: media.data?.find((m) => m.id === coverId)?.altText ?? "",
					}
				: null;
			update.mutate(
				{
					id,
					headline,
					kicker,
					standfirst,
					sectionId: sectionId || null,
					cover,
					body: blocks,
				},
				{
					onSuccess: () => {
						setSavedAt(new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }));
						invalidate();
					},
				},
			);
		}, 1000);
		return () => {
			if (timer.current) {
				clearTimeout(timer.current);
			}
		};
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [headline, kicker, standfirst, sectionId, coverId, blocks]);

	if (article.isLoading) {
		return <p>Carregando…</p>;
	}
	if (!article.data) {
		return <p>Matéria não encontrada.</p>;
	}

	const pendencias = article.data.pendencias;

	return (
		<div>
			<div className="mb-4 flex items-center justify-between">
				<span className="rounded bg-neutral-200 px-2 py-1 font-medium text-xs">{status}</span>
				<span className="text-ink-muted text-xs">
					{update.isPending ? "salvando…" : savedAt ? `salvo às ${savedAt}` : ""}
				</span>
			</div>

			{/* Metadados */}
			<input
				value={headline}
				onChange={(e) => setHeadline(e.target.value)}
				placeholder="Título"
				className="mb-2 w-full rounded border px-3 py-2 font-bold text-lg"
			/>
			<input
				value={kicker}
				onChange={(e) => setKicker(e.target.value)}
				placeholder="Chapéu"
				className="mb-2 w-full rounded border px-2 py-1 text-sm"
			/>
			<input
				value={standfirst}
				onChange={(e) => setStandfirst(e.target.value)}
				placeholder="Linha fina"
				className="mb-2 w-full rounded border px-2 py-1 text-sm"
			/>
			<div className="mb-4 flex flex-wrap gap-2">
				<select
					value={sectionId}
					onChange={(e) => setSectionId(e.target.value)}
					className="rounded border px-2 py-1 text-sm"
				>
					<option value="">— editoria —</option>
					{(sections.data ?? []).map((s) => (
						<option key={s.id} value={s.id}>
							{s.name}
						</option>
					))}
				</select>
				<select
					value={coverId}
					onChange={(e) => setCoverId(e.target.value)}
					className="rounded border px-2 py-1 text-sm"
				>
					<option value="">— capa —</option>
					{(media.data ?? []).map((m) => (
						<option key={m.id} value={m.id}>
							{m.filename}
						</option>
					))}
				</select>
				<button
					type="button"
					onClick={() => setPreview((p) => !p)}
					className="rounded border px-3 py-1 text-sm"
				>
					{preview ? "Editar" : "Pré-visualizar"}
				</button>
			</div>

			{/* Corpo */}
			{preview ? (
				<article className="rounded border p-4">
					{kicker ? <p className="font-bold text-brand-red text-sm uppercase">{kicker}</p> : null}
					<h1 className="font-bold text-2xl">{headline}</h1>
					{standfirst ? <p className="mt-1 text-ink-muted">{standfirst}</p> : null}
					<BlockRenderer blocks={blocks} imageUrls={imageUrls} />
				</article>
			) : (
				<BlockEditor blocks={blocks} onChange={setBlocks} mediaOptions={mediaOptions} />
			)}

			{/* Pendências de publicação (A04) */}
			{pendencias.length > 0 ? (
				<ul className="mt-4 rounded border border-brand-red/40 bg-brand-red/5 p-3 text-sm">
					{pendencias.map((p) => (
						<li key={p}>⚠️ {p}</li>
					))}
				</ul>
			) : null}

			{/* Ações do workflow */}
			<div className="mt-6 flex flex-wrap items-center gap-2 border-t pt-4">
				{status === "RASCUNHO" ? (
					<Action label="Enviar para revisão" onClick={() => submit.mutate({ id })} />
				) : null}

				{status === "EM_REVISAO" ? (
					<>
						<Action label="Aprovar" onClick={() => approve.mutate({ id })} />
						<input
							value={reason}
							onChange={(e) => setReason(e.target.value)}
							placeholder="Motivo da devolução"
							className="rounded border px-2 py-1 text-sm"
						/>
						<Action label="Devolver" onClick={() => reject.mutate({ id, reason })} />
					</>
				) : null}

				{status === "APROVADA" ? (
					<>
						<Action label="Publicar" onClick={() => publish.mutate({ id })} />
						<input
							type="datetime-local"
							value={at}
							onChange={(e) => setAt(e.target.value)}
							className="rounded border px-2 py-1 text-sm"
						/>
						<Action label="Agendar" onClick={() => at && schedule.mutate({ id, at: new Date(at) })} />
					</>
				) : null}

				{status === "AGENDADA" ? (
					<>
						<span className="text-ink-muted text-sm">
							agendada para {article.data.scheduledAt ? new Date(article.data.scheduledAt).toLocaleString("pt-BR") : ""}
						</span>
						<Action label="Cancelar agendamento" onClick={() => cancelSchedule.mutate({ id })} />
						<Action label="Publicar agora" onClick={() => publish.mutate({ id })} />
					</>
				) : null}

				{status === "PUBLICADA" || status === "ATUALIZADA" ? (
					<Action label="Arquivar" onClick={() => archive.mutate({ id })} />
				) : null}
			</div>
		</div>
	);
}

function Action({ label, onClick }: { label: string; onClick: () => void }) {
	return (
		<button type="button" onClick={onClick} className="rounded bg-brand-red px-3 py-1 text-sm text-white">
			{label}
		</button>
	);
}
