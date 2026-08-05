import { MediaPlaceholder } from "@portal-app/ui/components/media-placeholder";

import type { Article } from "@/data/types";

/**
 * A imagem de uma matéria numa listagem.
 *
 * Mostra a capa quando existe e o espaço hachurado quando não existe — sempre na
 * MESMA caixa, para que a ausência de foto não mude o layout (o placeholder
 * reserva a altura; é o que mantém o CLS em zero).
 *
 * O recorte respeita o ponto focal escolhido na redação: é ele que decide o que
 * sobra quando a foto vira uma tira de 104×74 no celular ou um 16:9 na home.
 */
export function ArticleThumb({
	article,
	className,
	label,
	tone,
}: {
	article: Article;
	className?: string;
	/** Texto do placeholder quando a matéria não tem capa. */
	label?: string;
	tone?: "light" | "dark";
}) {
	if (!article.cover) {
		return <MediaPlaceholder className={className} label={label} tone={tone} />;
	}

	return (
		// As classes de exibição vêm do chamador (o `md:flex` do placeholder, que
		// centra o rótulo). Aqui só acrescentamos o recorte — sobrescrever o
		// display quebraria a centralização no caso sem capa.
		// biome-ignore lint/a11y/useAltText: alt aplicado via prop
		<img
			src={article.cover.url}
			alt={article.cover.alt}
			loading="lazy"
			style={{
				objectPosition: `${article.cover.focalX * 100}% ${article.cover.focalY * 100}%`,
			}}
			className={`rounded-card object-cover ${className ?? ""}`}
		/>
	);
}
