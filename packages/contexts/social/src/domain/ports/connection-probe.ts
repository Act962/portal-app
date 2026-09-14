import type { AccountCredentials } from "./social-account-repository";

/** Publicações usadas e permitidas na janela da rede (24 h no Instagram). */
export type PublishingQuota = {
	used: number;
	total: number;
};

/**
 * O que a rede respondeu sobre uma conta conectada.
 *
 * `problems` em português, prontos para a tela: token revogado, permissão que
 * faltou no login. Vazio quer dizer que a rede confirmou que a conta publica.
 */
export type ConnectionInspection = {
	problems: readonly string[];
	quota: PublishingQuota | null;
};

/**
 * Pergunta à rede se a conta conectada ainda consegue publicar — SEM publicar.
 *
 * Existe para o primeiro contato com a Meta real não ser um post de verdade.
 * "Token revogado" ou "faltou a permissão de publicar" descobertos pelo botão
 * de diagnóstico custam um clique; descobertos pela fila, custam uma notícia
 * que não saiu na hora em que devia.
 */
export interface ConnectionProbe {
	inspect(credentials: AccountCredentials): Promise<ConnectionInspection>;
}
