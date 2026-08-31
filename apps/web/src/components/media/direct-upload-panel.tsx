"use client";

import { Button } from "@portal-app/ui/components/button";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { Progress } from "@portal-app/ui/components/progress";
import { cn } from "@portal-app/ui/lib/utils";
import { useId } from "react";

import type { DirectUpload } from "@/components/media/use-direct-upload";

/**
 * O formulário do envio direto: preview do arquivo escolhido, crédito, texto
 * alternativo e a barra de progresso.
 *
 * Fica INLINE, e nunca num segundo diálogo: quem envia daqui já está dentro de
 * um (a capa, o colunista), e diálogo sobre diálogo é onde se perde de vista o
 * que se estava fazendo.
 */
export function DirectUploadPanel({
	upload,
	frame = "aspect-video w-44",
	confirmLabel = "Usar esta imagem",
}: {
	upload: DirectUpload;
	/** A moldura do preview — a mesma do campo que hospeda o painel. */
	frame?: string;
	confirmLabel?: string;
}) {
	const creditId = useId();
	const altId = useId();

	if (!upload.picked) {
		return null;
	}

	const { picked, busy, progress } = upload;

	return (
		<div className="flex flex-col gap-3 rounded-md border bg-muted/30 p-3">
			<div className="flex items-start gap-3">
				{picked.previewUrl ? (
					// O alt vazio é correto aqui: é preview do arquivo local, e o
					// texto alternativo de verdade está sendo digitado ao lado.
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
					value={upload.credit}
					onChange={(event) => upload.setCredit(event.target.value)}
					placeholder="Foto: Fulano/Agência"
					className="mt-1.5"
				/>
			</div>

			<div>
				<Label htmlFor={altId}>Texto alternativo *</Label>
				<Input
					id={altId}
					value={upload.altText}
					onChange={(event) => upload.setAltText(event.target.value)}
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
					onClick={upload.discard}
				>
					Cancelar
				</Button>
				<Button
					type="button"
					size="sm"
					disabled={busy || !upload.ready}
					onClick={upload.upload}
				>
					{busy ? "Enviando…" : confirmLabel}
				</Button>
			</div>
		</div>
	);
}
