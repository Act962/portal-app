"use client";

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
import { Progress } from "@portal-app/ui/components/progress";
import {
	Sheet,
	SheetContent,
	SheetDescription,
	SheetHeader,
	SheetTitle,
} from "@portal-app/ui/components/sheet";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Search, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { trpc } from "@/utils/trpc";

type Picked = {
	file: File;
	previewUrl: string;
	width: number;
	height: number;
};

/** Lê largura/altura reais e gera um preview local (sem subir nada ainda). */
function readImage(file: File): Promise<Picked> {
	return new Promise((resolve, reject) => {
		const previewUrl = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () =>
			resolve({
				file,
				previewUrl,
				width: img.naturalWidth,
				height: img.naturalHeight,
			});
		img.onerror = () => reject(new Error("Arquivo de imagem inválido"));
		img.src = previewUrl;
	});
}

/** PUT direto no storage pela URL pré-assinada, reportando o progresso (A28).
 * O arquivo nunca passa pelo nosso servidor. */
function putWithProgress(
	url: string,
	file: File,
	onProgress: (pct: number) => void,
): Promise<void> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", url);
		xhr.setRequestHeader("Content-Type", file.type);
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				onProgress(Math.round((event.loaded / event.total) * 100));
			}
		};
		xhr.onload = () =>
			xhr.status >= 200 && xhr.status < 300
				? resolve()
				: reject(new Error(`Upload falhou (HTTP ${xhr.status})`));
		xhr.onerror = () => reject(new Error("Falha de rede no upload"));
		xhr.send(file);
	});
}

type Asset = { id: string; url: string; filename: string; credit: string };

export function MediaManager() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const library = useQuery(
		trpc.media.library.queryOptions(search ? { search } : {}),
	);

	const requestUpload = useMutation(trpc.media.requestUpload.mutationOptions());
	const register = useMutation(trpc.media.register.mutationOptions());

	const inputRef = useRef<HTMLInputElement | null>(null);
	const [picked, setPicked] = useState<Picked | null>(null);
	const [credit, setCredit] = useState("");
	const [altText, setAltText] = useState("");
	const [caption, setCaption] = useState("");
	const [focal, setFocal] = useState({ x: 0.5, y: 0.5 });
	const [progress, setProgress] = useState<number | null>(null);
	const [dragging, setDragging] = useState(false);
	const [detail, setDetail] = useState<string | null>(null);

	const reset = () => {
		if (picked) {
			URL.revokeObjectURL(picked.previewUrl);
		}
		setPicked(null);
		setCredit("");
		setAltText("");
		setCaption("");
		setFocal({ x: 0.5, y: 0.5 });
		setProgress(null);
		if (inputRef.current) {
			inputRef.current.value = "";
		}
	};

	const onPick = async (file: File | undefined) => {
		if (!file) {
			return;
		}
		try {
			setPicked(await readImage(file));
		} catch (error) {
			toast.error((error as Error).message);
		}
	};

	const onSubmit = async () => {
		if (!picked) {
			return;
		}
		try {
			setProgress(0);
			const { key, url } = await requestUpload.mutateAsync({
				filename: picked.file.name,
				contentType: picked.file.type,
			});
			await putWithProgress(url, picked.file, setProgress);
			await register.mutateAsync({
				storageKey: key,
				type: "IMAGE",
				filename: picked.file.name,
				mimeType: picked.file.type,
				credit,
				altText,
				caption,
				dimensions: { width: picked.width, height: picked.height },
				focalPoint: focal,
			});
			await queryClient.invalidateQueries({
				queryKey: trpc.media.library.queryKey(),
			});
			toast.success("Imagem enviada.");
			reset();
		} catch (error) {
			toast.error((error as Error).message);
			setProgress(null);
		}
	};

	const busy = progress !== null;
	const assets = library.data ?? [];
	const selected = assets.find((a) => a.id === detail);

	return (
		<>
			<PageHeader
				title="Biblioteca de mídia"
				description="As imagens do portal. Crédito e texto alternativo são obrigatórios — por lei e por acessibilidade."
				actions={
					<Button onClick={() => inputRef.current?.click()}>
						<Upload className="size-4" />
						Enviar imagem
					</Button>
				}
			/>

			<input
				ref={inputRef}
				type="file"
				accept="image/*"
				className="hidden"
				onChange={(event) => onPick(event.target.files?.[0])}
			/>

			{/* Área de arrastar-e-soltar */}
			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				onDragOver={(event) => {
					event.preventDefault();
					setDragging(true);
				}}
				onDragLeave={() => setDragging(false)}
				onDrop={(event) => {
					event.preventDefault();
					setDragging(false);
					onPick(event.dataTransfer.files?.[0]);
				}}
				className={`flex w-full flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 text-sm transition ${
					dragging
						? "border-brand-red bg-brand-red/5"
						: "border-border text-muted-foreground hover:border-brand-red/50"
				}`}
			>
				<ImagePlus className="size-6" />
				Arraste uma imagem aqui, ou clique para escolher
			</button>

			<div className="flex items-center justify-between gap-2">
				<div className="relative w-full max-w-sm">
					<Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
					<Input
						value={search}
						onChange={(event) => setSearch(event.target.value)}
						placeholder="Buscar por nome, legenda ou crédito…"
						className="pl-8"
					/>
				</div>
				<span className="shrink-0 text-muted-foreground text-sm">
					{assets.length} {assets.length === 1 ? "imagem" : "imagens"}
				</span>
			</div>

			{library.isLoading ? (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{["a", "b", "c", "d", "e", "f", "g", "h"].map((k) => (
						<Skeleton key={k} className="aspect-video w-full" />
					))}
				</div>
			) : assets.length === 0 ? (
				<div className="rounded-lg border border-dashed py-16 text-center">
					<p className="font-medium">
						{search ? "Nenhuma imagem com esse termo." : "Nenhuma mídia ainda."}
					</p>
					<p className="mt-1 text-muted-foreground text-sm">
						Envie a primeira para usá-la como capa ou dentro do texto.
					</p>
				</div>
			) : (
				<div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
					{assets.map((asset) => (
						<button
							key={asset.id}
							type="button"
							onClick={() => setDetail(asset.id)}
							className="group overflow-hidden rounded-lg border text-left transition hover:border-brand-red"
						>
							<img
								src={asset.url}
								alt={asset.altText ?? asset.filename}
								className="aspect-video w-full object-cover"
								style={
									asset.focalPoint
										? {
												objectPosition: `${asset.focalPoint.x * 100}% ${asset.focalPoint.y * 100}%`,
											}
										: undefined
								}
							/>
							<div className="p-2">
								<p className="truncate font-medium text-xs">{asset.filename}</p>
								<p className="truncate text-muted-foreground text-xs">
									{asset.credit}
								</p>
							</div>
						</button>
					))}
				</div>
			)}

			{/* Cadastro do que foi escolhido */}
			<Dialog
				open={picked !== null}
				onOpenChange={(open) => {
					if (!open && !busy) {
						reset();
					}
				}}
			>
				<DialogContent className="max-w-3xl">
					<DialogHeader>
						<DialogTitle>Detalhes da imagem</DialogTitle>
						<DialogDescription>
							Clique na imagem para escolher o ponto que nunca deve ser cortado.
						</DialogDescription>
					</DialogHeader>

					{picked ? (
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								{/* O ponto focal decide o que sobra quando a foto é cortada
								    para 16:9 na home ou para o quadrado do celular. */}
								<button
									type="button"
									className="relative block w-full overflow-hidden rounded-md border"
									onClick={(event) => {
										const rect = event.currentTarget.getBoundingClientRect();
										setFocal({
											x: Number(
												((event.clientX - rect.left) / rect.width).toFixed(3),
											),
											y: Number(
												((event.clientY - rect.top) / rect.height).toFixed(3),
											),
										});
									}}
								>
									{/* biome-ignore lint/a11y/useAltText: preview local; o alt é cadastrado ao lado */}
									<img
										src={picked.previewUrl}
										alt=""
										className="block max-h-72 w-full object-contain"
									/>
									<span
										className="pointer-events-none absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-red shadow"
										style={{
											left: `${focal.x * 100}%`,
											top: `${focal.y * 100}%`,
										}}
									/>
								</button>
								<p className="mt-1.5 text-muted-foreground text-xs">
									{picked.width}×{picked.height}px · foco em {focal.x},{focal.y}
								</p>
							</div>

							<div className="flex flex-col gap-3">
								<div>
									<Label htmlFor="credito">Crédito *</Label>
									<Input
										id="credito"
										value={credit}
										onChange={(event) => setCredit(event.target.value)}
										placeholder="Foto: Fulano/Agência"
										className="mt-1.5"
									/>
									<p className="mt-1 text-muted-foreground text-xs">
										Obrigatório: publicar foto sem crédito é violação de direito
										autoral.
									</p>
								</div>

								<div>
									<Label htmlFor="alt">Texto alternativo *</Label>
									<Input
										id="alt"
										value={altText}
										onChange={(event) => setAltText(event.target.value)}
										placeholder="Descreva o que se vê na imagem"
										className="mt-1.5"
									/>
									<p className="mt-1 text-muted-foreground text-xs">
										Obrigatório: é o que um leitor cego ouve no lugar da foto.
									</p>
								</div>

								<div>
									<Label htmlFor="legenda">Legenda</Label>
									<Input
										id="legenda"
										value={caption}
										onChange={(event) => setCaption(event.target.value)}
										placeholder="Aparece sob a foto na matéria"
										className="mt-1.5"
									/>
								</div>

								{busy ? (
									<div>
										<Progress value={progress ?? 0} />
										<p className="mt-1 text-muted-foreground text-xs">
											Enviando… {progress}%
										</p>
									</div>
								) : null}
							</div>
						</div>
					) : null}

					<DialogFooter>
						<Button variant="outline" disabled={busy} onClick={reset}>
							Cancelar
						</Button>
						<Button
							disabled={busy || !credit.trim() || !altText.trim()}
							onClick={onSubmit}
						>
							{busy ? "Enviando…" : "Adicionar à biblioteca"}
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>

			{/* Detalhes de um asset do acervo */}
			<Sheet
				open={detail !== null}
				onOpenChange={(open) => !open && setDetail(null)}
			>
				<SheetContent className="w-full sm:max-w-md">
					{selected ? (
						<>
							<SheetHeader>
								<SheetTitle className="truncate">
									{selected.filename}
								</SheetTitle>
								<SheetDescription>{selected.credit}</SheetDescription>
							</SheetHeader>
							<div className="flex flex-col gap-4 p-4">
								<img
									src={selected.url}
									alt={selected.altText ?? ""}
									className="w-full rounded-md border"
								/>
								<dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-2 text-sm">
									<dt className="text-muted-foreground">Texto alternativo</dt>
									<dd>{selected.altText || "—"}</dd>
									<dt className="text-muted-foreground">Legenda</dt>
									<dd>{selected.caption || "—"}</dd>
									<dt className="text-muted-foreground">Dimensões</dt>
									<dd>
										{selected.width && selected.height
											? `${selected.width}×${selected.height}px`
											: "—"}
									</dd>
								</dl>
								<Button
									variant="outline"
									onClick={() => {
										navigator.clipboard.writeText(selected.url);
										toast.success("Endereço copiado.");
									}}
								>
									Copiar endereço
								</Button>
							</div>
						</>
					) : null}
				</SheetContent>
			</Sheet>
		</>
	);
}
