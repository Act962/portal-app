import {
	Caption,
	DESTINATION_LABEL,
	type DeliveryStatus,
	type DiagnosisVerdict,
	PLATFORM_LIMITS,
	type PostStatus,
	type SocialDestination,
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
	destination: SocialDestination;
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
	destinations: readonly SocialDestination[],
): readonly CaptionCounter[] {
	const caption = Caption.restore(text);
	// Destino que não publica legenda (os Stories) não ganha contador: medir um
	// texto que ninguém vai ler só assustaria.
	return destinations
		.filter((destination) => PLATFORM_LIMITS[destination].publishesCaption)
		.map((destination) => {
			const limits = PLATFORM_LIMITS[destination];
			return {
				destination,
				label: DESTINATION_LABEL[destination],
				length: caption.length,
				max: limits.captionMaxLength,
				over: caption.exceedsLengthFor(destination),
				hashtags: caption.hashtags.length,
				hashtagMax: limits.hashtagMaxCount,
				hashtagsOver: caption.exceedsHashtagsFor(destination),
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
	deliveries: readonly {
		destination: SocialDestination;
		status: DeliveryStatus;
	}[],
): string {
	if (deliveries.length === 0) {
		return "Nenhuma rede escolhida";
	}
	return deliveries
		.map(
			(delivery) =>
				`${DESTINATION_LABEL[delivery.destination]} ${DELIVERY_STATUS_LABELS[delivery.status]}`,
		)
		.join(" · ");
}

/**
 * O texto do botão que abre o post publicado. "Ver no Stories do Instagram"
 * seria português torto — e o story some em 24 h, o que vale lembrar no botão.
 */
export function permalinkLabel(destination: SocialDestination): string {
	switch (destination) {
		case "INSTAGRAM_STORIES":
			return "Ver o story (24 h)";
		default:
			return `Ver no ${DESTINATION_LABEL[destination]}`;
	}
}

/**
 * O aviso do editor quando os Stories estão entre os destinos: o que muda no
 * que sai lá. `null` quando não há Stories.
 */
export function storyNotice(
	destinations: readonly SocialDestination[],
	mediaCount: number,
): string | null {
	if (!destinations.includes("INSTAGRAM_STORIES")) {
		return null;
	}
	const base =
		"Nos Stories sai só a imagem, em tela cheia (1080×1920) sobre um fundo desfocado, sem legenda — e some depois de 24 h.";
	return mediaCount > 1
		? `${base} Das ${mediaCount} imagens, vai só a primeira.`
		: base;
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

/** O veredito do "Verificar conexão", na língua de quem vai agir sobre ele. */
export const DIAGNOSIS_LABELS: Record<DiagnosisVerdict, string> = {
	PRONTA: "Pronta para publicar",
	ATENCAO: "Publica, com ressalva",
	BLOQUEADA: "Não publica",
};

export function diagnosisTone(
	verdict: DiagnosisVerdict,
): "ok" | "atencao" | "erro" {
	switch (verdict) {
		case "PRONTA":
			return "ok";
		case "ATENCAO":
			return "atencao";
		default:
			return "erro";
	}
}

/**
 * A cota do Instagram numa linha. "Restam" é o número que decide alguma coisa
 * — quantas notícias ainda cabem hoje —, então vem escrito, e não deixado para
 * a pessoa subtrair.
 */
export function quotaSummary(quota: { used: number; total: number }): string {
	const left = Math.max(0, quota.total - quota.used);
	return `${quota.used} de ${quota.total} publicações nas últimas 24 h · ${left === 1 ? "resta 1" : `restam ${left}`}`;
}

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

/**
 * O que dizer quando a tela abre pela volta do login da Meta
 * (`?meta=<resultado>`).
 *
 * `escolher` não tem mensagem: é o caminho feliz, e a própria escolha de Página
 * aparece na tela. Valor desconhecido também não — um parâmetro inventado na
 * URL não deve virar aviso vermelho.
 */
export function metaFlagMessage(
	flag: string | null,
): { tone: "info" | "erro"; message: string } | null {
	switch (flag) {
		case "cancelado":
			return {
				tone: "info",
				message:
					"O login da Meta foi cancelado. Nenhuma conta foi conectada ou alterada.",
			};
		case "erro":
			return {
				tone: "erro",
				message:
					"Não foi possível concluir o login da Meta. Tente de novo — se continuar, confira se o endereço de retorno está cadastrado no App.",
			};
		case "nao-configurado":
			return {
				tone: "erro",
				message:
					"O login da Meta não está configurado neste ambiente (META_APP_ID e META_APP_SECRET).",
			};
		default:
			return null;
	}
}
