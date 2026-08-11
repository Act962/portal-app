"use client";

import { cn } from "@portal-app/ui/lib/utils";
import { ImageOff } from "lucide-react";
import { useState } from "react";

/**
 * A imagem de um arquivo do acervo, com quadro de reserva quando ela não
 * carrega.
 *
 * Sem isto, o `<img>` cru cai no quadro quebrado do navegador com o texto
 * alternativo solto — e na grade da biblioteca a caixa de seleção, que é
 * `absolute`, passa por cima das primeiras letras desse texto. O painel já
 * tratava o caso do DOCUMENTO ("mostrar um quadro quebrado seria pior do que
 * assumir que não há o que pré-visualizar"); esta é a mesma regra para a
 * imagem que existe no banco mas não resolve no armazenamento.
 *
 * O caso não é hipotético: acontece com arquivo apagado do bucket e com
 * `S3_PUBLIC_URL` apontando para um storage diferente daquele em que a escrita
 * caiu — a troca que o `setup.md` §3.2 descreve.
 *
 * O estado guarda a URL que falhou, não um booleano: assim, trocar o `src`
 * volta a tentar sozinho, sem `useEffect` para desfazer a falha anterior.
 */
export function AssetImage({
	src,
	alt,
	className,
	style,
	label,
	fallbackClassName,
}: {
	src: string;
	alt: string;
	className?: string;
	style?: React.CSSProperties;
	/** Alguma miniatura é pequena demais para caber texto — a lista, de 40px. */
	label?: string;
	/**
	 * Classes só do quadro de reserva. Existe porque a imagem que CARREGA às
	 * vezes não pode ter altura fixa — no painel de detalhe ela usa a proporção
	 * natural do arquivo —, mas um quadro vazio sem altura colapsa.
	 */
	fallbackClassName?: string;
}) {
	const [brokenSrc, setBrokenSrc] = useState<string | null>(null);

	if (brokenSrc === src) {
		return (
			<div
				role="img"
				aria-label={
					alt ? `${alt} (imagem indisponível)` : "Imagem indisponível"
				}
				className={cn(
					"flex flex-col items-center justify-center gap-1 bg-muted text-muted-foreground",
					className,
					fallbackClassName,
				)}
			>
				<ImageOff className="size-4 shrink-0" />
				{label ? (
					<span className="px-2 text-center text-[10px]">{label}</span>
				) : null}
			</div>
		);
	}

	return (
		<img
			src={src}
			alt={alt}
			style={style}
			className={className}
			onError={() => setBrokenSrc(src)}
		/>
	);
}
