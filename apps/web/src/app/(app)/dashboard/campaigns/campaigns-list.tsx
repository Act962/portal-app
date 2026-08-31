"use client";

import { AD_SLOT_LABELS, type AdSlot } from "@portal-app/advertising";
import { DEFAULT_PAGE_SIZE } from "@portal-app/shared-kernel";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@portal-app/ui/components/alert-dialog";
import { Button } from "@portal-app/ui/components/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@portal-app/ui/components/dropdown-menu";
import { Input } from "@portal-app/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@portal-app/ui/components/select";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import {
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@portal-app/ui/components/table";
import { cn } from "@portal-app/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	ExternalLink,
	MoreHorizontal,
	Pause,
	Play,
	Plus,
	Search,
	Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import {
	ColumnResizeHandle,
	DataTable,
	pinnedProps,
	useColumnWidths,
} from "@/components/admin/data-table";
import { PaginationBar } from "@/components/admin/pagination-bar";
import { formatLongDate } from "@/lib/format";
import type { ColumnSpec } from "@/lib/table-columns";
import { trpc } from "@/utils/trpc";

import { CampaignDialog } from "./campaign-dialog";
import { CampaignStateBadge } from "./campaign-state-badge";
import { SLOT_OPTIONS } from "./slot-options";

/**
 * Colunas da lista de campanhas. Reaproveita a mesma casca de tabela da lista
 * de matérias — congelada à esquerda e redimensionável.
 *
 * O NOME fica congelado junto com o anunciante porque as duas colunas, juntas,
 * são o sujeito da linha: "Verão 2026" sem "Loja do Zé" não identifica a
 * campanha quando a mesma loja tem três no ar.
 */
const COLUMNS: readonly ColumnSpec[] = [
	{
		key: "campanha",
		width: 300,
		minWidth: 180,
		maxWidth: 560,
		resizable: true,
		pinned: true,
	},
	{ key: "estado", width: 130, minWidth: 110, maxWidth: 180, resizable: true },
	{ key: "posicao", width: 200, minWidth: 140, maxWidth: 320, resizable: true },
	{ key: "periodo", width: 220, minWidth: 160, maxWidth: 340, resizable: true },
	{ key: "alcance", width: 160, minWidth: 120, maxWidth: 280, resizable: true },
	{
		key: "desempenho",
		width: 150,
		minWidth: 120,
		maxWidth: 240,
		resizable: true,
	},
	{ key: "acoes", width: 56, minWidth: 56 },
];

const COLUMNS_STORAGE_KEY = "portal:colunas:campanhas";
const COLUMN_COUNT = COLUMNS.length + 1;
const ALL = "__all__";

const HEADERS = [
	{ key: "campanha", label: "Campanha" },
	{ key: "estado", label: "Estado" },
	{ key: "posicao", label: "Posição" },
	{ key: "periodo", label: "Período" },
	{ key: "alcance", label: "Alcance" },
	{ key: "desempenho", label: "Desempenho" },
] as const;

/** Janela do relatório: os últimos 30 dias. É o recorte que o anunciante pede
 * ("como foi o mês?"), e não o total desde sempre, que só cresce. */
function last30Days(): { from: Date; to: Date } {
	const to = new Date();
	const from = new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
	return { from, to };
}

export function CampaignsList() {
	const queryClient = useQueryClient();
	const columns = useColumnWidths(COLUMNS, COLUMNS_STORAGE_KEY);
	const [slot, setSlot] = useState<string>(ALL);
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [editing, setEditing] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [removing, setRemoving] = useState<{ id: string; name: string } | null>(
		null,
	);

	const list = useQuery(
		trpc.advertising.campaigns.list.queryOptions({
			...(slot === ALL ? {} : { slot: slot as AdSlot }),
			...(search.trim() ? { search: search.trim() } : {}),
			page,
		}),
	);

	const items = list.data?.items ?? [];

	// O desempenho vem numa consulta separada, e não junto da lista: são fontes
	// diferentes (campanha é agregado, contagem é rollup diário) e juntá-las
	// faria toda paginação carregar estatística que nem sempre se olha.
	const window30 = last30Days();
	const stats = useQuery({
		...trpc.advertising.campaigns.stats.queryOptions({
			campaignIds: items.map((item) => item.id),
			from: window30.from,
			to: window30.to,
		}),
		enabled: items.length > 0,
	});
	const statsById = new Map(
		(stats.data ?? []).map((row) => [row.campaignId, row]),
	);

	// biome-ignore lint/correctness/useExhaustiveDependencies: reagir à MUDANÇA dos filtros, não ao valor de `page`
	useEffect(() => {
		setPage(1);
	}, [slot, search]);

	const refresh = async () => {
		await queryClient.invalidateQueries({
			queryKey: trpc.advertising.campaigns.list.queryKey(),
		});
	};

	const activate = useMutation(
		trpc.advertising.campaigns.activate.mutationOptions({
			onSuccess: async (campaign) => {
				toast.success(
					campaign.state === "AGENDADA"
						? "Campanha ativada — entra no ar na data de início."
						: "Campanha no ar.",
				);
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const pause = useMutation(
		trpc.advertising.campaigns.pause.mutationOptions({
			onSuccess: async () => {
				toast.success("Campanha pausada. O período contratado continua.");
				await refresh();
			},
		}),
	);
	const remove = useMutation(
		trpc.advertising.campaigns.remove.mutationOptions({
			onSuccess: async () => {
				toast.success("Campanha excluída.");
				await refresh();
			},
		}),
	);

	const hasFilters = slot !== ALL || search.trim() !== "";

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<div className="relative min-w-56 flex-1">
					<Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar por campanha ou anunciante…"
						className="pl-8"
					/>
				</div>

				<Select
					items={[{ value: ALL, label: "Todas as posições" }, ...SLOT_OPTIONS]}
					value={slot}
					onValueChange={(value) => setSlot(value ?? ALL)}
				>
					<SelectTrigger className="w-56">
						<SelectValue placeholder="Posição" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>Todas as posições</SelectItem>
						{SLOT_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{hasFilters ? (
					<Button
						variant="ghost"
						onClick={() => {
							setSlot(ALL);
							setSearch("");
						}}
					>
						Limpar
					</Button>
				) : null}

				<Button className="ms-auto" onClick={() => setCreating(true)}>
					<Plus className="size-4" />
					Nova campanha
				</Button>
			</div>

			<div className="rounded-lg border">
				<DataTable specs={COLUMNS} api={columns}>
					<TableHeader>
						<TableRow className="bg-background hover:bg-background">
							{HEADERS.map(({ key, label }) => {
								const spec = COLUMNS.find((c) => c.key === key) as ColumnSpec;
								const pinned = pinnedProps(COLUMNS, key, { header: true });
								return (
									<TableHead
										key={key}
										style={pinned.style}
										className={cn("relative", pinned.className)}
									>
										{label}
										<ColumnResizeHandle
											spec={spec}
											api={columns}
											label={label}
										/>
									</TableHead>
								);
							})}
							<TableHead />
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{list.isLoading ? (
							["a", "b", "c"].map((k) => (
								<TableRow key={k}>
									<TableCell colSpan={COLUMN_COUNT}>
										<Skeleton className="h-6 w-full" />
									</TableCell>
								</TableRow>
							))
						) : items.length === 0 ? (
							<TableRow>
								<TableCell colSpan={COLUMN_COUNT} className="py-12 text-center">
									<p className="font-medium">
										{hasFilters
											? "Nenhuma campanha com esses filtros."
											: "Nenhuma campanha ainda."}
									</p>
									<p className="mt-1 text-muted-foreground text-sm">
										{hasFilters
											? "Tente afrouxar a busca ou limpar os filtros."
											: "Enquanto não houver campanha própria, o Google AdSense preenche os espaços."}
									</p>
								</TableCell>
							</TableRow>
						) : (
							items.map((campaign) => {
								const stat = statsById.get(campaign.id);
								const pinnedCell = pinnedProps(COLUMNS, "campanha");
								return (
									<TableRow
										key={campaign.id}
										className="bg-background hover:bg-muted"
									>
										<TableCell {...pinnedCell}>
											<button
												type="button"
												onClick={() => setEditing(campaign.id)}
												className="block max-w-full text-left"
											>
												<span className="block truncate text-muted-foreground text-xs uppercase tracking-wide">
													{campaign.advertiser}
												</span>
												<span
													className="block truncate font-medium hover:underline"
													title={campaign.name}
												>
													{campaign.name}
												</span>
											</button>
										</TableCell>
										<TableCell>
											<CampaignStateBadge state={campaign.state} />
										</TableCell>
										<TableCell className="truncate text-muted-foreground">
											{AD_SLOT_LABELS[campaign.slot]}
										</TableCell>
										<TableCell className="truncate text-muted-foreground text-sm">
											{/* O tRPC serializa `Date` como string no caminho de
											    volta; `formatLongDate` quer um `Date`. */}
											{formatLongDate(new Date(campaign.startsAt))}
											{campaign.endsAt
												? ` – ${formatLongDate(new Date(campaign.endsAt))}`
												: " – sem fim"}
										</TableCell>
										<TableCell className="truncate text-muted-foreground text-sm">
											{campaign.isGlobal
												? "Portal inteiro"
												: `${campaign.sectionIds.length} editoria(s)`}
											{campaign.weight > 1
												? ` · peso ${campaign.weight}`
												: null}
										</TableCell>
										<TableCell className="text-muted-foreground text-sm">
											{stats.isLoading ? (
												<Skeleton className="h-4 w-20" />
											) : (
												<>
													{(stat?.impressions ?? 0).toLocaleString("pt-BR")}{" "}
													imp.
													<span className="mx-1">·</span>
													{(stat?.clicks ?? 0).toLocaleString("pt-BR")} cliq.
												</>
											)}
										</TableCell>
										<TableCell>
											<DropdownMenu>
												<DropdownMenuTrigger
													render={
														<Button
															variant="ghost"
															size="icon"
															aria-label={`Ações de ${campaign.name}`}
														/>
													}
												>
													<MoreHorizontal className="size-4" />
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														onClick={() => setEditing(campaign.id)}
													>
														Editar
													</DropdownMenuItem>
													{campaign.status === "ATIVA" ? (
														<DropdownMenuItem
															onClick={() => pause.mutate({ id: campaign.id })}
														>
															<Pause />
															Pausar
														</DropdownMenuItem>
													) : (
														<DropdownMenuItem
															onClick={() =>
																activate.mutate({ id: campaign.id })
															}
															disabled={campaign.blockers.length > 0}
														>
															<Play />
															{campaign.blockers.length > 0
																? "Falta a imagem"
																: "Ativar"}
														</DropdownMenuItem>
													)}
													<DropdownMenuItem
														render={
															<a
																href={campaign.destinationUrl}
																target="_blank"
																rel="noreferrer"
															/>
														}
													>
														<ExternalLink />
														Abrir destino
													</DropdownMenuItem>
													<DropdownMenuItem
														onClick={() =>
															setRemoving({
																id: campaign.id,
																name: campaign.name,
															})
														}
													>
														<Trash2 />
														Excluir
													</DropdownMenuItem>
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
										<TableCell />
									</TableRow>
								);
							})
						)}
					</TableBody>
				</DataTable>

				<PaginationBar
					page={page}
					perPage={list.data?.perPage ?? DEFAULT_PAGE_SIZE}
					total={list.data?.total ?? 0}
					onPageChange={setPage}
					unidade={{ singular: "campanha", plural: "campanhas" }}
				/>
			</div>

			<CampaignDialog
				open={creating || editing !== null}
				campaignId={editing}
				onOpenChange={(open) => {
					if (!open) {
						setCreating(false);
						setEditing(null);
					}
				}}
				onSaved={refresh}
			/>

			<AlertDialog
				open={removing !== null}
				onOpenChange={(open) => !open && setRemoving(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir “{removing?.name}”?</AlertDialogTitle>
						<AlertDialogDescription>
							A campanha sai do portal e o histórico de impressões e cliques
							dela é apagado junto — não há como recuperar o relatório depois.
							Para só tirar do ar mantendo os números, use “Pausar”.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							variant="destructive"
							onClick={() => {
								if (removing) {
									remove.mutate({ id: removing.id });
								}
								setRemoving(null);
							}}
						>
							Excluir
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
