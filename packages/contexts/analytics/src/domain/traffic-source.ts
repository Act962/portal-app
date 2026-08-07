export const TRAFFIC_SOURCES = [
	"direto",
	"busca",
	"social",
	"interno",
	"outro",
] as const;

export type TrafficSource = (typeof TRAFFIC_SOURCES)[number];

/** Domínios de busca que importam para um portal brasileiro. */
const SEARCH_HOSTS = [
	"google.",
	"bing.",
	"search.yahoo.",
	"duckduckgo.",
	"ecosia.",
	"yandex.",
	"brave.",
];

/** Redes sociais e mensageiros — no Brasil o WhatsApp costuma liderar. */
const SOCIAL_HOSTS = [
	"facebook.",
	"fb.",
	"instagram.",
	"whatsapp.",
	"wa.me",
	"t.co",
	"twitter.",
	"x.com",
	"linkedin.",
	"youtube.",
	"youtu.be",
	"tiktok.",
	"telegram.",
	"t.me",
	"reddit.",
	"threads.",
];

/**
 * De onde veio o leitor (A38). Função PURA: recebe o `referrer` que o browser
 * mandou e o host do próprio portal, devolve a categoria.
 *
 * `ownHost` entra por parâmetro (e não de `env`) porque o mesmo portal roda em
 * localhost, em preview e em produção — chumbar o domínio faria o tráfego
 * interno de dev contar como "outro".
 *
 * Referrer vazio é "direto": é o que o browser manda quando a pessoa digitou o
 * endereço, veio de um app nativo, ou de um site HTTPS→HTTP. Não dá para
 * distinguir esses casos, e fingir precisão aqui seria pior do que a
 * honestidade de um balde só.
 */
export function classifyTrafficSource(
	referrer: string | null | undefined,
	ownHost: string,
): TrafficSource {
	if (!referrer || referrer.trim() === "") {
		return "direto";
	}

	let host: string;
	try {
		host = new URL(referrer).hostname.toLowerCase();
	} catch {
		// Referrer que não é URL válida não é motivo para perder o registro.
		return "outro";
	}

	const own = ownHost.toLowerCase();
	if (host === own || host.endsWith(`.${own}`)) {
		return "interno";
	}
	if (SEARCH_HOSTS.some((needle) => host.includes(needle))) {
		return "busca";
	}
	if (SOCIAL_HOSTS.some((needle) => host === needle || host.includes(needle))) {
		return "social";
	}
	return "outro";
}
