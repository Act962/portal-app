"use client";

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
import { useState } from "react";

import { BarList } from "@/components/admin/insights/bar-list";
import { ViewsChart } from "@/components/admin/insights/views-chart";
import {
	formatDuration,
	formatSource,
	rangeForDays,
} from "@/lib/insights-format";
import { trpc } from "@/utils/trpc";

const PRESETS = [
	{ days: 7, label: "7 dias" },
	{ days: 30, label: "30 dias" },
	{ days: 90, label: "90 dias" },
] as const;

export function InsightsDashboard() {
	const [days, setDays] = useState<number>(7);
	// O intervalo é derivado do preset no render; como `days` só muda por
	// clique, o relógio não precisa ser estado.
	const range = rangeForDays(days, new Date());

	const summary = useQuery(
		trpc.analytics.summary.queryOptions({
			from: range.from.toISOString(),
			to: range.to.toISOString(),
		}),
	);

	const data = summary.data;

	return (
		<div className="flex flex-col gap-4">
			{/* Filtros em UMA linha acima dos gráficos. */}
			<div className="flex flex-wrap items-center gap-2">
				{PRESETS.map((preset) => (
					<Button
						key={preset.days}
						type="button"
						size="sm"
						variant={days === preset.days ? "default" : "outline"}
						onClick={() => setDays(preset.days)}
					>
						{preset.label}
					</Button>
				))}
			</div>

			{summary.isLoading ? (
				<div className="grid gap-4 md:grid-cols-3">
					{["a", "b", "c"].map((k) => (
						<Skeleton key={k} className="h-24 w-full" />
					))}
				</div>
			) : null}

			{summary.isError ? (
				<Card>
					<CardContent className="py-8 text-center text-muted-foreground text-sm">
						Não foi possível carregar os insights agora.
					</CardContent>
				</Card>
			) : null}

			{data ? (
				<>
					{/* KPI row: números-manchete são TILE, não gráfico de uma barra. */}
					<div className="grid gap-4 md:grid-cols-3">
						<StatTile
							label="Visualizações"
							value={data.totalViews.toLocaleString("pt-BR")}
						/>
						<StatTile
							label="Tempo médio de leitura"
							value={formatDuration(data.averageReadingSeconds)}
							hint={
								data.averageReadingSeconds === null
									? "Ainda sem leitura medida no período"
									: undefined
							}
						/>
						<StatTile
							label="Matérias publicadas"
							value={data.production.bySection
								.reduce((total, item) => total + item.articles, 0)
								.toLocaleString("pt-BR")}
						/>
					</div>

					<Card>
						<CardHeader>
							<CardTitle className="text-base">Visualizações por dia</CardTitle>
							<CardDescription>
								Cada visita à página de uma matéria, no fuso de Teresina.
							</CardDescription>
						</CardHeader>
						<CardContent>
							<ViewsChart data={data.viewsByDay} />
						</CardContent>
					</Card>

					<div className="grid gap-4 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle className="text-base">Origem do tráfego</CardTitle>
								<CardDescription>
									De onde vinha quem abriu uma matéria.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<BarList
									items={data.viewsBySource.map((item) => ({
										key: item.source,
										label: formatSource(item.source),
										value: item.views,
									}))}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-base">
									Tempo médio por matéria
								</CardTitle>
								<CardDescription>
									As 10 que mais prendem o leitor. Quem sai antes da medição
									fechar não entra na média.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<BarList
									emptyLabel="Nenhuma leitura medida no período."
									items={data.readingTimeByArticle.map((item) => ({
										key: item.articleSlug,
										label: item.articleSlug,
										value: item.averageSeconds,
										hint: formatDuration(item.averageSeconds),
									}))}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-base">Produção por editoria</CardTitle>
								<CardDescription>
									Matérias publicadas no período.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<BarList
									emptyLabel="Nenhuma matéria publicada no período."
									items={data.production.bySection.map((item) => ({
										key: item.name,
										label: item.name,
										value: item.articles,
									}))}
								/>
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-base">Produção por autor</CardTitle>
								<CardDescription>
									Matérias publicadas no período.
								</CardDescription>
							</CardHeader>
							<CardContent>
								<BarList
									emptyLabel="Nenhuma matéria publicada no período."
									items={data.production.byAuthor.map((item) => ({
										key: item.name,
										label: item.name,
										value: item.articles,
									}))}
								/>
							</CardContent>
						</Card>
					</div>
				</>
			) : null}
		</div>
	);
}

/**
 * Tile de número-manchete. Valor em figuras proporcionais (o padrão da fonte):
 * `tabular-nums` num número grande e solto deixa os dígitos frouxos — ele fica
 * reservado para colunas que precisam alinhar.
 */
function StatTile({
	label,
	value,
	hint,
}: {
	label: string;
	value: string;
	hint?: string;
}) {
	return (
		<Card>
			<CardContent className="py-5">
				<p className="text-muted-foreground text-sm">{label}</p>
				<p className="mt-1 font-semibold text-3xl">{value}</p>
				{hint ? (
					<p className="mt-1 text-muted-foreground text-xs">{hint}</p>
				) : null}
			</CardContent>
		</Card>
	);
}
