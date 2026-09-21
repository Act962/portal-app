"use client";

import { ACCEPTED_VIDEO_MIME, type MediaType } from "@portal-app/media";
import { DEFAULT_PAGE_SIZE } from "@portal-app/shared-kernel";
import { formatSeconds, RENDER_MAX_SECONDS } from "@portal-app/social";
import { Button } from "@portal-app/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { Progress } from "@portal-app/ui/components/progress";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Film, Search, Upload } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { toast } from "sonner";

import { PaginationBar } from "@/components/admin/pagination-bar";
import {
	type PickedFile,
	putWithProgress,
	readPickedFile,
} from "@/lib/media-upload";
import { trpc } from "@/utils/trpc";

const VIDEO: MediaType = "VIDEO";

/**
 * Escolhe um vídeo da biblioteca, ou envia um do computador sem sair daqui.
 *
 * Diálogo próprio, e não o `MediaPickerDialog` com um filtro diferente, por uma
 * razão de FORMULÁRIO: a imagem exige texto alternativo (invariante A29 do
 * `MediaAsset`), e o vídeo não — pedir alt de vídeo seria inventar regra, e o
 * painel de envio compartilhado não sabe abrir mão dele. O que os dois
 * compartilham de verdade — ler o arquivo, medir, subir com progresso — está em
 * `lib/media-upload`, que é onde a duplicação custaria caro.
 *
 * A duração é medida NO NAVEGADOR antes de subir, e é isso que faz a lista
 * conseguir dizer "1:12" ao lado de cada arquivo sem baixar nenhum deles.
 */
export function VideoPickerDialog({
	open,
	onOpenChange,
	onPicked,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onPicked: (mediaId: string, durationSeconds: number) => void;
}) {
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);

	const library = useQuery({
		...trpc.media.library.queryOptions({
			type: VIDEO,
			...(search.trim() ? { search: search.trim() } : {}),
			page,
		}),
		enabled: open,
	});

	// biome-ignore lint/correctness/useExhaustiveDependencies: reagir à busca e à abertura, não a `page`
	useEffect(() => {
		setPage(1);
	}, [search, open]);

	const items = library.data?.items ?? [];

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>Escolher vídeo</DialogTitle>
					<DialogDescription>
						Clique num vídeo para usá-lo, ou envie um do seu computador — ele
						entra na biblioteca e já fica escolhido. O trecho que vai ao ar você
						recorta depois.
					</DialogDescription>
				</DialogHeader>

				<VideoUpload
					onUploaded={(mediaId, duration) => {
						onPicked(mediaId, duration);
						onOpenChange(false);
					}}
				/>

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
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
							{["a", "b", "c", "d", "e", "f"].map((k) => (
								<Skeleton key={k} className="aspect-video w-full" />
							))}
						</div>
					) : items.length === 0 ? (
						<p className="py-10 text-center text-muted-foreground text-sm">
							{search
								? "Nenhum vídeo com esse termo."
								: "Nenhum vídeo na biblioteca ainda — envie o primeiro do seu computador."}
						</p>
					) : (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
							{items.map((asset) => (
								<button
									key={asset.id}
									type="button"
									disabled={!asset.durationSeconds}
									onClick={() =>
										onPicked(asset.id, asset.durationSeconds as number)
									}
									className="group overflow-hidden rounded-lg border text-left transition hover:border-brand-accent-ink hover:ring-2 hover:ring-brand-accent/30 disabled:opacity-50"
								>
									<video
										src={asset.url}
										preload="metadata"
										muted
										className="aspect-video w-full bg-black object-contain"
									/>
									<span className="block truncate px-2 py-1.5 text-xs">
										{asset.filename}
									</span>
									<span className="block px-2 pb-1.5 text-muted-foreground text-xs tabular-nums">
										{asset.durationSeconds
											? formatSeconds(asset.durationSeconds)
											: "duração desconhecida"}
									</span>
								</button>
							))}
						</div>
					)}
				</div>

				<PaginationBar
					page={page}
					perPage={library.data?.perPage ?? DEFAULT_PAGE_SIZE}
					total={library.data?.total ?? 0}
					onPageChange={setPage}
					unidade={{ singular: "vídeo", plural: "vídeos" }}
				/>
			</DialogContent>
		</Dialog>
	);
}

/**
 * O envio direto de um vídeo: escolhe, mede, pede crédito e sobe.
 *
 * O crédito continua obrigatório — é invariante do `MediaAsset` e vale para
 * todo arquivo, não só para foto. O texto alternativo não: o agregado só o
 * exige de imagem, e pedi-lo aqui seria a tela inventando uma regra que o
 * domínio não tem.
 */
function VideoUpload({
	onUploaded,
}: {
	onUploaded: (mediaId: string, durationSeconds: number) => void;
}) {
	const creditId = useId();
	const queryClient = useQueryClient();
	const input = useRef<HTMLInputElement | null>(null);
	const [picked, setPicked] = useState<PickedFile | null>(null);
	const [credit, setCredit] = useState("");
	const [progress, setProgress] = useState<number | null>(null);

	const requestUpload = useMutation(trpc.media.requestUpload.mutationOptions());
	const register = useMutation(trpc.media.register.mutationOptions());

	const busy = progress !== null;

	const discard = () => {
		if (picked?.previewUrl) {
			URL.revokeObjectURL(picked.previewUrl);
		}
		setPicked(null);
		setCredit("");
		setProgress(null);
		if (input.current) {
			input.current.value = "";
		}
	};

	const pick = async (file: File | undefined) => {
		if (!file) {
			return;
		}
		try {
			const next = await readPickedFile(file);
			if (next.type !== VIDEO) {
				toast.error("Escolha um arquivo de vídeo (MP4, MOV ou WebM).");
				return;
			}
			setPicked(next);
		} catch (error) {
			toast.error((error as Error).message);
		}
	};

	const upload = async () => {
		if (!picked?.durationSeconds) {
			return;
		}
		try {
			setProgress(0);
			const { key, url } = await requestUpload.mutateAsync({
				filename: picked.file.name,
				contentType: picked.file.type,
			});
			await putWithProgress(url, picked.file, setProgress);
			const created = await register.mutateAsync({
				storageKey: key,
				type: VIDEO,
				filename: picked.file.name,
				mimeType: picked.file.type,
				credit,
				durationSeconds: picked.durationSeconds,
				...(picked.width && picked.height
					? { dimensions: { width: picked.width, height: picked.height } }
					: {}),
			});
			await queryClient.invalidateQueries({
				queryKey: trpc.media.library.queryKey(),
			});
			const duration = picked.durationSeconds;
			discard();
			toast.success("Vídeo enviado.");
			onUploaded(created.id, duration);
		} catch (error) {
			toast.error((error as Error).message);
			setProgress(null);
		}
	};

	const tooLong =
		picked?.durationSeconds !== null &&
		picked?.durationSeconds !== undefined &&
		picked.durationSeconds > RENDER_MAX_SECONDS;

	return (
		<div className="flex flex-col gap-2 rounded-md border p-3">
			<input
				ref={input}
				type="file"
				accept={ACCEPTED_VIDEO_MIME}
				className="hidden"
				onChange={(event) => pick(event.target.files?.[0])}
			/>

			{!picked ? (
				<Button
					type="button"
					variant="outline"
					onClick={() => input.current?.click()}
				>
					<Upload className="size-4" />
					Enviar vídeo do computador
				</Button>
			) : (
				<div className="flex flex-col gap-2">
					<div className="flex items-center gap-2 text-sm">
						<Film className="size-4 shrink-0 text-muted-foreground" />
						<span className="truncate">{picked.file.name}</span>
						<span className="shrink-0 text-muted-foreground tabular-nums">
							{formatSeconds(picked.durationSeconds ?? 0)}
						</span>
					</div>

					{tooLong ? (
						// Aviso, e não recusa: o arquivo sobe inteiro e a redação corta o
						// trecho depois. Recusar aqui obrigaria a editar o vídeo fora do
						// portal justamente no caso em que o corte existe para ajudar.
						<p className="text-amber-700 text-xs dark:text-amber-300">
							O arquivo tem mais de {formatSeconds(RENDER_MAX_SECONDS)} — você
							vai escolher o trecho depois de enviá-lo.
						</p>
					) : null}

					<div className="flex flex-col gap-1">
						<Label htmlFor={creditId} className="text-xs">
							Crédito
						</Label>
						<Input
							id={creditId}
							value={credit}
							disabled={busy}
							onChange={(event) => setCredit(event.target.value)}
							placeholder="Quem gravou — obrigatório"
						/>
					</div>

					{progress !== null ? <Progress value={progress} /> : null}

					<div className="flex gap-2">
						<Button
							type="button"
							size="sm"
							disabled={busy || credit.trim() === ""}
							onClick={upload}
						>
							Enviar e usar
						</Button>
						<Button
							type="button"
							size="sm"
							variant="ghost"
							disabled={busy}
							onClick={discard}
						>
							Cancelar
						</Button>
					</div>
				</div>
			)}
		</div>
	);
}
