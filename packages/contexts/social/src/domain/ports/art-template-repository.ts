import type { SocialDestination } from "../platform";
import type { ArtFormat, ArtTemplate } from "../template/art-template";

export type ArtTemplateFilter = {
	/** Arquivados ficam fora por padrão — a tela de escolha não os oferece. */
	includeArchived?: boolean;
	/** Só os de um formato — o editor do post filtra pelo que o destino aceita. */
	format?: ArtFormat;
};

export interface ArtTemplateRepository {
	save(template: ArtTemplate): Promise<void>;

	/**
	 * Grava vários padrões na MESMA transação.
	 *
	 * Existe por causa do D10: marcar um padrão como o dos Stories desmarca o
	 * anterior. Duas gravações separadas deixariam uma janela com dois padrões
	 * dos Stories — ou nenhum, se a segunda falhasse —, e o post automático
	 * nasceria com o desenho errado exatamente nessa janela.
	 */
	saveAll(templates: readonly ArtTemplate[]): Promise<void>;

	findById(id: string): Promise<ArtTemplate | null>;

	/** Ordenados por nome. */
	list(filter: ArtTemplateFilter): Promise<readonly ArtTemplate[]>;

	/** O padrão ativo de um destino, ou `null`. */
	findDefaultFor(destination: SocialDestination): Promise<ArtTemplate | null>;

	/**
	 * Algum padrão — arquivado inclusive — usa esta mídia?
	 *
	 * Arquivado conta: posts já aprovados continuam sendo desenhados com ele, e
	 * apagar a moldura faria a arte do reenvio sair sem ela.
	 */
	usesMedia(mediaId: string): Promise<boolean>;
}
