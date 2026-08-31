"use client";

import { ACCEPTED_UPLOAD_MIME } from "@portal-app/media";
import { Button } from "@portal-app/ui/components/button";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { cn } from "@portal-app/ui/lib/utils";
import { useQuery } from "@tanstack/react-query";
import { ImageIcon, Library, Upload, X } from "lucide-react";
import { useState } from "react";

import { AssetImage } from "@/components/media/asset-image";
import { DirectUploadPanel } from "@/components/media/direct-upload-panel";
import { MediaPickerDialog } from "@/components/media/media-picker-dialog";
import { useDirectUpload } from "@/components/media/use-direct-upload";
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
 * TAREFA não passa mais por aquela tela. O fluxo em si mora no
 * `useDirectUpload`, compartilhado com o diálogo da biblioteca.
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
	const [picking, setPicking] = useState(false);
	const [dragging, setDragging] = useState(false);
	const upload = useDirectUpload({ onUploaded: onChange });

	// A imagem escolhida, buscada pelo id. `get` e não `library`: o asset pode
	// estar em qualquer página do acervo, e pedir a biblioteca inteira para
	// mostrar UMA miniatura foi o erro que a tela da matéria já cometeu.
	const asset = useQuery({
		...trpc.media.get.queryOptions({ id: mediaId ?? "" }),
		enabled: mediaId !== null,
	});

	const frame =
		aspect === "square" ? "aspect-square w-28" : "aspect-video w-44";

	return (
		<div className="flex flex-col gap-2">
			<input
				ref={upload.inputRef}
				type="file"
				accept={ACCEPTED_UPLOAD_MIME}
				className="hidden"
				onChange={(event) => upload.pick(event.target.files?.[0])}
			/>

			<div className="flex items-start gap-3">
				{/* O quadro é o alvo de arrastar E o botão de enviar: é para ele que a
				    mão vai, com ou sem imagem dentro. */}
				<button
					type="button"
					disabled={disabled}
					onClick={upload.openPicker}
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
						"relative shrink-0 overflow-hidden rounded-md border transition",
						frame,
						dragging
							? "border-brand-accent-ink bg-brand-accent/5"
							: "border-dashed hover:border-brand-accent-ink/50",
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
							onClick={upload.openPicker}
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

			<DirectUploadPanel upload={upload} frame={frame} />

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
