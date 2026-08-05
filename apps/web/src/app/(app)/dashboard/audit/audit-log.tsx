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
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";

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
	const audit = useQuery(trpc.editorial.audit.list.queryOptions());
	const articles = useQuery(trpc.editorial.articles.list.queryOptions({}));

	const headlineOf = (id: string) =>
		articles.data?.find((a) => a.id === id)?.headline;

	const entries = audit.data ?? [];

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
							const headline = headlineOf(entry.aggregateId);
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
		</div>
	);
}
