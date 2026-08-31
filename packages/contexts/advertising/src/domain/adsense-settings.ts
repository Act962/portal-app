import { err, ok, type Result } from "@portal-app/shared-kernel";

import { AD_SLOTS, type AdSlot } from "./ad-slot";
import { InvalidPublisherId } from "./errors";

/**
 * A configuração do Google AdSense.
 *
 * Mora NESTE contexto, e não nas Configurações do site, porque é vocabulário de
 * publicidade: quem mexe aqui é quem cuida de monetização, e um campo perdido
 * entre "nome do veículo" e "telefone da redação" seria achado por acidente. É
 * um registro único (singleton), como `SiteSettings` — só que deste contexto.
 *
 * O `publisherId` NÃO é segredo: ele aparece no código-fonte de toda página que
 * serve anúncio, por construção. Está aqui em vez de numa variável de ambiente
 * para o cliente poder trocá-lo sem depender de um deploy nosso.
 */
export type AdSenseData = {
	/** `ca-pub-` seguido de dígitos. Nulo enquanto ninguém configurou. */
	publisherId: string | null;
	/**
	 * A chave geral. Desligado aqui, nenhum script do Google é carregado em
	 * página nenhuma — é o que permite desligar a monetização inteira num
	 * clique, sem deploy, se algo der errado.
	 */
	enabled: boolean;
	/**
	 * O ID da unidade de anúncio de cada posição, criado no painel do AdSense.
	 * Posição sem unidade cadastrada simplesmente não serve AdSense — melhor um
	 * espaço vazio do que uma caixa quebrada do Google.
	 */
	slotIds: Partial<Record<AdSlot, string>>;
	/**
	 * Pede ao Google anúncios NÃO personalizados.
	 *
	 * Começa LIGADO de propósito. Anúncio personalizado depende de rastrear o
	 * leitor entre sites, e isso exige base legal e um aviso que o portal ainda
	 * não tem (não há banner de consentimento). Enquanto não houver, o padrão
	 * seguro é o que não depende de consentimento — rende menos e é o que dá
	 * para sustentar. Ver a nota em `docs/pendencias.md`.
	 */
	nonPersonalized: boolean;
};

export const ADSENSE_DEFAULTS: AdSenseData = {
	publisherId: null,
	enabled: false,
	slotIds: {},
	nonPersonalized: true,
};

/** `ca-pub-` + dígitos. O formato do Google; qualquer outra coisa colada aí é
 * erro de cópia, e um id errado faz o script carregar e não servir nada. */
const PUBLISHER_ID = /^ca-pub-\d{10,20}$/;

export class AdSenseSettings {
	static readonly ID = "adsense";

	private constructor(readonly data: AdSenseData) {}

	static restore(row: Partial<AdSenseData> | null): AdSenseSettings {
		return new AdSenseSettings({
			publisherId: row?.publisherId ?? ADSENSE_DEFAULTS.publisherId,
			enabled: row?.enabled ?? ADSENSE_DEFAULTS.enabled,
			slotIds: row?.slotIds ?? ADSENSE_DEFAULTS.slotIds,
			nonPersonalized: row?.nonPersonalized ?? ADSENSE_DEFAULTS.nonPersonalized,
		});
	}

	static change(
		input: Partial<AdSenseData>,
		current: AdSenseData,
	): Result<AdSenseSettings, InvalidPublisherId> {
		const publisherId =
			input.publisherId !== undefined
				? normalizeId(input.publisherId)
				: current.publisherId;

		if (publisherId !== null && !PUBLISHER_ID.test(publisherId)) {
			return err(new InvalidPublisherId());
		}

		const slotIds = input.slotIds ?? current.slotIds;
		const cleanSlots: Partial<Record<AdSlot, string>> = {};
		for (const slot of AD_SLOTS) {
			const value = slotIds[slot]?.trim();
			// Vazio é "não configurado", e guardar `""` faria o portal montar uma
			// tag do AdSense sem unidade — que renderiza uma caixa vazia e conta
			// como requisição inválida no relatório do Google.
			if (value) {
				cleanSlots[slot] = value;
			}
		}

		return ok(
			new AdSenseSettings({
				publisherId,
				enabled: input.enabled ?? current.enabled,
				slotIds: cleanSlots,
				nonPersonalized: input.nonPersonalized ?? current.nonPersonalized,
			}),
		);
	}

	/**
	 * O AdSense pode servir ESTA posição?
	 *
	 * Exige as três coisas juntas: a chave geral ligada, o `publisherId` e a
	 * unidade daquela posição. Faltando qualquer uma, o portal não monta a tag —
	 * porque uma tag incompleta não fica "quase funcionando", ela vira um buraco
	 * na página e uma requisição contada como erro no relatório do Google.
	 */
	servesSlot(slot: AdSlot): boolean {
		return (
			this.data.enabled &&
			this.data.publisherId !== null &&
			Boolean(this.data.slotIds[slot])
		);
	}

	/** A linha do `ads.txt` que autoriza o Google a vender nosso inventário.
	 * Sem este arquivo no ar, o AdSense trata o inventário como não autorizado e
	 * a receita despenca — é exigência da IAB, não recomendação. */
	adsTxtLine(): string | null {
		if (!this.data.publisherId) {
			return null;
		}
		// `f08c47fec0942fa0` é o TAG-ID do Google, fixo e público.
		return `google.com, ${this.data.publisherId}, DIRECT, f08c47fec0942fa0`;
	}
}

function normalizeId(raw: string | null): string | null {
	const trimmed = raw?.trim() ?? "";
	return trimmed === "" ? null : trimmed;
}
