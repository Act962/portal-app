import {
	Caption,
	type DeliveryStatus,
	PLATFORM_LABEL,
	PLATFORM_LIMITS,
	type PostStatus,
	type SocialPlatform,
} from "@portal-app/social";

/**
 * A lógica da tela de redes sociais, SEM JSX e SEM React.
 *
 * Mora aqui, e não dentro do componente, pela regra de testes do projeto: o que
 * decide rótulo, cor e quais botões aparecem é regra, e regra escondida em JSX
 * só se testa montando componente. O modelo é o `serialize.ts` do editor.
 */

/** O estado do post como a redação o entende. `PARCIAL` cru não diz nada. */
export const POST_STATUS_LABELS: Record<PostStatus, string> = {
	RASCUNHO: "Aguardando aprovação",
	PUBLICANDO: "Enviando",
	PUBLICADO: "Publicado",
	PARCIAL: "Publicado em parte",
	FALHOU: "Falhou",
	CANCELADA: "Descartado",
};

/** A cor carrega significado: no ar (verde), a caminho (azul), parado (cinza),
 * precisa de atenção (âmbar/vermelho). */
export const POST_STATUS_CLASSES: Record<PostStatus, string> = {
	RASCUNHO: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
	PUBLICANDO: "bg-sky-100 text-sky-900 dark:bg-sky-950 dark:text-sky-200",
	PUBLICADO:
		"bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
	PARCIAL:
		"bg-orange-100 text-orange-900 dark:bg-orange-950 dark:text-orange-200",
	FALHOU: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
	CANCELADA: "bg-muted text-muted-foreground line-through",
};

export const DELIVERY_STATUS_LABELS: Record<DeliveryStatus, string> = {
	PENDENTE: "na fila",
	PUBLICADO: "no ar",
	FALHOU: "falhou",
};

/**
 * Quais botões a tela mostra para cada estado.
 *
 * Devolve DADO, não JSX, para a regra caber num teste de tabela. E é regra de
 * verdade: oferecer "Aprovar" num post que já está no ar leva ao segundo post
 * que o agregado recusa — o erro vira mensagem vermelha em vez de nunca ter
 * sido oferecido.
 */
export type PostAction = "aprovar" | "editar" | "descartar" | "tentar-de-novo";

export function availableActions(status: PostStatus): readonly PostAction[] {
	switch (status) {
		case "RASCUNHO":
			return ["aprovar", "editar", "descartar"];
		// Enviando: nada a fazer senão esperar. Um "cancelar" aqui mentiria — a
		// chamada à Meta já pode ter saído.
		case "PUBLICANDO":
			return [];
		case "PARCIAL":
		case "FALHOU":
			return ["tentar-de-novo"];
		default:
			return [];
	}
}

/** O contador de uma rede, como a tela o mostra. */
export type CaptionCounter = {
	platform: SocialPlatform;
	label: string;
	length: number;
	max: number;
	over: boolean;
	hashtags: number;
	hashtagMax: number;
	hashtagsOver: boolean;
};

/**
 * Quanto a legenda mede em cada rede escolhida.
 *
 * Usa o `Caption` do DOMÍNIO — a mesma contagem por pontos de código que decide
 * se o post pode subir. Reimplementar aqui um `text.length` faria a tela dizer
 * que cabe uma legenda que o servidor recusa, e o emoji (que toda chamada de
 * portal tem) é exatamente onde os dois números divergem.
 */
export function captionCounters(
	text: string,
	platforms: readonly SocialPlatform[],
): readonly CaptionCounter[] {
	const caption = Caption.restore(text);
	return platforms.map((platform) => {
		const limits = PLATFORM_LIMITS[platform];
		return {
			platform,
			label: PLATFORM_LABEL[platform],
			length: caption.length,
			max: limits.captionMaxLength,
			over: caption.exceedsLengthFor(platform),
			hashtags: caption.hashtags.length,
			hashtagMax: limits.hashtagMaxCount,
			hashtagsOver: caption.exceedsHashtagsFor(platform),
		};
	});
}

/**
 * O resumo das entregas numa linha: "Instagram no ar · Facebook falhou".
 *
 * Existe para o cartão da fila não precisar de uma tabela só para dizer onde o
 * post está. A ordem é a das entregas, que o repositório já devolve estável.
 */
export function summarizeDeliveries(
	deliveries: readonly { platform: SocialPlatform; status: DeliveryStatus }[],
): string {
	if (deliveries.length === 0) {
		return "Nenhuma rede escolhida";
	}
	return deliveries
		.map(
			(delivery) =>
				`${PLATFORM_LABEL[delivery.platform]} ${DELIVERY_STATUS_LABELS[delivery.status]}`,
		)
		.join(" · ");
}

/** Corta a legenda para caber no cartão, sem partir palavra ao meio. */
export function previewCaption(text: string, maxChars = 180): string {
	const flat = text.replace(/\s+/g, " ").trim();
	if (flat.length <= maxChars) {
		return flat;
	}
	const cut = flat.slice(0, maxChars);
	const lastSpace = cut.lastIndexOf(" ");
	return `${(lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) : cut).trimEnd()}…`;
}

/** O estado da conta como a tela o mostra, com o tom da cor. */
export const ACCOUNT_STATE_LABELS: Record<string, string> = {
	CONECTADA: "Conectada",
	EXPIRANDO: "Autorização vencendo",
	EXPIRADA: "Autorização vencida",
	DESCONECTADA: "Desconectada",
};

export function accountTone(state: string): "ok" | "atencao" | "erro" {
	switch (state) {
		case "CONECTADA":
			return "ok";
		case "EXPIRANDO":
			return "atencao";
		default:
			return "erro";
	}
}
