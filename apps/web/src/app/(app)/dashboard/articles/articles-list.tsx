"use client";

import {
	EDITORIAL_STATUSES,
	type EditorialStatus,
} from "@portal-app/editorial";
import { Button } from "@portal-app/ui/components/button";
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
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@portal-app/ui/components/table";
import { useMutation, useQuery } from "@tanstack/react-query";
import {
	ExternalLink,
	MoreHorizontal,
	Plus,
	Search,
	Timer,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { STATUS_LABELS, StatusBadge } from "@/components/admin/status-badge";
import { trpc } from "@/utils/trpc";

const articleHref = (id: string) => `/dashboard/articles/${id}` as Route;

const ALL = "__all__";

export function ArticlesList() {
	const router = useRouter();
	const [status, setStatus] = useState<string>(ALL);
	const [sectionId, setSectionId] = useState<string>(ALL);
	const [search, setSearch] = useState("");
	const [headline, setHeadline] = useState("");
	const [creating, setCreating] = useState(false);

	const list = useQuery(
		trpc.editorial.articles.list.queryOptions({
			...(status === ALL ? {} : { status: status as EditorialStatus }),
			...(sectionId === ALL ? {} : { sectionId }),
			...(search.trim() ? { search: search.trim() } : {}),
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

	const sectionName = (id: string | null) =>
		sections.data?.find((s) => s.id === id)?.name ?? "—";

	const articles = list.data ?? [];
	const hasFilters =
		status !== ALL || sectionId !== ALL || search.trim() !== "";

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

				{hasFilters ? (
					<Button
						variant="ghost"
						onClick={() => {
							setStatus(ALL);
							setSectionId(ALL);
							setSearch("");
						}}
					>
						Limpar
					</Button>
				) : null}
			</div>

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Título</TableHead>
							<TableHead className="w-32">Status</TableHead>
							<TableHead className="w-40">Editoria</TableHead>
							<TableHead className="w-40">Autor</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{list.isLoading ? (
							["a", "b", "c", "d", "e"].map((k) => (
								<TableRow key={k}>
									<TableCell colSpan={5}>
										{/* Mesma altura da linha final: sem salto de layout. */}
										<Skeleton className="h-6 w-full" />
									</TableCell>
								</TableRow>
							))
						) : articles.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="py-12 text-center">
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
							articles.map((article) => (
								<TableRow key={article.id}>
									<TableCell>
										<Link
											href={articleHref(article.id)}
											className="block font-medium hover:underline"
										>
											{article.kicker ? (
												<span className="block text-muted-foreground text-xs uppercase tracking-wide">
													{article.kicker}
												</span>
											) : null}
											{article.headline}
										</Link>
									</TableCell>
									<TableCell>
										<StatusBadge status={article.status as EditorialStatus} />
									</TableCell>
									<TableCell className="text-muted-foreground">
										{sectionName(article.sectionId)}
									</TableCell>
									<TableCell className="text-muted-foreground">
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
											</DropdownMenuContent>
										</DropdownMenu>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</>
	);
}
