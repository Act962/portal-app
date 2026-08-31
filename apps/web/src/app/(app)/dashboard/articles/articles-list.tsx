"use client";

import {
	EDITORIAL_STATUSES,
	type EditorialStatus,
} from "@portal-app/editorial";
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
import { Checkbox } from "@portal-app/ui/components/checkbox";
import {
	Dialog,
	DialogClose,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@portal-app/ui/components/dialog";
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
	Archive,
	Columns3,
	ExternalLink,
	MoreHorizontal,
	Plus,
	Search,
	Timer,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
	ColumnResizeHandle,
	DataTable,
	pinnedProps,
	useColumnWidths,
} from "@/components/admin/data-table";
import { PageHeader } from "@/components/admin/page-header";
import { PaginationBar } from "@/components/admin/pagination-bar";
import { STATUS_LABELS, StatusBadge } from "@/components/admin/status-badge";
import {
	archiveResultMessage,
	countLabel,
	headerCheckboxState,
	isArchivable,
	pruneSelection,
	toggleAll,
	toggleSelection,
} from "@/lib/article-selection";
import type { ColumnSpec } from "@/lib/table-columns";
import { trpc } from "@/utils/trpc";

/**
 * As colunas da lista.
 *
 * A caixinha e o título ficam CONGELADOS: rolar para ver o autor sem eles
 * deixaria a linha sem sujeito — "Política · João Gabriel · Publicada" não diz
 * de qual matéria se trata. A caixinha não redimensiona (a largura dela é a do
 * controle, não uma preferência), e o título tem o maior teto porque é onde
 * cabe manchete longa.
 */
const COLUMNS: readonly ColumnSpec[] = [
	{ key: "selecao", width: 44, minWidth: 44, pinned: true },
	{
		key: "titulo",
		width: 420,
		minWidth: 200,
		maxWidth: 760,
		resizable: true,
		pinned: true,
	},
	{ key: "status", width: 140, minWidth: 110, maxWidth: 220, resizable: true },
	{
		key: "editoria",
		width: 180,
		minWidth: 120,
		maxWidth: 320,
		resizable: true,
	},
	{ key: "autor", width: 200, minWidth: 120, maxWidth: 320, resizable: true },
	{ key: "acoes", width: 56, minWidth: 56 },
];

/** A preferência é POR TELA: a largura boa para matérias não é a boa para
 * mídia, e uma chave só faria uma sobrescrever a outra. */
const COLUMNS_STORAGE_KEY = "portal:colunas:materias";

/** Os cabeçalhos que ganham alça de arrasto, na ordem em que aparecem. */
const RESIZABLE_HEADERS = [
	{ key: "titulo", label: "Título" },
	{ key: "status", label: "Status" },
	{ key: "editoria", label: "Editoria" },
	{ key: "autor", label: "Autor" },
] as const;

const headerCell = (key: string) => pinnedProps(COLUMNS, key, { header: true });
const bodyCell = (key: string) => pinnedProps(COLUMNS, key);

/** Colunas + a coluna-sobra — o `colSpan` das linhas de estado vazio. */
const COLUMN_COUNT = COLUMNS.length + 1;

const articleHref = (id: string) => `/dashboard/articles/${id}` as Route;

const ALL = "__all__";

export function ArticlesList() {
	const router = useRouter();
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<string>(ALL);
	const [sectionId, setSectionId] = useState<string>(ALL);
	const [search, setSearch] = useState("");
	const [showArchived, setShowArchived] = useState(false);
	const [page, setPage] = useState(1);
	const [headline, setHeadline] = useState("");
	const [creating, setCreating] = useState(false);
	// A seleção do arquivamento em lote. Guarda ids, e não os objetos: a lista
	// se recarrega a cada filtro, e um objeto guardado envelheceria calado.
	const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
	/** Confirmação de UMA matéria (linha) ou do LOTE (barra). */
	const [confirming, setConfirming] = useState<
		{ kind: "one"; id: string; headline: string } | { kind: "bulk" } | null
	>(null);

	const columns = useColumnWidths(COLUMNS, COLUMNS_STORAGE_KEY);

	const list = useQuery(
		trpc.editorial.articles.list.queryOptions({
			...(status === ALL ? {} : { status: status as EditorialStatus }),
			...(sectionId === ALL ? {} : { sectionId }),
			...(search.trim() ? { search: search.trim() } : {}),
			// Arquivada é matéria fora de circulação: some da lista, a não ser que
			// a redação peça para vê-la.
			...(showArchived ? { includeArchived: true } : {}),
			page,
		}),
	);
	// Leitura liberada a qualquer membro ativo desde a correção de permissão —
	// antes disto o filtro por editoria vinha vazio para redator e editor.
	const sections = useQuery(trpc.taxonomy.sections.list.queryOptions());

	const create = useMutation(
		trpc.editorial.articles.create.mutationOptions({
			onSuccess: (article) => router.push(articleHref(article.id)),
		}),
	);
	const runDue = useMutation(
		trpc.editorial.schedules.runDue.mutationOptions({
			onSuccess: ({ published }) => {
				toast.success(
					published === 0
						? "Nenhuma matéria agendada venceu ainda."
						: `${published} matéria(s) publicada(s).`,
				);
				list.refetch();
			},
		}),
	);

	/** Arquivar mexe na contagem por status da visão geral — que é outra query. */
	const refreshAfterArchive = async () => {
		setSelected(new Set());
		await Promise.all([
			list.refetch(),
			queryClient.invalidateQueries({
				queryKey: trpc.editorial.articles.counts.queryKey(),
			}),
		]);
	};

	const archiveOne = useMutation(
		trpc.editorial.articles.archive.mutationOptions({
			onSuccess: async () => {
				toast.success("Matéria arquivada.");
				await refreshAfterArchive();
			},
		}),
	);
	const archiveMany = useMutation(
		trpc.editorial.articles.archiveMany.mutationOptions({
			onSuccess: async (outcome) => {
				const { tone, message } = archiveResultMessage(outcome);
				toast[tone](message);
				await refreshAfterArchive();
			},
		}),
	);

	// Mudou o filtro, volta para a primeira página. Sem isto, filtrar estando na
	// página 5 devolve lista vazia — e parece que o filtro não achou nada.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reagir à MUDANÇA dos filtros, não ao valor de `page`
	useEffect(() => {
		setPage(1);
	}, [status, sectionId, search, showArchived]);

	const sectionName = (id: string | null) =>
		sections.data?.find((s) => s.id === id)?.name ?? "—";

	const articles = list.data?.items ?? [];
	const total = list.data?.total ?? 0;
	const perPage = list.data?.perPage ?? DEFAULT_PAGE_SIZE;
	const hasFilters =
		status !== ALL || sectionId !== ALL || search.trim() !== "" || showArchived;

	// A seleção só vale para o que está NA TELA: virou a página, mudou o filtro,
	// o lote terminou — o que sumiu sai da conta. Uma barra dizendo "3
	// selecionadas" sobre linhas invisíveis arquivaria às cegas.
	useEffect(() => {
		const visible = (list.data?.items ?? []).map((a) => a.id);
		setSelected((current) => {
			const next = pruneSelection(current, visible);
			return next.size === current.size ? current : next;
		});
	}, [list.data]);

	const selectable = articles.filter((a) =>
		isArchivable(a.status as EditorialStatus),
	);
	const headerState = headerCheckboxState(
		articles.map((a) => ({ id: a.id, status: a.status as EditorialStatus })),
		selected,
	);
	const selectedCount = selected.size;

	const confirmedIds =
		confirming?.kind === "one" ? [confirming.id] : [...selected];
	const archiving = archiveOne.isPending || archiveMany.isPending;

	const runArchive = () => {
		if (!confirming) {
			return;
		}
		if (confirming.kind === "one") {
			archiveOne.mutate({ id: confirming.id });
		} else if (selected.size > 0) {
			archiveMany.mutate({ ids: [...selected] });
		}
		setConfirming(null);
	};

	return (
		<>
			<PageHeader
				title="Matérias"
				description="Tudo o que a redação está produzindo, da primeira linha ao arquivo."
				actions={
					<>
						<DropdownMenu>
							<DropdownMenuTrigger
								render={
									<Button
										variant="outline"
										size="icon"
										aria-label="Mais ações"
									/>
								}
							>
								<MoreHorizontal className="size-4" />
							</DropdownMenuTrigger>
							<DropdownMenuContent align="end">
								<DropdownMenuItem
									onClick={() => runDue.mutate()}
									disabled={runDue.isPending}
								>
									<Timer />
									Publicar agendadas vencidas
								</DropdownMenuItem>
								{/* Só aparece habilitado quando há o que desfazer — um item
								    permanentemente inerte só ensina a ignorar o menu. */}
								<DropdownMenuItem
									onClick={columns.reset}
									disabled={!columns.canReset}
								>
									<Columns3 />
									Restaurar largura das colunas
								</DropdownMenuItem>
							</DropdownMenuContent>
						</DropdownMenu>

						<Dialog open={creating} onOpenChange={setCreating}>
							<DialogTrigger render={<Button />}>
								<Plus className="size-4" />
								Nova matéria
							</DialogTrigger>
							<DialogContent>
								<form
									onSubmit={(event) => {
										event.preventDefault();
										if (headline.trim()) {
											create.mutate({ headline: headline.trim() });
										}
									}}
								>
									<DialogHeader>
										<DialogTitle>Nova matéria</DialogTitle>
										<DialogDescription>
											Comece pelo título. Tudo o mais — chapéu, editoria, capa,
											corpo — se edita na tela seguinte.
										</DialogDescription>
									</DialogHeader>

									<div className="py-4">
										{/* biome-ignore lint/a11y/noAutofocus: o campo é o único do diálogo */}
										<Input
											autoFocus
											value={headline}
											onChange={(e) => setHeadline(e.target.value)}
											placeholder="Ex.: Prefeitura anuncia obras na BR-343"
										/>
									</div>

									<DialogFooter>
										<DialogClose render={<Button variant="outline" />}>
											Cancelar
										</DialogClose>
										<Button
											type="submit"
											disabled={!headline.trim() || create.isPending}
										>
											{create.isPending ? "Criando…" : "Criar e escrever"}
										</Button>
									</DialogFooter>
								</form>
							</DialogContent>
						</Dialog>
					</>
				}
			/>

			<div className="flex flex-wrap items-center gap-2">
				<div className="relative min-w-56 flex-1">
					<Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(e) => setSearch(e.target.value)}
						placeholder="Buscar por título…"
						className="pl-8"
					/>
				</div>

				<Select
					items={[
						{ value: ALL, label: "Todos os status" },
						...EDITORIAL_STATUSES.map((s) => ({
							value: s,
							label: STATUS_LABELS[s],
						})),
					]}
					value={status}
					onValueChange={(value) => setStatus(value ?? ALL)}
				>
					<SelectTrigger className="w-44">
						<SelectValue placeholder="Status" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>Todos os status</SelectItem>
						{EDITORIAL_STATUSES.map((s) => (
							<SelectItem key={s} value={s}>
								{STATUS_LABELS[s]}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<Select
					items={[
						{ value: ALL, label: "Todas as editorias" },
						...(sections.data ?? []).map((section) => ({
							value: section.id,
							label: section.name,
						})),
					]}
					value={sectionId}
					onValueChange={(value) => setSectionId(value ?? ALL)}
				>
					<SelectTrigger className="w-44">
						<SelectValue placeholder="Editoria" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value={ALL}>Todas as editorias</SelectItem>
						{(sections.data ?? []).map((section) => (
							<SelectItem key={section.id} value={section.id}>
								{section.name}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				{/* O arquivo continua a um clique de distância — escondido não é
				    sumido. Fica desabilitado quando o filtro de status já pede
				    "Arquivada": aí a lista É o arquivo, e a chave não teria efeito. */}
				<Button
					variant={showArchived ? "secondary" : "outline"}
					aria-pressed={showArchived}
					disabled={status === "ARQUIVADA"}
					onClick={() => setShowArchived((value) => !value)}
				>
					<Archive className="size-4" />
					{showArchived ? "Ocultar arquivadas" : "Mostrar arquivadas"}
				</Button>

				{hasFilters ? (
					<Button
						variant="ghost"
						onClick={() => {
							setStatus(ALL);
							setSectionId(ALL);
							setSearch("");
							setShowArchived(false);
						}}
					>
						Limpar
					</Button>
				) : null}
			</div>

			{/* A barra do lote só existe quando há seleção — e diz o número antes do
			    botão, porque é o número que a pessoa precisa conferir. */}
			{selectedCount > 0 ? (
				<div className="flex flex-wrap items-center gap-3 rounded-lg border bg-muted/40 px-4 py-2.5">
					<span className="font-medium text-sm">
						{countLabel(selectedCount)} selecionada
						{selectedCount === 1 ? "" : "s"}
					</span>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setSelected(new Set())}
					>
						Limpar seleção
					</Button>
					<Button
						size="sm"
						variant="destructive"
						className="ms-auto"
						disabled={archiving}
						onClick={() => setConfirming({ kind: "bulk" })}
					>
						<Archive className="size-4" />
						{archiving ? "Arquivando…" : "Arquivar"}
					</Button>
				</div>
			) : null}

			<div className="rounded-lg border">
				<DataTable specs={COLUMNS} api={columns}>
					<TableHeader>
						{/* Fundo OPACO na linha: as células congeladas herdam daqui, e
						    fundo translúcido deixaria o conteúdo rolar por baixo,
						    visível. */}
						<TableRow className="bg-background hover:bg-background">
							<TableHead
								{...headerCell("selecao")}
								className={cn("px-2", headerCell("selecao").className)}
							>
								<Checkbox
									checked={headerState === "checked"}
									indeterminate={headerState === "indeterminate"}
									disabled={selectable.length === 0}
									onCheckedChange={() =>
										setSelected((current) =>
											toggleAll(
												articles.map((a) => ({
													id: a.id,
													status: a.status as EditorialStatus,
												})),
												current,
											),
										)
									}
									aria-label="Selecionar as matérias publicadas desta página"
								/>
							</TableHead>
							{RESIZABLE_HEADERS.map(({ key, label }) => {
								const spec = COLUMNS.find((c) => c.key === key) as ColumnSpec;
								const pinned = headerCell(key);
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
							{/* A coluna-sobra: existe no `colgroup`, precisa existir aqui. */}
							<TableHead />
						</TableRow>
					</TableHeader>
					<TableBody>
						{list.isLoading ? (
							["a", "b", "c", "d", "e"].map((k) => (
								<TableRow key={k}>
									<TableCell colSpan={COLUMN_COUNT}>
										{/* Mesma altura da linha final: sem salto de layout. */}
										<Skeleton className="h-6 w-full" />
									</TableCell>
								</TableRow>
							))
						) : articles.length === 0 ? (
							<TableRow>
								<TableCell colSpan={COLUMN_COUNT} className="py-12 text-center">
									<p className="font-medium">
										{hasFilters
											? "Nenhuma matéria com esses filtros."
											: "Nenhuma matéria ainda."}
									</p>
									<p className="mt-1 text-muted-foreground text-sm">
										{hasFilters
											? "Tente afrouxar a busca ou limpar os filtros."
											: "Crie a primeira e ela aparece aqui."}
									</p>
								</TableCell>
							</TableRow>
						) : (
							articles.map((article) => {
								const archivable = isArchivable(
									article.status as EditorialStatus,
								);
								return (
									<TableRow
										key={article.id}
										data-state={
											selected.has(article.id) ? "selected" : undefined
										}
										// Fundos OPACOS: a célula congelada herda o fundo da
										// linha, e o `bg-muted/50` original deixaria o conteúdo
										// rolar por baixo dela, visível através do meio-tom.
										className="bg-background hover:bg-muted data-[state=selected]:bg-muted"
									>
										<TableCell {...bodyCell("selecao")}>
											<Checkbox
												checked={selected.has(article.id)}
												disabled={!archivable}
												onCheckedChange={() =>
													setSelected((current) =>
														toggleSelection(current, article.id),
													)
												}
												aria-label={
													archivable
														? `Selecionar ${article.headline}`
														: `${article.headline} não pode ser arquivada: só matéria no ar entra no arquivo`
												}
											/>
										</TableCell>
										<TableCell {...bodyCell("titulo")}>
											<Link
												href={articleHref(article.id)}
												className="block hover:underline"
											>
												{article.kicker ? (
													<span className="block truncate text-muted-foreground text-xs uppercase tracking-wide">
														{article.kicker}
													</span>
												) : null}
												{/* `truncate` porque a coluna agora tem largura
												    declarada: sem isto a manchete longa esticaria a
												    célula e a largura que o usuário escolheu seria
												    ignorada. O título inteiro fica no `title`. */}
												<span
													className="block truncate font-medium"
													title={article.headline}
												>
													{article.headline}
												</span>
											</Link>
										</TableCell>
										<TableCell>
											<StatusBadge status={article.status as EditorialStatus} />
										</TableCell>
										<TableCell className="truncate text-muted-foreground">
											{sectionName(article.sectionId)}
										</TableCell>
										<TableCell className="truncate text-muted-foreground">
											{article.byline.name}
										</TableCell>
										<TableCell>
											<DropdownMenu>
												<DropdownMenuTrigger
													render={
														<Button
															variant="ghost"
															size="icon"
															aria-label={`Ações de ${article.headline}`}
														/>
													}
												>
													<MoreHorizontal className="size-4" />
												</DropdownMenuTrigger>
												<DropdownMenuContent align="end">
													<DropdownMenuItem
														render={<Link href={articleHref(article.id)} />}
													>
														Editar
													</DropdownMenuItem>
													{article.status === "PUBLICADA" ||
													article.status === "ATUALIZADA" ? (
														<DropdownMenuItem
															render={
																// biome-ignore lint/a11y/useAnchorContent: conteúdo vem do item
																<a
																	href={`/${sections.data?.find((s) => s.id === article.sectionId)?.slug ?? "geral"}/${article.slug}`}
																	target="_blank"
																	rel="noreferrer"
																/>
															}
														>
															<ExternalLink />
															Ver no portal
														</DropdownMenuItem>
													) : null}
													{archivable ? (
														<DropdownMenuItem
															onClick={() =>
																setConfirming({
																	kind: "one",
																	id: article.id,
																	headline: article.headline,
																})
															}
														>
															<Archive />
															Arquivar
														</DropdownMenuItem>
													) : null}
												</DropdownMenuContent>
											</DropdownMenu>
										</TableCell>
										{/* A coluna-sobra. */}
										<TableCell />
									</TableRow>
								);
							})
						)}
					</TableBody>
				</DataTable>

				<PaginationBar
					page={page}
					perPage={perPage}
					total={total}
					onPageChange={setPage}
					unidade={{ singular: "matéria", plural: "matérias" }}
				/>
			</div>

			{/* Uma confirmação só, para a linha e para o lote: é a MESMA ação, e
			    duas telas diferentes para ela seriam duas chances de discordarem
			    sobre o que arquivar significa. */}
			<AlertDialog
				open={confirming !== null}
				onOpenChange={(open) => !open && setConfirming(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{confirming?.kind === "one"
								? `Arquivar “${confirming.headline}”?`
								: `Arquivar ${countLabel(confirmedIds.length)}?`}
						</AlertDialogTitle>
						{/* O texto diz que NÃO TEM VOLTA porque não tem: `ARQUIVADA` é
						    estado terminal no agregado — `publish` só aceita APROVADA ou
						    AGENDADA, e `editContent` recusa matéria arquivada. Prometer
						    aqui um "dá para republicar depois" que o domínio não cumpre
						    seria a pior espécie de confirmação: a que faz clicar com
						    confiança justamente onde não há desfazer. */}
						<AlertDialogDescription>
							{confirmedIds.length === 1
								? "Ela sai do portal — some da home, da editoria e da busca. O texto e o endereço continuam guardados no arquivo, mas ARQUIVAR NÃO TEM VOLTA pelo painel: matéria arquivada não volta ao ar nem pode ser editada."
								: "Elas saem do portal — somem da home, das editorias e da busca. Os textos e os endereços continuam guardados no arquivo, mas ARQUIVAR NÃO TEM VOLTA pelo painel: matéria arquivada não volta ao ar nem pode ser editada."}
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						{/* `destructive` porque a ação é irreversível — o botão precisa
						    parecer o que faz, e não um "OK" qualquer. */}
						<AlertDialogAction variant="destructive" onClick={runArchive}>
							Arquivar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</>
	);
}
