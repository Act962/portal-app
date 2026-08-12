/**
 * De um rótulo escrito à mão para uma rede conhecida.
 *
 * Existe porque as redes do veículo vêm das Configurações como TEXTO LIVRE
 * (`{ label, href }`), digitado por quem administra o portal. Trocar o rótulo
 * por um ícone exige adivinhar qual rede é — e adivinhar errado, em silêncio, é
 * pior do que não trocar: o leitor vê o logo do Facebook levando ao Instagram.
 *
 * Por isso o resultado é `null` quando não há certeza, e quem chama volta a
 * mostrar o texto. Um rótulo que não reconhecemos continua legível.
 *
 * Módulo sem JSX de propósito (regra dos testes, CLAUDE.md): a normalização é a
 * parte que erra, e ela se testa sem montar componente.
 */
export const NETWORKS = [
	"instagram",
	"facebook",
	"youtube",
	"twitter",
	"linkedin",
	"tiktok",
	"whatsapp",
	"telegram",
	"threads",
	"website",
	"email",
] as const;

export type Network = (typeof NETWORKS)[number];

/**
 * Apelidos por rede. A chave canônica também vale como apelido, então não
 * precisa se repetir aqui.
 *
 * `twitter` guarda o histórico: o campo do domínio se chama `twitter`, a marca
 * hoje é "X", e o veículo pode ter escrito qualquer um dos dois. Os três casam.
 */
const ALIASES: Record<Network, readonly string[]> = {
	instagram: ["insta", "ig"],
	facebook: ["fb", "face"],
	youtube: ["yt", "you tube"],
	twitter: ["x", "x twitter", "twitter x"],
	linkedin: ["linked in"],
	tiktok: ["tik tok"],
	whatsapp: ["whats app", "whats", "zap"],
	telegram: [],
	threads: [],
	website: ["site", "web", "pagina", "portal", "blog"],
	email: ["e mail", "mail", "correio"],
};

/**
 * Minúsculas, sem acento e sem pontuação. "X (Twitter)" e "x twitter" precisam
 * chegar iguais aqui, senão cada veículo que escrever de um jeito diferente
 * perde o ícone.
 */
function normalize(raw: string): string {
	return raw
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, " ")
		.trim();
}

const BY_ALIAS = new Map<string, Network>();
for (const network of NETWORKS) {
	BY_ALIAS.set(network, network);
	for (const alias of ALIASES[network]) {
		BY_ALIAS.set(alias, network);
	}
}

/**
 * `null` quando não dá para ter certeza — quem chama mostra o texto.
 *
 * Só há correspondência EXATA depois de normalizar. Casar por "contém" traria
 * o falso positivo óbvio: "Siga no X" contém "x", mas também contém as letras
 * de meia dúzia de outras coisas, e "Fale conosco" viraria uma rede.
 */
export function resolveNetwork(label: string): Network | null {
	return BY_ALIAS.get(normalize(label)) ?? null;
}
