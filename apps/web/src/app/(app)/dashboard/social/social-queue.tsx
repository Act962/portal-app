"use client";

import { PLATFORM_LABEL, type PostStatus } from "@portal-app/social";
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
import { Badge } from "@portal-app/ui/components/badge";
import { Button } from "@portal-app/ui/components/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@portal-app/ui/components/select";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
	AlertTriangle,
	Check,
	ExternalLink,
	Images,
	Plus,
	RotateCw,
	Sparkles,
	Trash2,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { PaginationBar } from "@/components/admin/pagination-bar";
import { AssetImage } from "@/components/media/asset-image";
import { formatLongDate } from "@/lib/format";
import { trpc } from "@/utils/trpc";

import { PostDialog } from "./post-dialog";
import { PostStatusBadge } from "./post-status-badge";
import {
	availableActions,
	previewCaption,
	summarizeDeliveries,
} from "./social-labels";

const ALL = "__all__";

const STATUS_OPTIONS: { value: string; label: string }[] = [
	{ value: ALL, label: "Todos os estados" },
	{ value: "RASCUNHO", label: "Aguardando aprovação" },
	{ value: "PUBLICANDO", label: "Enviando" },
	{ value: "PUBLICADO", label: "Publicados" },
	{ value: "PARCIAL", label: "Publicados em parte" },
	{ value: "FALHOU", label: "Falharam" },
	{ value: "CANCELADA", label: "Descartados" },
];

/**
 * A fila de aprovação — a tela principal do módulo.
 *
 * **Cartões, e não tabela.** Todas as outras listas do painel são tabelas
 * porque o que se compara ali é texto em coluna. Aqui o que se decide é
 * VISUAL: a pessoa olha a imagem e a legenda do jeito que vão sair e diz sim ou
 * não. Uma tabela com a legenda truncada numa célula esconderia justamente o
 * que está sendo aprovado.
 *
 * O filtro começa em "Aguardando aprovação" porque é o trabalho: o resto é
 * histórico, e histórico se procura, não se encara.
 */
export function SocialQueue() {
	const queryClient = useQueryClient();
	const [status, setStatus] = useState<string>("RASCUNHO");
	const [page, setPage] = useState(1);
	const [editing, setEditing] = useState<string | null>(null);
	const [creating, setCreating] = useState(false);
	const [discarding, setDiscarding] = useState<string | null>(null);

	const queue = useQuery(
		trpc.social.queue.queryOptions({
			...(status === ALL ? {} : { status: status as PostStatus }),
			page,
		}),
	);

	const refresh = async () => {
		await Promise.all([
			queryClient.invalidateQueries({
				queryKey: trpc.social.queue.queryKey(),
			}),
			queryClient.invalidateQueries({
				queryKey: trpc.social.pendingCount.queryKey(),
			}),
		]);
	};

	const approve = useMutation(
		trpc.social.approve.mutationOptions({
			// "Na fila", não "Publicado": quem publica é a tarefa de envio, e
			// prometer o que ainda não aconteceu faz alguém abrir o Instagram para
			// conferir e não achar nada.
			onSuccess: async () => {
				toast.success("Aprovado — entrou na fila de envio.");
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const retry = useMutation(
		trpc.social.retry.mutationOptions({
			onSuccess: async () => {
				toast.success("Reenviando só o que falhou.");
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const cancel = useMutation(
		trpc.social.cancel.mutationOptions({
			onSuccess: async () => {
				toast.success("Publicação descartada.");
				setDiscarding(null);
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const items = queue.data?.items ?? [];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center gap-2">
				<Select
					items={STATUS_OPTIONS}
					value={status}
					onValueChange={(value) => {
						setStatus(value ?? ALL);
						setPage(1);
					}}
				>
					<SelectTrigger className="w-64">
						<SelectValue placeholder="Estado" />
					</SelectTrigger>
					<SelectContent>
						{STATUS_OPTIONS.map((option) => (
							<SelectItem key={option.value} value={option.value}>
								{option.label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>

				<div className="ml-auto">
					<Button onClick={() => setCreating(true)}>
						<Plus className="size-4" />
						Nova publicação
					</Button>
				</div>
			</div>

			{queue.isPending ? (
				<div className="grid gap-4 md:grid-cols-2">
					<Skeleton className="h-52" />
					<Skeleton className="h-52" />
				</div>
			) : items.length === 0 ? (
				<EmptyState status={status} />
			) : (
				<div className="grid gap-4 md:grid-cols-2">
					{items.map((post) => (
						<article
							key={post.id}
							className="flex flex-col gap-3 rounded-lg border bg-card p-4"
						>
							<div className="flex items-start gap-3">
								<Thumbnail
									mediaId={post.mediaIds[0] ?? null}
									isCarousel={post.isCarousel}
									count={post.mediaIds.length}
								/>
								<div className="min-w-0 flex-1">
									<div className="flex flex-wrap items-center gap-2">
										<PostStatusBadge status={post.status} />
										{post.origin === "AUTOMATICA" ? (
											<Badge variant="outline" className="gap-1">
												<Sparkles className="size-3" />
												Da matéria
											</Badge>
										) : null}
									</div>
									<p className="mt-2 text-sm leading-relaxed">
										{previewCaption(post.caption)}
									</p>
								</div>
							</div>

							<p className="text-muted-foreground text-xs">
								{summarizeDeliveries(post.deliveries)} ·{" "}
								{formatLongDate(new Date(post.createdAt))}
							</p>

							{post.deliveries
								.filter((delivery) => delivery.error)
								.map((delivery) => (
									<p
										key={delivery.platform}
										className="flex gap-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-destructive text-xs"
									>
										<AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
										<span>{delivery.error}</span>
									</p>
								))}

							{post.status === "RASCUNHO" && post.blockers.length > 0 ? (
								<ul className="flex flex-col gap-1 rounded border border-amber-300 bg-amber-50 p-2 text-amber-900 text-xs dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-200">
									{post.blockers.map((blocker) => (
										<li key={blocker}>{blocker}</li>
									))}
								</ul>
							) : null}

							<div className="mt-auto flex flex-wrap items-center gap-2 pt-1">
								{post.deliveries
									.filter((delivery) => delivery.permalink)
									.map((delivery) => (
										<Button
											key={delivery.platform}
											variant="ghost"
											size="sm"
											nativeButton={false}
											render={
												<a
													href={delivery.permalink ?? "#"}
													target="_blank"
													rel="noreferrer"
												/>
											}
										>
											<ExternalLink className="size-4" />
											Ver no {PLATFORM_LABEL[delivery.platform]}
										</Button>
									))}

								{availableActions(post.status).includes("editar") ? (
									<Button
										variant="outline"
										size="sm"
										onClick={() => setEditing(post.id)}
									>
										Revisar
									</Button>
								) : null}

								{availableActions(post.status).includes("tentar-de-novo") ? (
									<Button
										variant="outline"
										size="sm"
										disabled={retry.isPending}
										onClick={() => retry.mutate({ id: post.id })}
									>
										<RotateCw className="size-4" />
										Tentar de novo
									</Button>
								) : null}

								{availableActions(post.status).includes("descartar") ? (
									<Button
										variant="ghost"
										size="sm"
										onClick={() => setDiscarding(post.id)}
									>
										<Trash2 className="size-4" />
										Descartar
									</Button>
								) : null}

								{availableActions(post.status).includes("aprovar") ? (
									<Button
										size="sm"
										className="ml-auto"
										// O botão some do caminho quando há impedimento, e o motivo
										// já está listado acima dele — em vez de deixar clicar para
										// receber um erro vermelho.
										disabled={post.blockers.length > 0 || approve.isPending}
										onClick={() => approve.mutate({ id: post.id })}
									>
										<Check className="size-4" />
										Aprovar
									</Button>
								) : null}
							</div>
						</article>
					))}
				</div>
			)}

			<PaginationBar
				page={page}
				perPage={20}
				total={queue.data?.total ?? 0}
				onPageChange={setPage}
			/>

			<PostDialog
				open={editing !== null || creating}
				postId={editing}
				onOpenChange={(open) => {
					if (!open) {
						setEditing(null);
						setCreating(false);
					}
				}}
				onSaved={refresh}
			/>

			<AlertDialog
				open={discarding !== null}
				onOpenChange={(open) => !open && setDiscarding(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Descartar esta publicação?</AlertDialogTitle>
						<AlertDialogDescription>
							Ela sai da fila e não vai para rede nenhuma. A matéria no portal
							não é afetada.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Manter</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => discarding && cancel.mutate({ id: discarding })}
						>
							Descartar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

function EmptyState({ status }: { status: string }) {
	return (
		<div className="rounded-lg border border-dashed p-10 text-center">
			<p className="font-medium">
				{status === "RASCUNHO"
					? "Nada esperando aprovação."
					: "Nenhuma publicação neste estado."}
			</p>
			<p className="mt-1 text-muted-foreground text-sm">
				{status === "RASCUNHO"
					? "Cada matéria publicada no portal aparece aqui automaticamente, com legenda e imagem já montadas."
					: "Troque o filtro para ver as outras."}
			</p>
		</div>
	);
}

function Thumbnail({
	mediaId,
	isCarousel,
	count,
}: {
	mediaId: string | null;
	isCarousel: boolean;
	count: number;
}) {
	const asset = useQuery({
		...trpc.media.get.queryOptions({ id: mediaId ?? "" }),
		enabled: mediaId !== null,
	});

	return (
		<div className="relative size-24 shrink-0 overflow-hidden rounded-md bg-muted">
			{asset.data ? (
				<AssetImage
					src={asset.data.url}
					alt={asset.data.altText ?? ""}
					className="size-full object-cover"
				/>
			) : null}
			{isCarousel ? (
				<span className="absolute right-1 bottom-1 flex items-center gap-1 rounded bg-black/70 px-1.5 py-0.5 text-[10px] text-white">
					<Images className="size-3" />
					{count}
				</span>
			) : null}
		</div>
	);
}
