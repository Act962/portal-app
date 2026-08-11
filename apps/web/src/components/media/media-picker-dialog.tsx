"use client";

import { DEFAULT_PAGE_SIZE } from "@portal-app/shared-kernel";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { useQuery } from "@tanstack/react-query";
import { Search } from "lucide-react";
import { useEffect, useState } from "react";

import { PaginationBar } from "@/components/admin/pagination-bar";
import { AssetImage } from "@/components/media/asset-image";
import { trpc } from "@/utils/trpc";

/**
 * Escolhe um asset da biblioteca. Usado pelo editor (imagem no meio do texto) e
 * pela tela da matéria (capa) — a mesma grade, para a redação não aprender dois
 * jeitos de fazer a mesma coisa.
 */
export function MediaPickerDialog({
	open,
	onOpenChange,
	onSelect,
	title = "Escolher da biblioteca",
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (mediaId: string) => void;
	title?: string;
}) {
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const library = useQuery({
		...trpc.media.library.queryOptions({
			type: "IMAGE",
			...(search.trim() ? { search: search.trim() } : {}),
			page,
		}),
		enabled: open,
	});

	// Buscar reinicia a paginação; reabrir o diálogo também, senão ele volta na
	// página 4 de uma busca antiga.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reagir à busca e à abertura, não a `page`
	useEffect(() => {
		setPage(1);
	}, [search, open]);

	const items = library.data?.items ?? [];
	const total = library.data?.total ?? 0;
	const perPage = library.data?.perPage ?? DEFAULT_PAGE_SIZE;

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						Clique numa imagem para inseri-la. Para enviar uma nova, use a
						Biblioteca de mídia.
					</DialogDescription>
				</DialogHeader>

				<div className="relative">
					<Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar por nome ou crédito…"
						className="pl-8"
					/>
				</div>

				<div className="max-h-96 overflow-y-auto">
					{library.isLoading ? (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
							{["a", "b", "c", "d", "e", "f", "g", "h"].map((k) => (
								<Skeleton key={k} className="aspect-video w-full" />
							))}
						</div>
					) : items.length === 0 ? (
						<p className="py-10 text-center text-muted-foreground text-sm">
							{search
								? "Nenhuma imagem com esse termo."
								: "A biblioteca ainda está vazia."}
						</p>
					) : (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
							{items.map((asset) => (
								<button
									key={asset.id}
									type="button"
									onClick={() => onSelect(asset.id)}
									className="group overflow-hidden rounded-lg border text-left transition hover:border-brand-red hover:ring-2 hover:ring-brand-red/30"
								>
									<AssetImage
										src={asset.url}
										alt={asset.altText ?? ""}
										label="Imagem indisponível"
										style={{
											objectPosition: `${(asset.focalPoint?.x ?? 0.5) * 100}% ${(asset.focalPoint?.y ?? 0.5) * 100}%`,
										}}
										className="aspect-video w-full object-cover"
									/>
									<span className="block truncate px-2 py-1.5 text-xs">
										{asset.filename}
									</span>
								</button>
							))}
						</div>
					)}
				</div>

				<PaginationBar
					page={page}
					perPage={perPage}
					total={total}
					onPageChange={setPage}
					unidade={{ singular: "imagem", plural: "imagens" }}
				/>
			</DialogContent>
		</Dialog>
	);
}
