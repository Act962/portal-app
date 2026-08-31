"use client";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRef, useState } from "react";
import { toast } from "sonner";

import {
	type PickedFile,
	putWithProgress,
	readPickedFile,
} from "@/lib/media-upload";
import { trpc } from "@/utils/trpc";

/**
 * O ENVIO DIRETO de uma imagem, de ponta a ponta: escolher o arquivo, cadastrar
 * crédito e alt, subir para o storage e devolver o id do asset criado.
 *
 * Saiu de dentro do `ImageField` quando o diálogo de capa passou a precisar do
 * mesmo fluxo. Copiar teria produzido duas conversas com o storage, e a segunda
 * cópia é a que envelhece calada — a primeira é a que todo mundo lembra de
 * corrigir.
 *
 * O que este hook NÃO faz é afrouxar regra: crédito e texto alternativo são
 * invariantes do `MediaAsset` (A29) e continuam obrigatórios aqui, porque são
 * justamente os dois campos que ninguém volta para preencher depois.
 */
export function useDirectUpload({
	onUploaded,
}: {
	onUploaded: (mediaId: string) => void;
}) {
	const queryClient = useQueryClient();
	const inputRef = useRef<HTMLInputElement | null>(null);
	const [picked, setPicked] = useState<PickedFile | null>(null);
	const [credit, setCredit] = useState("");
	const [altText, setAltText] = useState("");
	const [progress, setProgress] = useState<number | null>(null);

	const requestUpload = useMutation(trpc.media.requestUpload.mutationOptions());
	const register = useMutation(trpc.media.register.mutationOptions());

	const busy = progress !== null;
	const ready =
		picked !== null && credit.trim() !== "" && altText.trim() !== "";

	const discard = () => {
		if (picked?.previewUrl) {
			URL.revokeObjectURL(picked.previewUrl);
		}
		setPicked(null);
		setCredit("");
		setAltText("");
		setProgress(null);
		if (inputRef.current) {
			// Sem isto, reescolher O MESMO arquivo não dispara `change` e a tela
			// fica parada sem explicação.
			inputRef.current.value = "";
		}
	};

	const openPicker = () => inputRef.current?.click();

	const pick = async (file: File | undefined) => {
		if (!file) {
			return;
		}
		try {
			const next = await readPickedFile(file);
			if (next.type !== "IMAGE") {
				// Recusa AQUI, e não depois do envio: o campo é de imagem, e um PDF
				// escolhido por engano não deve custar uma subida inteira para
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
			onUploaded(created.id);
			discard();
			toast.success("Imagem enviada.");
		} catch (error) {
			toast.error((error as Error).message);
			setProgress(null);
		}
	};

	return {
		inputRef,
		picked,
		credit,
		setCredit,
		altText,
		setAltText,
		progress,
		busy,
		ready,
		openPicker,
		pick,
		upload,
		discard,
	};
}

export type DirectUpload = ReturnType<typeof useDirectUpload>;
