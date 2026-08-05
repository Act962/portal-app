"use client";
import { EDITORIAL_STATUSES } from "@portal-app/editorial";
import { useMutation, useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

const articleHref = (id: string) => `/dashboard/articles/${id}` as Route;

import { trpc } from "@/utils/trpc";

export function ArticlesList() {
	const router = useRouter();
	const [status, setStatus] = useState<string>("");
	const [headline, setHeadline] = useState("");

	const list = useQuery(
		trpc.editorial.articles.list.queryOptions(
			status ? { status: status as (typeof EDITORIAL_STATUSES)[number] } : {},
		),
	);
	const create = useMutation(
		trpc.editorial.articles.create.mutationOptions({
			onSuccess: (article) => router.push(articleHref(article.id)),
		}),
	);

	return (
		<div>
			<form
				className="mb-4 flex flex-wrap gap-2"
				onSubmit={(e) => {
					e.preventDefault();
					if (headline.trim()) {
						create.mutate({ headline });
					}
				}}
			>
				<input
					value={headline}
					onChange={(e) => setHeadline(e.target.value)}
					placeholder="Título da nova matéria"
					className="flex-1 rounded border px-2 py-1 text-sm"
				/>
				<button type="submit" className="rounded bg-brand-red px-3 py-1 text-sm text-white">
					Nova matéria
				</button>
			</form>

			<div className="mb-3">
				<select
					value={status}
					onChange={(e) => setStatus(e.target.value)}
					className="rounded border px-2 py-1 text-sm"
				>
					<option value="">Todos os status</option>
					{EDITORIAL_STATUSES.map((s) => (
						<option key={s} value={s}>
							{s}
						</option>
					))}
				</select>
			</div>

			{list.isLoading ? (
				<p>Carregando…</p>
			) : list.data && list.data.length > 0 ? (
				<table className="w-full border-collapse text-sm">
					<thead>
						<tr className="border-b text-left">
							<th className="py-2">Título</th>
							<th className="py-2">Status</th>
							<th className="py-2">Autor</th>
							<th className="py-2" />
						</tr>
					</thead>
					<tbody>
						{list.data.map((article) => (
							<tr key={article.id} className="border-b">
								<td className="py-2">{article.headline}</td>
								<td className="py-2 text-ink-muted">{article.status}</td>
								<td className="py-2 text-ink-muted">{article.byline.name}</td>
								<td className="py-2">
									<Link href={articleHref(article.id)} className="text-brand-red underline">
										Editar
									</Link>
								</td>
							</tr>
						))}
					</tbody>
				</table>
			) : (
				<p className="text-ink-muted">Nenhuma matéria ainda.</p>
			)}
		</div>
	);
}
