"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";

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
			resolve({ file, previewUrl, width: img.naturalWidth, height: img.naturalHeight });
		img.onerror = () => reject(new Error("Arquivo de imagem inválido"));
		img.src = previewUrl;
	});
}

/** PUT direto no storage pela URL pré-assinada, reportando o progresso (A28). */
function putWithProgress(url: string, file: File, onProgress: (pct: number) => void): Promise<void> {
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

export function MediaManager() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const library = useQuery(trpc.media.library.queryOptions(search ? { search } : {}));

	const requestUpload = useMutation(trpc.media.requestUpload.mutationOptions());
	const register = useMutation(trpc.media.register.mutationOptions());

	const inputRef = useRef<HTMLInputElement | null>(null);
	const [picked, setPicked] = useState<Picked | null>(null);
	const [credit, setCredit] = useState("");
	const [altText, setAltText] = useState("");
	const [caption, setCaption] = useState("");
	const [focal, setFocal] = useState({ x: 0.5, y: 0.5 });
	const [progress, setProgress] = useState<number | null>(null);
	const [error, setError] = useState<string | null>(null);

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
		setError(null);
		if (inputRef.current) {
			inputRef.current.value = "";
		}
	};

	const onPick = async (file: File | undefined) => {
		setError(null);
		if (!file) {
			return;
		}
		try {
			setPicked(await readImage(file));
		} catch (err) {
			setError((err as Error).message);
		}
	};

	const onSubmit = async () => {
		if (!picked) {
			return;
		}
		setError(null);
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
			await queryClient.invalidateQueries({ queryKey: trpc.media.library.queryKey() });
			reset();
		} catch (err) {
			setError((err as Error).message);
			setProgress(null);
		}
	};

	const busy = progress !== null;

	return (
		<div>
			{/* Upload */}
			<div className="mb-8 rounded border p-4">
				<h2 className="mb-3 font-bold text-lg">Enviar imagem</h2>

				{!picked ? (
					<input
						ref={inputRef}
						type="file"
						accept="image/*"
						onChange={(event) => onPick(event.target.files?.[0])}
					/>
				) : (
					<div className="grid gap-4 md:grid-cols-2">
						<div>
							{/* Clique na imagem define o ponto focal (o que fica visível no corte). */}
							<button
								type="button"
								className="relative block w-full overflow-hidden rounded border"
								onClick={(event) => {
									const rect = event.currentTarget.getBoundingClientRect();
									setFocal({
										x: Number(((event.clientX - rect.left) / rect.width).toFixed(3)),
										y: Number(((event.clientY - rect.top) / rect.height).toFixed(3)),
									});
								}}
							>
								{/* biome-ignore lint/a11y/useAltText: preview local, alt vem no cadastro */}
								<img src={picked.previewUrl} alt="" className="block max-h-72 w-full object-contain" />
								<span
									className="pointer-events-none absolute h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white bg-brand-red"
									style={{ left: `${focal.x * 100}%`, top: `${focal.y * 100}%` }}
								/>
							</button>
							<p className="mt-1 text-ink-muted text-xs">
								{picked.width}×{picked.height}px · clique para ajustar o ponto focal ({focal.x},{" "}
								{focal.y})
							</p>
						</div>

						<div className="flex flex-col gap-2">
							<label className="text-sm">
								Crédito*
								<input
									value={credit}
									onChange={(event) => setCredit(event.target.value)}
									placeholder="Foto: Fulano/Agência"
									className="mt-1 w-full rounded border px-2 py-1"
								/>
							</label>
							<label className="text-sm">
								Texto alternativo*
								<input
									value={altText}
									onChange={(event) => setAltText(event.target.value)}
									placeholder="Descreva a imagem"
									className="mt-1 w-full rounded border px-2 py-1"
								/>
							</label>
							<label className="text-sm">
								Legenda
								<input
									value={caption}
									onChange={(event) => setCaption(event.target.value)}
									className="mt-1 w-full rounded border px-2 py-1"
								/>
							</label>

							{busy ? (
								<div className="h-2 w-full overflow-hidden rounded bg-neutral-200">
									<div className="h-full bg-brand-red" style={{ width: `${progress}%` }} />
								</div>
							) : null}
							{error ? <p className="text-brand-red text-sm">{error}</p> : null}

							<div className="mt-1 flex gap-2">
								<button
									type="button"
									disabled={busy}
									onClick={onSubmit}
									className="rounded bg-brand-red px-3 py-1 text-sm text-white disabled:opacity-50"
								>
									{busy ? `Enviando… ${progress}%` : "Enviar"}
								</button>
								<button
									type="button"
									disabled={busy}
									onClick={reset}
									className="rounded border px-3 py-1 text-sm"
								>
									Cancelar
								</button>
							</div>
						</div>
					</div>
				)}
			</div>

			{/* Biblioteca */}
			<div className="mb-3 flex items-center justify-between">
				<h2 className="font-bold text-lg">Acervo</h2>
				<input
					value={search}
					onChange={(event) => setSearch(event.target.value)}
					placeholder="Buscar por nome, legenda ou crédito"
					className="w-64 rounded border px-2 py-1 text-sm"
				/>
			</div>

			{library.isLoading ? (
				<p>Carregando…</p>
			) : library.data && library.data.length > 0 ? (
				<ul className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4">
					{library.data.map((asset) => (
						<li key={asset.id} className="overflow-hidden rounded border">
							<img
								src={asset.url}
								alt={asset.altText ?? asset.filename}
								className="aspect-video w-full object-cover"
								style={
									asset.focalPoint
										? { objectPosition: `${asset.focalPoint.x * 100}% ${asset.focalPoint.y * 100}%` }
										: undefined
								}
							/>
							<div className="p-2 text-xs">
								<p className="truncate font-medium">{asset.filename}</p>
								<p className="truncate text-ink-muted">{asset.credit}</p>
							</div>
						</li>
					))}
				</ul>
			) : (
				<p className="text-ink-muted">Nenhuma mídia ainda.</p>
			)}
		</div>
	);
}
