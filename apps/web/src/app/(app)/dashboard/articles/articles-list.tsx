"use client";

import {
	EDITORIAL_STATUSES,
	type EditorialStatus,
} from "@portal-app/editorial";
import { DEFAULT_PAGE_SIZE } from "@portal-app/shared-kernel";
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
	DropdownMenuSeparator,
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
	Trash2,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ConfirmDestructiveDialog } from "@/components/admin/confirm-destructive-dialog";
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
	allows,
	type BulkAction,
	bulkResultMessage,
	canArchive,
	canDelete,
	countLabel,
	headerCheckboxState,
	pruneSelection,
	requiresTypedConfirmation,
	skippedNotice,
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

/** Uma linha da lista, reduzida ao que as regras do seletor precisam saber. */
type Target = {
	id: string;
	status: EditorialStatus;
	headline: string;
	firstPublishedAt: Date | string | null;
};

/**
 * O texto da confirmação, para as duas ações.
 *
 * Fica FORA do componente e num lugar só porque é a parte da tela que precisa
 * ser exata: descrever mal a consequência de uma ação sem volta é pior do que
 * não confirmar nada — leva a pessoa a clicar com confiança justamente onde não
 * há desfazer. Já aconteceu aqui: o texto do arquivamento prometia um "dá para
 * publicar de novo" que o agregado não cumpre.
 */
function confirmCopy(action: BulkAction, targets: readonly Target[]) {
	const one = targets.length === 1;
	const name = one ? `“${targets[0]?.headline}”` : countLabel(targets.length);

	if (action === "archive") {
		return {
			title: `Arquivar ${name}?`,
			// ARQUIVADA é estado terminal no agregado: `publish` só aceita APROVADA
			// ou AGENDADA, e `editContent` recusa matéria arquivada.
			description: one
				? "Ela sai do portal — some da home, da editoria e da busca. O texto e o endereço continuam guardados no arquivo, mas ARQUIVAR NÃO TEM VOLTA pelo painel: matéria arquivada não volta ao ar nem pode ser editada."
				: "Elas saem do portal — somem da home, das editorias e da busca. Os textos e os endereços continuam guardados no arquivo, mas ARQUIVAR NÃO TEM VOLTA pelo painel: matéria arquivada não volta ao ar nem pode ser editada.",
			confirmLabel: "Arquivar",
		};
	}

	// Apagar destrói o registro. Se alguma delas já esteve no ar, o endereço
	// público morre junto — e isso precisa estar escrito, não subentendido.
	const wasPublished = targets.some(
		(target) => target.firstPublishedAt != null,
	);
	const base = one
		? "Ela some do banco de dados para sempre. Não vai para o arquivo, não dá para restaurar pelo painel e não há backup ao alcance da redação."
		: "Elas somem do banco de dados para sempre. Não vão para o arquivo, não dá para restaurar pelo painel e não há backup ao alcance da redação.";
	const published = one
		? " Esta matéria já esteve publicada: o endereço dela continua indexado no Google e circulando por aí, e vai passar a responder “página não encontrada”."
		: " Há matérias que já estiveram publicadas: os endereços delas continuam indexados no Google e circulando por aí, e vão passar a responder “página não encontrada”.";

	return {
		title: `Apagar ${name}?`,
		description: wasPublished ? base + published : base,
		confirmLabel: one ? "Apagar" : `Apagar ${countLabel(targets.length)}`,
	};
}

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
	/**
	 * O que está para ser confirmado: qual AÇÃO, e sobre uma matéria (o menu da
	 * linha) ou sobre a seleção (a barra). Guarda o alvo da linha em vez de só o
	 * id porque o diálogo precisa do título e de saber se aquela matéria já
	 * esteve no ar — e reabrir a lista para descobrir isso enquanto o diálogo
	 * está aberto é a maneira mais fácil de mostrar uma coisa e apagar outra.
	 */
	const [confirming, setConfirming] = useState<
		| { action: BulkAction; kind: "one"; target: Target }
		| { action: BulkAction; kind: "bulk" }
		| null
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

	/** Arquivar e apagar mexem na contagem por status da visão geral — que é
	 * outra query. */
	const refreshAfterBulk = async () => {
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
				await refreshAfterBulk();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const archiveMany = useMutation(
		trpc.editorial.articles.archiveMany.mutationOptions({
			onSuccess: async (outcome) => {
				const { tone, message } = bulkResultMessage(outcome, "archive");
				toast[tone](message);
				await refreshAfterBulk();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const removeOne = useMutation(
		trpc.editorial.articles.remove.mutationOptions({
			// Repete o TÍTULO do que sumiu. "Matéria apagada" seria a mesma frase
			// para o acerto e para o engano, e é justamente depois de um apagamento
			// que a pessoa quer conferir se foi essa mesmo.
			onSuccess: async ({ headline }) => {
				toast.success(`“${headline}” foi apagada.`);
				await refreshAfterBulk();
			},
			onError: (error) => toast.error(error.message),
		}),
	);
	const removeMany = useMutation(
		trpc.editorial.articles.removeMany.mutationOptions({
			onSuccess: async (outcome) => {
				const { tone, message } = bulkResultMessage(outcome, "delete");
				toast[tone](message);
				await refreshAfterBulk();
			},
			onError: (error) => toast.error(error.message),
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

	// A lista, no formato que as regras do seletor entendem. O `status` do DTO
	// chega como `string` (é o que o tRPC infere do banco); o estreitamento para
	// `EditorialStatus` acontece UMA vez, aqui, em vez de num `as` espalhado por
	// cada uso.
	const rows: Target[] = articles.map((article) => ({
		id: article.id,
		status: article.status as EditorialStatus,
		headline: article.headline,
		firstPublishedAt: article.firstPublishedAt,
	}));

	const headerState = headerCheckboxState(rows, selected);
	const selectedCount = selected.size;

	/** Da seleção, o que ESTA ação alcança. */
	const eligible = (action: BulkAction) =>
		rows.filter((row) => selected.has(row.id) && allows(row.status, action));

	const archivableSelected = eligible("archive");
	const deletableSelected = eligible("delete");

	const confirmTargets =
		confirming === null
			? []
			: confirming.kind === "one"
				? [confirming.target]
				: eligible(confirming.action);

	const busy =
		archiveOne.isPending ||
		archiveMany.isPending ||
		removeOne.isPending ||
		removeMany.isPending;

	const runConfirmed = () => {
		if (!confirming) {
			return;
		}
		const ids = confirmTargets.map((target) => target.id);
		if (ids.length === 0) {
			setConfirming(null);
			return;
		}
		if (confirming.action === "archive") {
			if (confirming.kind === "one") {
				archiveOne.mutate({ id: ids[0] as string });
			} else {
				archiveMany.mutate({ ids });
			}
		} else if (confirming.kind === "one") {
			removeOne.mutate({ id: ids[0] as string });
		} else {
			removeMany.mutate({ ids });
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
					{/* Os dois botões mostram QUANTAS a ação alcança, não quantas
					    estão marcadas. Marcar cinco linhas e ler "Apagar (3)" já conta
					    a história antes do clique; sem o número, a diferença só
					    apareceria no aviso de lote parcial, depois de feito. */}
					<div className="ms-auto flex items-center gap-2">
						<Button
							size="sm"
							variant="outline"
							disabled={busy || archivableSelected.length === 0}
							onClick={() => setConfirming({ action: "archive", kind: "bulk" })}
						>
							<Archive className="size-4" />
							Arquivar ({archivableSelected.length})
						</Button>
						<Button
							size="sm"
							variant="destructive"
							disabled={busy || deletableSelected.length === 0}
							onClick={() => setConfirming({ action: "delete", kind: "bulk" })}
						>
							<Trash2 className="size-4" />
							Apagar ({deletableSelected.length})
						</Button>
					</div>
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
								{/* Sem `disabled`: toda matéria serve a pelo menos uma das duas
								    ações (o teste em `article-selection.test.ts` percorre os
								    status e garante isso), então uma caixinha inerte aqui só
								    esconderia a ação que ainda cabe. */}
								<Checkbox
									checked={headerState === "checked"}
									indeterminate={headerState === "indeterminate"}
									disabled={rows.length === 0}
									onCheckedChange={() =>
										setSelected((current) => toggleAll(rows, current))
									}
									aria-label="Selecionar todas as matérias desta página"
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
								const status = article.status as EditorialStatus;
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
												onCheckedChange={() =>
													setSelected((current) =>
														toggleSelection(current, article.id),
													)
												}
												aria-label={`Selecionar ${article.headline}`}
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
													{canArchive(status) ? (
														<DropdownMenuItem
															onClick={() =>
																setConfirming({
																	action: "archive",
																	kind: "one",
																	target: {
																		id: article.id,
																		status,
																		headline: article.headline,
																		firstPublishedAt: article.firstPublishedAt,
																	},
																})
															}
														>
															<Archive />
															Arquivar
														</DropdownMenuItem>
													) : null}
													{/* Apagar fica DEPOIS de um separador, e em vermelho:
													    é a única ação do menu que não volta, e precisa
													    estar longe do dedo que veio clicar em "Editar".
													    Some para matéria no ar — quem quiser eliminá-la
													    arquiva antes, e essa parada é a chance de mudar de
													    ideia. */}
													{canDelete(status) ? (
														<>
															<DropdownMenuSeparator />
															<DropdownMenuItem
																variant="destructive"
																onClick={() =>
																	setConfirming({
																		action: "delete",
																		kind: "one",
																		target: {
																			id: article.id,
																			status,
																			headline: article.headline,
																			firstPublishedAt:
																				article.firstPublishedAt,
																		},
																	})
																}
															>
																<Trash2 />
																Apagar
															</DropdownMenuItem>
														</>
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

			{/* Uma confirmação só, para a linha e para o lote, para arquivar e para
			    apagar: telas diferentes para a mesma ação seriam chances de
			    discordarem sobre o que ela significa. */}
			<ConfirmDestructiveDialog
				open={confirming !== null && confirmTargets.length > 0}
				onOpenChange={(open) => !open && setConfirming(null)}
				{...confirmCopy(confirming?.action ?? "archive", confirmTargets)}
				notice={
					confirming?.kind === "bulk"
						? skippedNotice(
								selectedCount - confirmTargets.length,
								confirming.action,
							)
						: null
				}
				requireTyping={
					confirming?.action === "delete" &&
					requiresTypedConfirmation(confirmTargets)
				}
				pending={busy}
				onConfirm={runConfirmed}
			/>
		</>
	);
}
