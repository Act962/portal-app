"use client";

import {
	ACCEPTED_UPLOAD_MIME,
	type MediaType,
	mediaTypeFromMime,
} from "@portal-app/media";
import { DEFAULT_PAGE_SIZE } from "@portal-app/shared-kernel";
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
import { cn } from "@portal-app/ui/lib/utils";
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
import {
	FileText,
	FolderPlus,
	ImagePlus,
	Pencil,
	Search,
	Trash2,
	Upload,
	X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import { PaginationBar } from "@/components/admin/pagination-bar";
import { toast } from "sonner";

import { PageHeader } from "@/components/admin/page-header";
import { trpc } from "@/utils/trpc";

type Picked = {
	file: File;
	/** Derivado do mime pelo DOMÍNIO — a tela não classifica (D6). */
	type: MediaType;
	/** Só imagem tem preview local; documento não abre em `<img>`. */
	previewUrl: string | null;
	width: number | null;
	height: number | null;
};

/** Filtro de pasta: todas, sem pasta, ou o id de uma. */
const ALL = "__all__";
const NONE = "__none__";

/**
 * Prepara o arquivo escolhido. Imagem tem preview e dimensões reais lidas aqui
 * (o domínio as exige, A29); documento não tem nem uma coisa nem outra — e
 * exigir seria inventar regra para PDF.
 *
 * A classificação é do DOMÍNIO (`mediaTypeFromMime`), não desta tela: aqui só
 * se pergunta "é imagem?" para decidir se vale abrir um `<img>`.
 */
function readPicked(file: File): Promise<Picked> {
	const type = mediaTypeFromMime(file.type);
	if (type.isErr()) {
		return Promise.reject(new Error(type.unwrapErr().message));
	}
	const mediaType = type.unwrap();

	if (mediaType !== "IMAGE") {
		return Promise.resolve({
			file,
			type: mediaType,
			previewUrl: null,
			width: null,
			height: null,
		});
	}

	return new Promise((resolve, reject) => {
		const previewUrl = URL.createObjectURL(file);
		const img = new Image();
		img.onload = () =>
			resolve({
				file,
				type: "IMAGE",
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

type Asset = {
	id: string;
	url: string;
	filename: string;
	credit: string;
	type: string;
	folderId: string | null;
};

export function MediaManager() {
	const queryClient = useQueryClient();
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [folderId, setFolderId] = useState<string>(ALL);
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

	const library = useQuery(
		trpc.media.library.queryOptions({
			...(search ? { search } : {}),
			...(folderId === ALL
				? {}
				: { folderId: folderId === NONE ? null : folderId }),
			page,
		}),
	);
	const folders = useQuery(trpc.media.folders.list.queryOptions());

	// Buscou, volta para a primeira página — senão a busca feita na página 3
	// devolve vazio e parece que não achou nada.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reagir à busca e à pasta, não a `page`
	useEffect(() => {
		setPage(1);
		// A seleção não sobrevive à troca de recorte: agir sobre itens que saíram
		// da tela é o caminho mais curto para apagar o que não se queria.
		setSelectedIds(new Set());
	}, [search, folderId]);

	const requestUpload = useMutation(trpc.media.requestUpload.mutationOptions());
	const register = useMutation(trpc.media.register.mutationOptions());

	const refreshLibrary = () =>
		Promise.all([
			queryClient.invalidateQueries({ queryKey: trpc.media.library.queryKey() }),
			queryClient.invalidateQueries({
				queryKey: trpc.media.folders.list.queryKey(),
			}),
		]);

	const onMutationError = (error: { message: string }) =>
		toast.error(error.message);

	const createFolder = useMutation(
		trpc.media.folders.create.mutationOptions({
			onSuccess: async (folder) => {
				await refreshLibrary();
				toast.success(`Pasta "${folder.name}" criada.`);
			},
			onError: onMutationError,
		}),
	);
	const renameFolder = useMutation(
		trpc.media.folders.rename.mutationOptions({
			onSuccess: async () => {
				await refreshLibrary();
				toast.success("Pasta renomeada.");
			},
			onError: onMutationError,
		}),
	);
	const removeFolder = useMutation(
		trpc.media.folders.remove.mutationOptions({
			onSuccess: async () => {
				await refreshLibrary();
				setFolderId(ALL);
				toast.success("Pasta excluída.");
			},
			// A recusa por pasta cheia chega AQUI, com a contagem na mensagem —
			// é o caminho normal, não uma falha inesperada.
			onError: onMutationError,
		}),
	);

	/** Relatório item a item vira uma frase só (D7). */
	const reportBulk = (
		outcome: { ok: string[]; failed: Array<{ reason: string }> },
		verbo: string,
	) => {
		if (outcome.failed.length === 0) {
			toast.success(`${outcome.ok.length} ${verbo}.`);
			return;
		}
		// O motivo do PRIMEIRO basta: numa seleção, a causa costuma ser a mesma.
		toast.warning(
			`${outcome.ok.length} ${verbo}, ${outcome.failed.length} não: ${outcome.failed[0]?.reason}`,
		);
	};

	const removeMany = useMutation(
		trpc.media.removeMany.mutationOptions({
			onSuccess: async (outcome) => {
				await refreshLibrary();
				setSelectedIds(new Set());
				reportBulk(outcome, "excluído(s)");
			},
			onError: onMutationError,
		}),
	);
	const moveMany = useMutation(
		trpc.media.moveMany.mutationOptions({
			onSuccess: async (outcome) => {
				await refreshLibrary();
				setSelectedIds(new Set());
				reportBulk(outcome, "movido(s)");
			},
			onError: onMutationError,
		}),
	);
	const removeAsset = useMutation(
		trpc.media.remove.mutationOptions({
			onSuccess: async () => {
				await refreshLibrary();
				setDetail(null);
				toast.success("Arquivo excluído.");
			},
			onError: onMutationError,
		}),
	);

	const inputRef = useRef<HTMLInputElement | null>(null);
	const [picked, setPicked] = useState<Picked | null>(null);
	const [credit, setCredit] = useState("");
	const [altText, setAltText] = useState("");
	const [caption, setCaption] = useState("");
	const [focal, setFocal] = useState({ x: 0.5, y: 0.5 });
	const [progress, setProgress] = useState<number | null>(null);
	const [dragging, setDragging] = useState(false);
	const [detail, setDetail] = useState<string | null>(null);
	const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
	const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
	const [folderDialog, setFolderDialog] = useState<
		{ mode: "create" } | { mode: "rename"; id: string; name: string } | null
	>(null);
	const [folderName, setFolderName] = useState("");
	const [confirmFolderDelete, setConfirmFolderDelete] = useState<string | null>(
		null,
	);

	const reset = () => {
		if (picked?.previewUrl) {
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
			setPicked(await readPicked(file));
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
			const isImage = picked.type === "IMAGE";
			await register.mutateAsync({
				storageKey: key,
				type: picked.type,
				filename: picked.file.name,
				mimeType: picked.file.type,
				credit,
				caption,
				// Alt-text, dimensões e ponto focal são invariantes de IMAGEM
				// (A29). Mandá-los para um PDF seria inventar dado.
				...(isImage
					? {
							altText,
							dimensions: {
								width: picked.width as number,
								height: picked.height as number,
							},
							focalPoint: focal,
						}
					: {}),
				...(folderId !== ALL ? { folderId: folderId === NONE ? null : folderId } : {}),
			});
			await queryClient.invalidateQueries({
				queryKey: trpc.media.library.queryKey(),
			});
			toast.success(isImage ? "Imagem enviada." : "Arquivo enviado.");
			reset();
		} catch (error) {
			toast.error((error as Error).message);
			setProgress(null);
		}
	};

	const toggleSelected = (id: string) =>
		setSelectedIds((current) => {
			const next = new Set(current);
			if (!next.delete(id)) {
				next.add(id);
			}
			return next;
		});

	const busy = progress !== null;
	const assets = library.data?.items ?? [];
	const total = library.data?.total ?? 0;
	const perPage = library.data?.perPage ?? DEFAULT_PAGE_SIZE;
	const selected = assets.find((a) => a.id === detail);

	return (
		<>
			<PageHeader
				title="Biblioteca de mídia"
				description="Imagens e documentos do portal. Crédito é sempre obrigatório; texto alternativo, só para imagens — por lei e por acessibilidade."
				actions={
					<div className="flex items-center gap-2">
						<Button
							variant="outline"
							onClick={() => {
								setFolderName("");
								setFolderDialog({ mode: "create" });
							}}
						>
							<FolderPlus className="size-4" />
							Nova pasta
						</Button>
						<Button onClick={() => inputRef.current?.click()}>
							<Upload className="size-4" />
							Enviar arquivo
						</Button>
					</div>
				}
			/>

			<input
				ref={inputRef}
				type="file"
				accept={ACCEPTED_UPLOAD_MIME}
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

			{/* Pastas como FILTRO, não como navegação: a biblioteca continua sendo
			    uma tela só, e "Todas" nunca fica longe de um clique. */}
			<div className="flex flex-wrap items-center gap-1.5">
				<FolderChip
					label="Todas"
					active={folderId === ALL}
					onClick={() => setFolderId(ALL)}
				/>
				<FolderChip
					label="Sem pasta"
					active={folderId === NONE}
					onClick={() => setFolderId(NONE)}
				/>
				{(folders.data ?? []).map((folder) => (
					<FolderChip
						key={folder.id}
						label={folder.name}
						active={folderId === folder.id}
						onClick={() => setFolderId(folder.id)}
						onRename={() => {
							setFolderName(folder.name);
							setFolderDialog({
								mode: "rename",
								id: folder.id,
								name: folder.name,
							});
						}}
						onDelete={() => setConfirmFolderDelete(folder.id)}
					/>
				))}
			</div>

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
					{total} {total === 1 ? "arquivo" : "arquivos"}
				</span>
			</div>

			{/* Barra de ações da seleção. Só existe quando há seleção — uma barra
			    permanente com botões inertes ensina a ignorá-la. */}
			{selectedIds.size > 0 ? (
				<div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/40 px-3 py-2">
					<span className="font-medium text-sm">
						{selectedIds.size} selecionado(s)
					</span>
					<div className="flex-1" />
					<select
						className="h-8 rounded-lg border bg-background px-2 text-sm"
						value=""
						disabled={moveMany.isPending}
						aria-label="Mover seleção para"
						onChange={(event) => {
							const value = event.target.value;
							if (!value) {
								return;
							}
							// Mover NÃO pede confirmação (D8): é reversível num clique, e um
							// diálogo a cada movimento ensina a clicar "Sim" sem ler.
							moveMany.mutate({
								ids: [...selectedIds],
								folderId: value === NONE ? null : value,
							});
						}}
					>
						<option value="">Mover para…</option>
						<option value={NONE}>Sem pasta</option>
						{(folders.data ?? []).map((folder) => (
							<option key={folder.id} value={folder.id}>
								{folder.name}
							</option>
						))}
					</select>
					<Button
						variant="destructive"
						size="sm"
						disabled={removeMany.isPending}
						onClick={() => setConfirmBulkDelete(true)}
					>
						<Trash2 className="size-4" />
						Excluir
					</Button>
					<Button
						variant="ghost"
						size="sm"
						onClick={() => setSelectedIds(new Set())}
					>
						<X className="size-4" />
						Limpar
					</Button>
				</div>
			) : null}

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
					{assets.map((asset) => {
						const isSelected = selectedIds.has(asset.id);
						return (
							<div
								key={asset.id}
								className={cn(
									"group relative overflow-hidden rounded-lg border transition",
									isSelected
										? "border-brand-red ring-2 ring-brand-red/30"
										: "hover:border-brand-red",
								)}
							>
								{/* A caixa de seleção fica FORA do botão que abre o detalhe:
								    aninhar um controle dentro do outro tornaria impossível
								    marcar sem abrir. */}
								<label className="absolute top-2 left-2 z-10 flex size-6 cursor-pointer items-center justify-center rounded border bg-background/90 shadow-sm">
									<input
										type="checkbox"
										className="size-3.5 cursor-pointer"
										checked={isSelected}
										aria-label={`Selecionar ${asset.filename}`}
										onChange={() => toggleSelected(asset.id)}
									/>
								</label>

								<button
									type="button"
									onClick={() => setDetail(asset.id)}
									className="block w-full text-left"
								>
									{asset.type === "IMAGE" ? (
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
									) : (
										<div className="flex aspect-video w-full flex-col items-center justify-center gap-1 bg-muted text-muted-foreground">
											<FileText className="size-7" />
											<span className="font-mono text-[10px] uppercase">
												{asset.filename.split(".").pop()}
											</span>
										</div>
									)}
									<div className="p-2">
										<p className="truncate font-medium text-xs">
											{asset.filename}
										</p>
										<p className="truncate text-muted-foreground text-xs">
											{asset.credit}
										</p>
									</div>
								</button>
							</div>
						);
					})}
				</div>
			)}

			<PaginationBar
				page={page}
				perPage={perPage}
				total={total}
				onPageChange={setPage}
				unidade={{ singular: "imagem", plural: "imagens" }}
			/>

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
						<DialogTitle>
							{picked?.type === "IMAGE"
								? "Detalhes da imagem"
								: "Detalhes do arquivo"}
						</DialogTitle>
						<DialogDescription>
							{picked?.type === "IMAGE"
								? "Clique na imagem para escolher o ponto que nunca deve ser cortado."
								: "Documento não tem recorte nem texto alternativo — só crédito e legenda."}
						</DialogDescription>
					</DialogHeader>

					{picked ? (
						<div className="grid gap-4 md:grid-cols-2">
							<div>
								{/* Documento não abre em `<img>`: mostrar um quadro quebrado
								    seria pior do que assumir que não há o que pré-visualizar. */}
								{picked.previewUrl === null ? (
									<div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed p-10 text-muted-foreground">
										<FileText className="size-8" />
										<span className="max-w-full truncate text-sm">
											{picked.file.name}
										</span>
										<span className="text-xs">
											{(picked.file.size / 1024).toFixed(0)} KB
										</span>
									</div>
								) : (
								/* O ponto focal decide o que sobra quando a foto é cortada
								   para 16:9 na home ou para o quadrado do celular. */
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
								)}
								{picked.previewUrl !== null ? (
									<p className="mt-1.5 text-muted-foreground text-xs">
										{picked.width}×{picked.height}px · foco em {focal.x},
										{focal.y}
									</p>
								) : null}
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

								{/* Só imagem. Alt-text de PDF não existe, e pedir um
								    inventaria dado que ninguém sabe preencher (D6). */}
								{picked.type === "IMAGE" ? (
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
								) : null}

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
							disabled={
								busy ||
								!credit.trim() ||
								// Alt-text trava o envio só quando o domínio o exige.
								(picked?.type === "IMAGE" && !altText.trim())
							}
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
								{selected.type === "IMAGE" ? (
									<img
										src={selected.url}
										alt={selected.altText ?? ""}
										className="w-full rounded-md border"
									/>
								) : (
									<div className="flex flex-col items-center gap-2 rounded-md border border-dashed p-10 text-muted-foreground">
										<FileText className="size-10" />
										<span className="text-sm">Documento</span>
									</div>
								)}
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
								<Button
									variant="destructive"
									disabled={removeAsset.isPending}
									onClick={() => setConfirmDeleteId(selected.id)}
								>
									<Trash2 className="size-4" />
									Excluir arquivo
								</Button>
							</div>
						</>
					) : null}
				</SheetContent>
			</Sheet>

			{/* Pasta: criar / renomear */}
			<Dialog
				open={folderDialog !== null}
				onOpenChange={(open) => !open && setFolderDialog(null)}
			>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							if (!folderDialog) {
								return;
							}
							if (folderDialog.mode === "create") {
								createFolder.mutate(
									{ name: folderName },
									{ onSuccess: () => setFolderDialog(null) },
								);
							} else {
								renameFolder.mutate(
									{ id: folderDialog.id, name: folderName },
									{ onSuccess: () => setFolderDialog(null) },
								);
							}
						}}
					>
						<DialogHeader>
							<DialogTitle>
								{folderDialog?.mode === "create"
									? "Nova pasta"
									: "Renomear pasta"}
							</DialogTitle>
							<DialogDescription>
								O nome é como a pasta aparece no filtro da biblioteca.
							</DialogDescription>
						</DialogHeader>
						<div className="py-4">
							{/* biome-ignore lint/a11y/noAutofocus: campo único do diálogo */}
							<Input
								autoFocus
								value={folderName}
								onChange={(event) => setFolderName(event.target.value)}
								placeholder="Ex.: Eleições 2026"
							/>
						</div>
						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setFolderDialog(null)}
							>
								Cancelar
							</Button>
							<Button
								type="submit"
								disabled={
									!folderName.trim() ||
									createFolder.isPending ||
									renameFolder.isPending
								}
							>
								Salvar
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

			{/* As três confirmações. O texto diz a CONSEQUÊNCIA, não "tem
			    certeza?" — que ninguém lê (D8). */}
			<ConfirmDialog
				open={confirmFolderDelete !== null}
				onOpenChange={(open) => !open && setConfirmFolderDelete(null)}
				title="Excluir pasta?"
				description="A pasta some do filtro. Os arquivos não são apagados — e se houver algum dentro, a exclusão é recusada."
				confirmLabel="Excluir pasta"
				pending={removeFolder.isPending}
				onConfirm={() => {
					if (confirmFolderDelete) {
						removeFolder.mutate(
							{ id: confirmFolderDelete },
							{ onSettled: () => setConfirmFolderDelete(null) },
						);
					}
				}}
			/>

			<ConfirmDialog
				open={confirmBulkDelete}
				onOpenChange={setConfirmBulkDelete}
				title={`Excluir ${selectedIds.size} arquivo(s)?`}
				description="Os arquivos saem da biblioteca e do armazenamento. Esta ação não pode ser desfeita. Arquivos em uso por alguma matéria são preservados e reportados."
				confirmLabel="Excluir"
				pending={removeMany.isPending}
				onConfirm={() => {
					removeMany.mutate(
						{ ids: [...selectedIds] },
						{ onSettled: () => setConfirmBulkDelete(false) },
					);
				}}
			/>

			<ConfirmDialog
				open={confirmDeleteId !== null}
				onOpenChange={(open) => !open && setConfirmDeleteId(null)}
				title="Excluir este arquivo?"
				description="Ele sai da biblioteca e do armazenamento. Esta ação não pode ser desfeita."
				confirmLabel="Excluir"
				pending={removeAsset.isPending}
				onConfirm={() => {
					if (confirmDeleteId) {
						removeAsset.mutate(
							{ id: confirmDeleteId },
							{ onSettled: () => setConfirmDeleteId(null) },
						);
					}
				}}
			/>
		</>
	);
}

/** Confirmação de ação destrutiva. O botão diz o VERBO, não "OK". */
function ConfirmDialog({
	open,
	onOpenChange,
	title,
	description,
	confirmLabel,
	pending,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	confirmLabel: string;
	pending: boolean;
	onConfirm: () => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>{description}</DialogDescription>
				</DialogHeader>
				<DialogFooter>
					<Button variant="outline" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button variant="destructive" disabled={pending} onClick={onConfirm}>
						{confirmLabel}
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}

/**
 * Uma pasta na barra de filtro. Renomear e excluir aparecem só no hover da
 * pasta ativa — mostrar dois ícones em cada chip transforma a barra num
 * painel de controle e esconde o que ela é: um filtro.
 */
function FolderChip({
	label,
	active,
	onClick,
	onRename,
	onDelete,
}: {
	label: string;
	active: boolean;
	onClick: () => void;
	onRename?: () => void;
	onDelete?: () => void;
}) {
	return (
		<span
			className={cn(
				"group inline-flex items-center gap-1 rounded-full border py-1 pr-1 pl-3 text-sm transition",
				active
					? "border-brand-red bg-brand-red/10 text-brand-red"
					: "hover:border-brand-red/50",
			)}
		>
			<button type="button" onClick={onClick} className="cursor-pointer">
				{label}
			</button>
			{onRename && onDelete ? (
				<span
					className={cn(
						"flex items-center gap-0.5 transition",
						active ? "opacity-100" : "opacity-0 group-hover:opacity-100",
					)}
				>
					<button
						type="button"
						aria-label={`Renomear ${label}`}
						onClick={onRename}
						className="rounded-full p-1 hover:bg-background"
					>
						<Pencil className="size-3" />
					</button>
					<button
						type="button"
						aria-label={`Excluir ${label}`}
						onClick={onDelete}
						className="rounded-full p-1 hover:bg-background"
					>
						<Trash2 className="size-3" />
					</button>
				</span>
			) : null}
		</span>
	);
}
