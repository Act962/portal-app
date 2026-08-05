"use client";

import type { EditorialStatus } from "@portal-app/editorial";
import { Button } from "@portal-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@portal-app/ui/components/card";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import type { Route } from "next";
import Link from "next/link";
import { CheckCircle2, Clock, FileText, PenLine } from "lucide-react";

import { StatusBadge } from "@/components/admin/status-badge";
import { trpc } from "@/utils/trpc";

const articleHref = (id: string) => `/dashboard/articles/${id}` as Route;

/** Cartões do topo: o que a redação precisa saber em três segundos. */
const CARDS = [
	{
		key: "PUBLICADA" as const,
		label: "No ar",
		icon: CheckCircle2,
		hint: "matérias publicadas",
	},
	{
		key: "EM_REVISAO" as const,
		label: "Aguardando revisão",
		icon: Clock,
		hint: "esperando um editor",
	},
	{
		key: "RASCUNHO" as const,
		label: "Rascunhos",
		icon: PenLine,
		hint: "em produção",
	},
	{
		key: "AGENDADA" as const,
		label: "Agendadas",
		icon: FileText,
		hint: "com data marcada",
	},
];

export function DashboardOverview({ role }: { role: string }) {
	const list = useQuery(trpc.editorial.articles.list.queryOptions({}));
	const articles = list.data ?? [];

	const countOf = (status: EditorialStatus) =>
		articles.filter((a) =>
			status === "PUBLICADA"
				? a.status === "PUBLICADA" || a.status === "ATUALIZADA"
				: a.status === status,
		).length;

	// A lista já vem ordenada do repositório; aqui é só o recorte do topo.
	const recent = articles.slice(0, 6);

	return (
		<div className="flex flex-col gap-6">
			<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
				{CARDS.map((card) => (
					<Card key={card.key}>
						<CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
							<CardTitle className="font-medium text-sm">{card.label}</CardTitle>
							<card.icon className="size-4 text-muted-foreground" />
						</CardHeader>
						<CardContent>
							{list.isLoading ? (
								<Skeleton className="h-8 w-12" />
							) : (
								<div className="font-bold text-2xl">{countOf(card.key)}</div>
							)}
							<p className="text-muted-foreground text-xs">{card.hint}</p>
						</CardContent>
					</Card>
				))}
			</div>

			<Card>
				<CardHeader className="flex flex-row items-center justify-between">
					<div>
						<CardTitle>Atividade recente</CardTitle>
						<CardDescription>
							As últimas matérias mexidas na redação.
						</CardDescription>
					</div>
					{/* `nativeButton={false}`: o Base UI avisa quando um controle de
					    botão não renderiza um <button> nativo — aqui é um link. */}
					<Button
						variant="outline"
						size="sm"
						nativeButton={false}
						render={<Link href="/dashboard/articles" />}
					>
						Ver todas
					</Button>
				</CardHeader>
				<CardContent>
					{list.isLoading ? (
						<div className="flex flex-col gap-3">
							{["a", "b", "c"].map((k) => (
								<Skeleton key={k} className="h-12 w-full" />
							))}
						</div>
					) : recent.length === 0 ? (
						<div className="py-8 text-center">
							<p className="font-medium">Nenhuma matéria ainda.</p>
							<p className="mt-1 text-muted-foreground text-sm">
								Comece criando a primeira.
							</p>
							<Button
								className="mt-4"
								nativeButton={false}
								render={<Link href="/dashboard/articles" />}
							>
								Criar matéria
							</Button>
						</div>
					) : (
						<ul className="divide-y">
							{recent.map((article) => (
								<li key={article.id}>
									<Link
										href={articleHref(article.id)}
										className="flex items-center justify-between gap-3 py-3 hover:bg-muted/50"
									>
										<span className="min-w-0 flex-1 truncate font-medium text-sm">
											{article.headline}
										</span>
										<StatusBadge status={article.status as EditorialStatus} />
									</Link>
								</li>
							))}
						</ul>
					)}
				</CardContent>
			</Card>

			<p className="text-muted-foreground text-xs">
				Você está conectado como <strong>{role}</strong>.
			</p>
		</div>
	);
}
