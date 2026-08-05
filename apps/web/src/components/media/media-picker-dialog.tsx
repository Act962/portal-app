"use client";

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
import { useState } from "react";

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
	const library = useQuery({
		...trpc.media.library.queryOptions({
			type: "IMAGE",
			...(search.trim() ? { search: search.trim() } : {}),
		}),
		enabled: open,
	});

	const items = library.data ?? [];

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
									<img
										src={asset.url}
										alt={asset.altText ?? ""}
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
			</DialogContent>
		</Dialog>
	);
}
