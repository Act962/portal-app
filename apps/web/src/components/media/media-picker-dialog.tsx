"use client";

import { ACCEPTED_UPLOAD_MIME } from "@portal-app/media";
import { DEFAULT_PAGE_SIZE } from "@portal-app/shared-kernel";
import { Button } from "@portal-app/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { cn } from "@portal-app/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { Search, Upload } from "lucide-react";
import { useEffect, useState } from "react";

import { PaginationBar } from "@/components/admin/pagination-bar";
import { AssetImage } from "@/components/media/asset-image";
import { DirectUploadPanel } from "@/components/media/direct-upload-panel";
import { useDirectUpload } from "@/components/media/use-direct-upload";
import { trpc } from "@/utils/trpc";

/**
 * Escolhe um asset da biblioteca. Usado pelo editor (imagem no meio do texto) e
 * pela tela da matéria (capa) — a mesma grade, para a redação não aprender dois
 * jeitos de fazer a mesma coisa.
 *
 * E envia do computador SEM SAIR DAQUI. Antes, a foto que ainda não estava no
 * acervo custava a viagem completa — fechar o diálogo, ir à Biblioteca de
 * mídia, subir o arquivo, voltar à matéria, reabrir o diálogo e procurar. A
 * imagem enviada aqui entra no acervo (é lá que ela vive) e já volta escolhida:
 * o `onSelect` dispara com o id recém-criado, então quem abriu para trocar a
 * capa sai daqui com a capa trocada.
 */
export function MediaPickerDialog({
	open,
	onOpenChange,
	onSelect,
	title = "Escolher da biblioteca",
	confirmLabel = "Usar esta imagem",
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onSelect: (mediaId: string) => void;
	title?: string;
	/** O rótulo do botão que conclui o envio direto — diz o que vai acontecer. */
	confirmLabel?: string;
}) {
	const [search, setSearch] = useState("");
	const [page, setPage] = useState(1);
	const [dragging, setDragging] = useState(false);
	const upload = useDirectUpload({
		onUploaded: (mediaId) => {
			// Enviou: já é a escolha. Obrigar a achar o arquivo recém-subido na
			// grade seria repetir, dentro do diálogo, a viagem que ele evita.
			onSelect(mediaId);
			onOpenChange(false);
		},
	});
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
		<Dialog
			open={open}
			onOpenChange={(next) => {
				// Fechar no meio de um envio deixaria crédito e alt digitados presos
				// num estado invisível — e o arquivo escolhido, pendurado.
				if (!next) {
					upload.discard();
				}
				onOpenChange(next);
			}}
		>
			<DialogContent className="max-w-3xl">
				<DialogHeader>
					<DialogTitle>{title}</DialogTitle>
					<DialogDescription>
						Clique numa imagem para usá-la, ou envie uma nova do seu computador
						— ela entra na biblioteca e já fica escolhida.
					</DialogDescription>
				</DialogHeader>

				<input
					ref={upload.inputRef}
					type="file"
					accept={ACCEPTED_UPLOAD_MIME}
					className="hidden"
					onChange={(event) => upload.pick(event.target.files?.[0])}
				/>

				<div className="flex flex-wrap items-center gap-2">
					<div className="relative min-w-56 flex-1">
						<Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground" />
						<Input
							value={search}
							onChange={(event) => setSearch(event.target.value)}
							placeholder="Buscar por nome ou crédito…"
							className="pl-8"
						/>
					</div>
					<Button type="button" variant="outline" onClick={upload.openPicker}>
						<Upload className="size-4" />
						Enviar do computador
					</Button>
				</div>

				{/* O painel do envio aparece ACIMA da grade: é o que a pessoa acabou de
				    fazer, e procurar por ele rolando a lista seria perder o passo. */}
				<DirectUploadPanel upload={upload} confirmLabel={confirmLabel} />

				{/* A grade inteira é alvo de arrastar — é para onde a mão leva o
				    arquivo quando a intenção é "esta imagem, aqui". */}
				{/* biome-ignore lint/a11y/noStaticElementInteractions: soltar arquivo é atalho; o botão de enviar continua sendo o caminho pelo teclado */}
				<div
					onDragOver={(event) => {
						event.preventDefault();
						setDragging(true);
					}}
					onDragLeave={() => setDragging(false)}
					onDrop={(event) => {
						event.preventDefault();
						setDragging(false);
						upload.pick(event.dataTransfer.files?.[0]);
					}}
					className={cn(
						"max-h-96 overflow-y-auto rounded-md border border-transparent transition",
						dragging &&
							"border-brand-accent-ink border-dashed bg-brand-accent/5",
					)}
				>
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
								: "A biblioteca ainda está vazia — envie a primeira do seu computador."}
						</p>
					) : (
						<div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
							{items.map((asset) => (
								<button
									key={asset.id}
									type="button"
									onClick={() => onSelect(asset.id)}
									className="group overflow-hidden rounded-lg border text-left transition hover:border-brand-accent-ink hover:ring-2 hover:ring-brand-accent/30"
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
