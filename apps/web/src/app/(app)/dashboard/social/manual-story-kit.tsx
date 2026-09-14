"use client";

import { DESTINATION_LABEL, type SocialDestination } from "@portal-app/social";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Check, Copy, Download, Share2, X } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { formatRelativeTime } from "@/lib/format";
import { trpc } from "@/utils/trpc";
import { MANUAL_STORY_STEPS, storyArtUrl } from "./social-labels";

/**
 * O kit do story que uma pessoa publica pelo app (spec 11, D6): a arte pronta,
 * o link para a figurinha e o passo a passo — tudo o que não é o toque na
 * figurinha, que só o app do Instagram dá.
 *
 * No celular, "Publicar no Instagram" abre o compartilhar do sistema com o
 * ARQUIVO, e o Instagram aparece na lista. Sem esse suporte (computador), o
 * mesmo botão baixa a arte.
 */
export function ManualStoryKit({
	postId,
	destination,
	linkUrl,
	approvedAt,
	onChanged,
}: {
	postId: string;
	destination: SocialDestination;
	linkUrl: string | null;
	approvedAt: string | Date | null;
	onChanged: () => Promise<void> | void;
}) {
	const linkId = useId();
	const [confirming, setConfirming] = useState(false);
	const [dismissing, setDismissing] = useState(false);
	const [storyLink, setStoryLink] = useState("");

	const art = useQuery({
		queryKey: ["social", "story-art", postId, destination],
		queryFn: async () => {
			const response = await fetch(storyArtUrl(postId, destination), {
				credentials: "include",
			});
			if (!response.ok) {
				throw new Error(await response.text());
			}
			return response.blob();
		},
		staleTime: Number.POSITIVE_INFINITY,
		retry: false,
	});

	const [previewUrl, setPreviewUrl] = useState<string | null>(null);
	useEffect(() => {
		if (!art.data) {
			return;
		}
		const url = URL.createObjectURL(art.data);
		setPreviewUrl(url);
		return () => URL.revokeObjectURL(url);
	}, [art.data]);

	const confirm = useMutation(
		trpc.social.confirmManual.mutationOptions({
			onSuccess: async () => {
				toast.success("Story marcado como publicado.");
				setConfirming(false);
				await onChanged();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const dismiss = useMutation(
		trpc.social.dismissDelivery.mutationOptions({
			onSuccess: async () => {
				toast.success("Story dispensado.");
				setDismissing(false);
				await onChanged();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const fileName = `story-${postId.slice(0, 8)}.jpg`;
	const file = art.data
		? new File([art.data], fileName, { type: art.data.type || "image/jpeg" })
		: null;
	const canShareFile =
		file !== null &&
		typeof navigator !== "undefined" &&
		typeof navigator.canShare === "function" &&
		navigator.canShare({ files: [file] });

	async function shareOrDownload() {
		if (!file || !previewUrl) {
			return;
		}
		if (canShareFile) {
			try {
				await navigator.share({ files: [file] });
			} catch (error) {
				// Fechar o compartilhar não é erro.
				if (error instanceof Error && error.name !== "AbortError") {
					toast.error("Não foi possível compartilhar. Baixe a arte.");
				}
			}
			return;
		}
		const anchor = document.createElement("a");
		anchor.href = previewUrl;
		anchor.download = fileName;
		anchor.click();
	}

	async function copyLink() {
		if (!linkUrl) {
			return;
		}
		try {
			await navigator.clipboard.writeText(linkUrl);
			toast.success("Link copiado — cole na figurinha de link.");
		} catch {
			toast.error("Não foi possível copiar. Selecione o link e copie.");
		}
	}

	return (
		<section className="flex gap-3 rounded-md border border-violet-300 bg-violet-50 p-3 dark:border-violet-900 dark:bg-violet-950/30">
			<div className="aspect-[9/16] w-24 shrink-0 overflow-hidden rounded bg-muted">
				{previewUrl ? (
					<img
						src={previewUrl}
						alt={`Arte de ${DESTINATION_LABEL[destination]}`}
						className="size-full object-cover"
					/>
				) : art.isError ? (
					<p className="p-2 text-destructive text-xs">{art.error.message}</p>
				) : (
					<Skeleton className="size-full" />
				)}
			</div>

			<div className="flex min-w-0 flex-1 flex-col gap-2">
				<div>
					<p className="font-medium text-sm">
						Publique à mão em {DESTINATION_LABEL[destination]}
					</p>
					{approvedAt ? (
						<p className="text-muted-foreground text-xs">
							Aprovado {formatRelativeTime(new Date(approvedAt).toISOString())}
						</p>
					) : null}
				</div>

				<ol className="list-decimal space-y-0.5 pl-4 text-xs">
					{MANUAL_STORY_STEPS.map((step) => (
						<li key={step}>{step}</li>
					))}
				</ol>

				{linkUrl ? (
					<p className="truncate rounded bg-background px-2 py-1 font-mono text-xs">
						{linkUrl}
					</p>
				) : (
					<p className="text-amber-700 text-xs dark:text-amber-300">
						Esta publicação não tem link — o story sairá sem figurinha de link.
					</p>
				)}

				<div className="flex flex-wrap gap-2">
					<Button size="sm" disabled={!file} onClick={shareOrDownload}>
						{canShareFile ? (
							<Share2 className="size-4" />
						) : (
							<Download className="size-4" />
						)}
						{canShareFile ? "Publicar no Instagram" : "Baixar arte"}
					</Button>
					<Button
						size="sm"
						variant="outline"
						disabled={!linkUrl}
						onClick={copyLink}
					>
						<Copy className="size-4" />
						Copiar link
					</Button>
					<Button
						size="sm"
						variant="outline"
						onClick={() => {
							setStoryLink("");
							setConfirming(true);
						}}
					>
						<Check className="size-4" />
						Já publiquei
					</Button>
					<Button size="sm" variant="ghost" onClick={() => setDismissing(true)}>
						<X className="size-4" />
						Não vou publicar
					</Button>
				</div>
			</div>

			<Dialog open={confirming} onOpenChange={setConfirming}>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Marcar o story como publicado</DialogTitle>
						<DialogDescription>
							Confirme só depois de publicar no Instagram. O link do story é
							opcional — com ele, a fila ganha o botão para abrir o story.
						</DialogDescription>
					</DialogHeader>
					<div className="flex flex-col gap-2">
						<Label htmlFor={linkId}>Link do story (opcional)</Label>
						<Input
							id={linkId}
							value={storyLink}
							onChange={(event) => setStoryLink(event.target.value)}
							placeholder="https://www.instagram.com/stories/…"
						/>
					</div>
					<DialogFooter>
						<Button variant="ghost" onClick={() => setConfirming(false)}>
							Voltar
						</Button>
						<Button
							disabled={confirm.isPending}
							onClick={() =>
								confirm.mutate({
									id: postId,
									destination,
									permalink: storyLink.trim() === "" ? null : storyLink.trim(),
								})
							}
						>
							Já publiquei
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			<AlertDialog open={dismissing} onOpenChange={setDismissing}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Não publicar este story?</AlertDialogTitle>
						<AlertDialogDescription>
							Ele sai da fila de publicação à mão. O que já foi para as outras
							redes continua no ar.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Manter</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => dismiss.mutate({ id: postId, destination })}
						>
							Não vou publicar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</section>
	);
}
