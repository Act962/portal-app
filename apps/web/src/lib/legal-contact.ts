import { contactChannels } from "@portal-app/settings";

/**
 * Para onde as páginas legais (Privacidade, Termos, Exclusão de dados) mandam
 * quem quer falar com o portal.
 *
 * Existe porque o contato virou texto livre e pode ficar VAZIO: o rodapé some
 * com o bloco inteiro, e uma página que continuasse dizendo "use os canais do
 * rodapé" apontaria para um lugar que não existe. A ordem é do mais direto ao
 * mais vago, e o último caso é dizer nada — melhor a frase ausente do que uma
 * promessa falsa.
 */
export type LegalContact =
	| { kind: "email"; email: string }
	/** Há linhas de contato, mas nenhuma traz e-mail: o rodapé as mostra. */
	| { kind: "footer" }
	/** Sem linha nenhuma, mas com perfis oficiais na barra do topo. */
	| { kind: "social" }
	| { kind: "none" };

export function legalContactOf(site: {
	contactLines: readonly string[];
	social: readonly { href: string }[];
}): LegalContact {
	const { email } = contactChannels(site.contactLines);
	if (email) {
		return { kind: "email", email };
	}
	if (site.contactLines.length > 0) {
		return { kind: "footer" };
	}
	// Só perfil com endereço: rede sem `href` aparece como texto inerte no
	// topo, e não é canal de ninguém.
	if (site.social.some((link) => /^https?:\/\//.test(link.href.trim()))) {
		return { kind: "social" };
	}
	return { kind: "none" };
}
