"use client";

import { ACCEPTED_UPLOAD_MIME } from "@portal-app/media";
import { Button } from "@portal-app/ui/components/button";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { Progress } from "@portal-app/ui/components/progress";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { cn } from "@portal-app/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImageIcon, Library, Upload, X } from "lucide-react";
import { useId, useRef, useState } from "react";
import { toast } from "sonner";

import { AssetImage } from "@/components/media/asset-image";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import {
	type PickedFile,
	putWithProgress,
	readPickedFile,
} from "@/lib/media-upload";
import { trpc } from "@/utils/trpc";

/**
 * Um campo de IMAGEM: mostra a que está escolhida e deixa trocá-la.
 *
 * Existe porque escolher imagem no painel era, em todo lugar, um botão que
 * abria a biblioteca e voltava sem dizer nada — o campo guardava um id, e o id
 * não é visível. Quem escolhia o logo ou a foto do colunista salvava no escuro
 * e só descobria o resultado abrindo o portal; quem escolhia a imagem errada
 * não tinha como perceber.
 *
 * E o envio direto: exigir uma ida à Biblioteca de mídia para depois voltar e
 * escolher são cinco passos para "usar esta foto aqui". O arquivo continua indo
 * para o acervo (é lá que ele vive, e é de lá que sai a URL pública), mas a
 * TAREFA não passa mais por aquela tela.
 *
 * O que este componente NÃO faz é afrouxar regra: alt-text e crédito são
 * invariantes do `MediaAsset` (A29), então o envio direto pede os dois. São dois
 * campos — e são justamente os dois que ninguém volta para preencher depois.
 */
export function ImageField({
	mediaId,
	onChange,
	pickerTitle = "Escolher da biblioteca",
	hint,
	aspect = "video",
	disabled,
}: {
	mediaId: string | null;
	onChange: (mediaId: string | null) => void;
	pickerTitle?: string;
	/** A linha explicativa sob o campo — o que acontece quando não há imagem. */
	hint?: string;
	/** A moldura do preview. Foto de pessoa é quadrada; logo e capa, 16:9. */
	aspect?: "video" | "square";
	disabled?: boolean;
}) {
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [picking, setPicking] = useState(false);
	const [dragging, setDragging] = useState(false);
	const [picked, setPicked] = useState<PickedFile | null>(null);
	const [credit, setCredit] = useState("");
	const [altText, setAltText] = useState("");
	const [progress, setProgress] = useState<number | null>(null);
	const creditId = useId();
	const altId = useId();

	// A imagem escolhida, buscada pelo id. `get` e não `library`: o asset pode
	// estar em qualquer página do acervo, e pedir a biblioteca inteira para
	// mostrar UMA miniatura foi o erro que a tela da matéria já cometeu.
	const asset = useQuery({
		...trpc.media.get.queryOptions({ id: mediaId ?? "" }),
		enabled: mediaId !== null,
	});

	const requestUpload = useMutation(trpc.media.requestUpload.mutationOptions());
	const register = useMutation(trpc.media.register.mutationOptions());

	const busy = progress !== null;
	const frame =
		aspect === "square" ? "aspect-square w-28" : "aspect-video w-44";

	const discard = () => {
		if (picked?.previewUrl) {
			URL.revokeObjectURL(picked.previewUrl);
		}
		setPicked(null);
		setCredit("");
		setAltText("");
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
			const next = await readPickedFile(file);
			if (next.type !== "IMAGE") {
				// Recusa AQUI, e não depois do envio: este campo é de imagem, e um
				// PDF escolhido por engano não deve custar uma subida inteira para
				// então ser rejeitado.
				toast.error("Este campo aceita imagem — escolha um arquivo de imagem.");
				return;
			}
			setPicked(next);
		} catch (error) {
			toast.error((error as Error).message);
		}
	};

	const upload = async () => {
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
			const created = await register.mutateAsync({
				storageKey: key,
				type: "IMAGE",
				filename: picked.file.name,
				mimeType: picked.file.type,
				credit,
				altText,
				dimensions: {
					width: picked.width as number,
					height: picked.height as number,
				},
			});
			// O arquivo entrou no acervo: a biblioteca precisa saber, senão ele só
			// aparece lá depois de um recarregamento.
			await queryClient.invalidateQueries({
				queryKey: trpc.media.library.queryKey(),
			});
			onChange(created.id);
			discard();
			toast.success("Imagem enviada.");
		} catch (error) {
			toast.error((error as Error).message);
			setProgress(null);
		}
	};

	return (
		<div className="flex flex-col gap-2">
			<input
				ref={inputRef}
				type="file"
				accept={ACCEPTED_UPLOAD_MIME}
				className="hidden"
				onChange={(event) => onPick(event.target.files?.[0])}
			/>

			<div className="flex items-start gap-3">
				{/* O quadro é o alvo de arrastar E o botão de enviar: é para ele que a
				    mão vai, com ou sem imagem dentro. */}
				<button
					type="button"
					disabled={disabled}
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
					className={cn(
						"relative shrink-0 overflow-hidden rounded-md border transition",
						frame,
						dragging
							? "border-brand-red bg-brand-red/5"
							: "border-dashed hover:border-brand-red/50",
					)}
					aria-label={mediaId ? "Trocar a imagem" : "Enviar uma imagem"}
				>
					{mediaId === null ? (
						<span className="flex size-full flex-col items-center justify-center gap-1 text-muted-foreground">
							<ImageIcon className="size-5" />
							<span className="px-2 text-center text-[10px] leading-tight">
								Arraste ou clique
							</span>
						</span>
					) : asset.isLoading ? (
						<Skeleton className="size-full" />
					) : asset.data ? (
						<AssetImage
							src={asset.data.url}
							alt={asset.data.altText ?? ""}
							label="Imagem indisponível"
							className="size-full object-cover"
							style={{
								objectPosition: `${(asset.data.focalPoint?.x ?? 0.5) * 100}% ${(asset.data.focalPoint?.y ?? 0.5) * 100}%`,
							}}
						/>
					) : (
						/* O id aponta para arquivo que não existe mais — apagado da
						   biblioteca por outra pessoa. Dizer isso é melhor do que um
						   quadro vazio que parece "nenhuma imagem escolhida". */
						<span className="flex size-full flex-col items-center justify-center gap-1 px-2 text-center text-[10px] text-destructive leading-tight">
							Arquivo não encontrado
						</span>
					)}
				</button>

				<div className="flex min-w-0 flex-col items-start gap-1.5">
					<div className="flex flex-wrap gap-1.5">
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={disabled}
							onClick={() => inputRef.current?.click()}
						>
							<Upload className="size-4" />
							Enviar do computador
						</Button>
						<Button
							type="button"
							size="sm"
							variant="outline"
							disabled={disabled}
							onClick={() => setPicking(true)}
						>
							<Library className="size-4" />
							Da biblioteca
						</Button>
						{mediaId !== null ? (
							<Button
								type="button"
								size="sm"
								variant="ghost"
								disabled={disabled}
								onClick={() => onChange(null)}
							>
								<X className="size-4" />
								Remover
							</Button>
						) : null}
					</div>
					{asset.data ? (
						<p className="max-w-full truncate text-muted-foreground text-xs">
							{asset.data.filename}
						</p>
					) : null}
					{hint ? (
						<p className="text-muted-foreground text-xs">{hint}</p>
					) : null}
				</div>
			</div>

			{/* Os metadados do envio direto. Ficam INLINE, e não num segundo diálogo:
			    este campo já vive dentro de um (o do colunista), e diálogo sobre
			    diálogo é onde se perde de vista o que se estava fazendo. */}
			{picked ? (
				<div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
					<div className="flex items-start gap-3">
						{picked.previewUrl ? (
							// biome-ignore lint/a11y/useAltText: preview local; o alt é cadastrado ao lado
							<img
								src={picked.previewUrl}
								alt=""
								className={cn("shrink-0 rounded border object-cover", frame)}
							/>
						) : null}
						<div className="min-w-0 text-xs">
							<p className="truncate font-medium">{picked.file.name}</p>
							<p className="text-muted-foreground">
								{picked.width}×{picked.height}px ·{" "}
								{(picked.file.size / 1024).toFixed(0)} KB
							</p>
						</div>
					</div>

					<div>
						<Label htmlFor={creditId}>Crédito *</Label>
						<Input
							id={creditId}
							value={credit}
							onChange={(event) => setCredit(event.target.value)}
							placeholder="Foto: Fulano/Agência"
							className="mt-1.5"
						/>
					</div>

					<div>
						<Label htmlFor={altId}>Texto alternativo *</Label>
						<Input
							id={altId}
							value={altText}
							onChange={(event) => setAltText(event.target.value)}
							placeholder="Descreva o que se vê na imagem"
							className="mt-1.5"
						/>
						<p className="mt-1 text-muted-foreground text-xs">
							Obrigatório: é o que um leitor cego ouve no lugar da foto.
						</p>
					</div>

					{busy ? (
						<div>
							<Progress value={progress ?? 0} />
							<p className="mt-1 text-muted-foreground text-xs">
								Enviando… {progress}%
							</p>
						</div>
					) : null}

					<div className="flex justify-end gap-2">
						<Button
							type="button"
							variant="ghost"
							size="sm"
							disabled={busy}
							onClick={discard}
						>
							Cancelar
						</Button>
						<Button
							type="button"
							size="sm"
							disabled={busy || !credit.trim() || !altText.trim()}
							onClick={upload}
						>
							{busy ? "Enviando…" : "Usar esta imagem"}
						</Button>
					</div>
				</div>
			) : null}

			<MediaPickerDialog
				open={picking}
				onOpenChange={setPicking}
				title={pickerTitle}
				onSelect={(id) => {
					onChange(id);
					setPicking(false);
				}}
			/>
		</div>
	);
}
