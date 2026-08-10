"use client";

import { Badge } from "@portal-app/ui/components/badge";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@portal-app/ui/components/table";
import { DEFAULT_PAGE_SIZE } from "@portal-app/shared-kernel";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";

import { useState } from "react";

import { PaginationBar } from "@/components/admin/pagination-bar";
import { trpc } from "@/utils/trpc";

/** Os eventos do domínio em português — `ArticlePublished` é nome de código. */
const ACTION_LABELS: Record<string, string> = {
	ArticleCreated: "Matéria criada",
	ArticleSubmitted: "Enviada para revisão",
	ArticleApproved: "Aprovada",
	ArticleRejected: "Devolvida ao redator",
	ArticlePublished: "Publicada",
	ArticleScheduled: "Agendada",
	ArticleScheduleCancelled: "Agendamento cancelado",
	ArticleUpdated: "Atualizada",
	ArticleArchived: "Arquivada",
	ArticleUnpublished: "Despublicada",
};

export function AuditLog() {
	const [page, setPage] = useState(1);
	const audit = useQuery(trpc.editorial.audit.list.queryOptions({ page }));

	// O título vem RESOLVIDO do servidor. Antes esta tela cruzava o
	// `aggregateId` contra a lista de matérias no cliente — o que só funcionava
	// enquanto aquela lista viesse inteira. Paginada, o título sumiria para tudo
	// que estivesse fora da primeira página.
	const entries = audit.data?.items ?? [];
	const total = audit.data?.total ?? 0;
	const perPage = audit.data?.perPage ?? DEFAULT_PAGE_SIZE;

	return (
		<div className="rounded-lg border">
			<Table>
				<TableHeader>
					<TableRow>
						<TableHead className="w-48">Quando</TableHead>
						<TableHead className="w-56">O que aconteceu</TableHead>
						<TableHead>Matéria</TableHead>
					</TableRow>
				</TableHeader>
				<TableBody>
					{audit.isLoading ? (
						["a", "b", "c", "d"].map((k) => (
							<TableRow key={k}>
								<TableCell colSpan={3}>
									<Skeleton className="h-6 w-full" />
								</TableCell>
							</TableRow>
						))
					) : entries.length === 0 ? (
						<TableRow>
							<TableCell colSpan={3} className="py-12 text-center">
								<p className="font-medium">Nenhum evento registrado ainda.</p>
								<p className="mt-1 text-muted-foreground text-sm">
									Cada publicação, aprovação e devolução aparece aqui.
								</p>
							</TableCell>
						</TableRow>
					) : (
						entries.map((entry) => {
							const headline = entry.headline;
							return (
								<TableRow key={entry.id}>
									<TableCell className="text-muted-foreground">
										{new Date(entry.createdAt).toLocaleString("pt-BR")}
									</TableCell>
									<TableCell>
										<Badge variant="secondary">
											{ACTION_LABELS[entry.action] ?? entry.action}
										</Badge>
									</TableCell>
									<TableCell>
										{headline ? (
											<Link
												href={
													`/dashboard/articles/${entry.aggregateId}` as Route
												}
												className="font-medium hover:underline"
											>
												{headline}
											</Link>
										) : (
											<span className="text-muted-foreground text-xs">
												{entry.aggregateId}
											</span>
										)}
									</TableCell>
								</TableRow>
							);
						})
					)}
				</TableBody>
			</Table>

			<PaginationBar
				page={page}
				perPage={perPage}
				total={total}
				onPageChange={setPage}
				unidade={{ singular: "registro", plural: "registros" }}
			/>
		</div>
	);
}
