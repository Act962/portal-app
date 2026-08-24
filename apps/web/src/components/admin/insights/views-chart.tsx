"use client";

import { useState } from "react";

import { formatDayLabel } from "@/lib/insights-format";

import { yAxisTicks } from "./scale";

type Point = { day: string; views: number };

const WIDTH = 720;
const HEIGHT = 200;
const PAD = { top: 16, right: 16, bottom: 24, left: 40 };

/**
 * Série diária de visualizações. Linha (não barras) porque o trabalho do
 * leitor aqui é ver TENDÊNCIA ao longo do tempo.
 *
 * Série única → sem legenda (o título do bloco já diz o que é) e uma cor só,
 * `--chart-3`, validada ≥3:1 contra as superfícies clara e escura.
 *
 * SVG com `viewBox` e `preserveAspectRatio` em vez de medir o container: o
 * gráfico escala sozinho com a largura disponível, sem `ResizeObserver` nem
 * um segundo render.
 */
export function ViewsChart({ data }: { data: Point[] }) {
	const [hover, setHover] = useState<number | null>(null);

	if (data.length === 0) {
		return (
			<p className="py-10 text-center text-muted-foreground text-sm">
				Sem visualizações no período.
			</p>
		);
	}

	const plotWidth = WIDTH - PAD.left - PAD.right;
	const plotHeight = HEIGHT - PAD.top - PAD.bottom;
	// Teto mínimo 1 para um período todo zerado não virar divisão por zero (e
	// para a linha de base não colar no topo).
	const max = Math.max(...data.map((point) => point.views), 1);

	const x = (index: number) =>
		PAD.left +
		(data.length === 1
			? plotWidth / 2
			: (index / (data.length - 1)) * plotWidth);
	const y = (views: number) =>
		PAD.top + plotHeight - (views / max) * plotHeight;

	const line = data.map((point, i) => `${x(i)},${y(point.views)}`).join(" ");
	const area = `${PAD.left},${PAD.top + plotHeight} ${line} ${x(data.length - 1)},${
		PAD.top + plotHeight
	}`;

	const last = data[data.length - 1];
	const active = hover !== null ? data[hover] : null;

	const ticks = yAxisTicks(max);

	return (
		<div className="relative">
			<svg
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				preserveAspectRatio="none"
				className="h-52 w-full"
				role="img"
				aria-label={`Visualizações por dia, de ${formatDayLabel(data[0]?.day ?? "")} a ${formatDayLabel(last?.day ?? "")}`}
			>
				<title>Visualizações por dia</title>

				{/* Grade recessiva: hairline sólida, nunca tracejada. */}
				{ticks.map((tick) => (
					<g key={tick}>
						<line
							x1={PAD.left}
							x2={WIDTH - PAD.right}
							y1={y(tick)}
							y2={y(tick)}
							className="stroke-border"
							strokeWidth={1}
						/>
						<text
							x={PAD.left - 8}
							y={y(tick) + 4}
							textAnchor="end"
							className="fill-muted-foreground text-[10px] tabular-nums"
						>
							{tick}
						</text>
					</g>
				))}

				{/* Área: a MESMA cor da linha a ~10% — um véu, nunca um bloco chapado. */}
				<polygon points={area} className="fill-chart-3/10" />
				<polyline
					points={line}
					fill="none"
					className="stroke-chart-3"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
				/>

				{/* Ponto final: marcador ≥8px com anel na cor da superfície, para
				    continuar legível onde cruza a linha. */}
				{last ? (
					<circle
						cx={x(data.length - 1)}
						cy={y(last.views)}
						r={4}
						className="fill-chart-3 stroke-card"
						strokeWidth={2}
					/>
				) : null}

				{/* Crosshair do ponto sob o cursor. */}
				{active ? (
					<>
						<line
							x1={x(hover as number)}
							x2={x(hover as number)}
							y1={PAD.top}
							y2={PAD.top + plotHeight}
							className="stroke-border"
							strokeWidth={1}
						/>
						<circle
							cx={x(hover as number)}
							cy={y(active.views)}
							r={4}
							className="fill-chart-3 stroke-card"
							strokeWidth={2}
						/>
					</>
				) : null}

				{/* Faixas invisíveis de hover: alvo bem maior que a marca, senão
				    acertar um ponto de raio 4 com o mouse é sorte. */}
				{data.map((point, i) => (
					<rect
						key={point.day}
						x={x(i) - plotWidth / Math.max(data.length - 1, 1) / 2}
						y={PAD.top}
						width={plotWidth / Math.max(data.length - 1, 1)}
						height={plotHeight}
						fill="transparent"
						onMouseEnter={() => setHover(i)}
						onMouseLeave={() => setHover(null)}
					/>
				))}

				{/* Só as pontas do eixo X ganham rótulo: um por dia viraria papa. */}
				<text
					x={PAD.left}
					y={HEIGHT - 6}
					className="fill-muted-foreground text-[10px] tabular-nums"
				>
					{formatDayLabel(data[0]?.day ?? "")}
				</text>
				<text
					x={WIDTH - PAD.right}
					y={HEIGHT - 6}
					textAnchor="end"
					className="fill-muted-foreground text-[10px] tabular-nums"
				>
					{formatDayLabel(last?.day ?? "")}
				</text>
			</svg>

			{active ? (
				<div className="pointer-events-none absolute top-0 right-0 rounded-md border bg-card px-2 py-1 text-xs shadow-sm">
					<span className="font-medium tabular-nums">
						{active.views.toLocaleString("pt-BR")}
					</span>{" "}
					<span className="text-muted-foreground">
						em {formatDayLabel(active.day)}
					</span>
				</div>
			) : null}
		</div>
	);
}
