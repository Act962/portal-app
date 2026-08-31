import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import { type AdSlot, isAdSlot } from "./ad-slot";
import { Destination } from "./destination";
import {
	AdvertiserRequired,
	CampaignNameRequired,
	CampaignNotReady,
	type InvalidDestination,
	type InvalidFlight,
	InvalidSlot,
	InvalidWeight,
} from "./errors";
import { Flight } from "./flight";

/**
 * O peso do rodízio. Uma campanha de peso 3 aparece três vezes mais que uma de
 * peso 1 NA MESMA posição.
 *
 * O teto existe para o rodízio continuar sendo rodízio: com peso 1000 contra 1,
 * a segunda campanha aparece uma vez a cada mil visitas, o que é o mesmo que
 * não aparecer — e o anunciante dela pagou. Dez já é uma diferença enorme.
 */
export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 10;

/** Onde a campanha está na vida dela. `AGENDADA` e `ENCERRADA` NÃO são valores
 * guardados: são derivados do período (ver `stateAt`), porque status guardado e
 * data são duas fontes para a mesma verdade, e elas divergem no dia em que
 * ninguém roda o job que deveria sincronizá-las. */
export type CampaignStatus = "RASCUNHO" | "ATIVA" | "PAUSADA";

/** O que a tela mostra — inclui os estados derivados do relógio. */
export type CampaignState =
	| "RASCUNHO"
	| "AGENDADA"
	| "NO_AR"
	| "PAUSADA"
	| "ENCERRADA";

export type Creative = {
	mediaId: string;
	/** Texto alternativo. Anúncio sem alt é uma imagem muda para quem usa
	 * leitor de tela — e a lei de acessibilidade não abre exceção para
	 * publicidade. */
	altText: string;
};

type CampaignProps = {
	id: string;
	name: string;
	advertiser: string;
	slot: AdSlot;
	destination: Destination;
	flight: Flight;
	weight: number;
	/** Vazio = global (aparece em qualquer editoria). */
	sectionIds: readonly string[];
	creative: Creative | null;
	status: CampaignStatus;
	createdAt: Date;
};

/**
 * Uma campanha publicitária: uma arte, um link, uma posição e um período.
 *
 * As decisões de modelagem que o `docs/pendencias.md` mandava tomar antes de
 * escrever, e as respostas:
 *
 * - **Rodízio, não uma por posição.** Várias campanhas podem disputar a mesma
 *   posição, com peso. É o que permite vender o mesmo espaço a três anunciantes
 *   no mesmo mês, que é como um portal local se sustenta.
 * - **Global por padrão, segmentável por editoria.** `sectionIds` vazio é o
 *   caso comum; preenchido, restringe. Anunciante local pede isso ("quero só
 *   em Esportes"), e a alternativa custaria uma migration depois.
 */
export class Campaign extends AggregateRoot<string> {
	private constructor(private readonly state: CampaignProps) {
		super(state.id);
	}

	static create(input: {
		id: string;
		name: string;
		advertiser: string;
		slot: string;
		destinationUrl: string;
		startsAt: Date;
		endsAt: Date | null;
		weight?: number;
		sectionIds?: readonly string[];
		creative?: Creative | null;
		createdAt: Date;
	}): Result<
		Campaign,
		| CampaignNameRequired
		| AdvertiserRequired
		| InvalidSlot
		| InvalidDestination
		| InvalidFlight
		| InvalidWeight
	> {
		const name = input.name.trim();
		if (name === "") {
			return err(new CampaignNameRequired());
		}
		const advertiser = input.advertiser.trim();
		if (advertiser === "") {
			return err(new AdvertiserRequired());
		}
		if (!isAdSlot(input.slot)) {
			return err(new InvalidSlot(input.slot));
		}
		const destination = Destination.create(input.destinationUrl);
		if (destination.isErr()) {
			return err(destination.error);
		}
		const flight = Flight.create(input.startsAt, input.endsAt);
		if (flight.isErr()) {
			return err(flight.error);
		}
		const weight = input.weight ?? MIN_WEIGHT;
		if (!isValidWeight(weight)) {
			return err(new InvalidWeight(MIN_WEIGHT, MAX_WEIGHT));
		}

		return ok(
			new Campaign({
				id: input.id,
				name,
				advertiser,
				slot: input.slot,
				destination: destination.value,
				flight: flight.value,
				weight,
				sectionIds: [...(input.sectionIds ?? [])],
				creative: input.creative ?? null,
				// Nasce RASCUNHO: uma campanha cadastrada pela metade não pode ir ao
				// ar por acidente. Subir é um ato explícito (`activate`).
				status: "RASCUNHO",
				createdAt: input.createdAt,
			}),
		);
	}

	static restore(props: {
		id: string;
		name: string;
		advertiser: string;
		slot: AdSlot;
		destinationUrl: string;
		startsAt: Date;
		endsAt: Date | null;
		weight: number;
		sectionIds: readonly string[];
		creative: Creative | null;
		status: CampaignStatus;
		createdAt: Date;
	}): Campaign {
		return new Campaign({
			...props,
			destination: Destination.restore(props.destinationUrl),
			flight: Flight.restore(props.startsAt, props.endsAt),
			sectionIds: [...props.sectionIds],
		});
	}

	get name(): string {
		return this.state.name;
	}
	get advertiser(): string {
		return this.state.advertiser;
	}
	get slot(): AdSlot {
		return this.state.slot;
	}
	get destination(): Destination {
		return this.state.destination;
	}
	get flight(): Flight {
		return this.state.flight;
	}
	get weight(): number {
		return this.state.weight;
	}
	get sectionIds(): readonly string[] {
		return this.state.sectionIds;
	}
	get creative(): Creative | null {
		return this.state.creative;
	}
	get status(): CampaignStatus {
		return this.state.status;
	}
	get createdAt(): Date {
		return this.state.createdAt;
	}

	/** Sem editoria declarada, a campanha vale para o portal inteiro. */
	get isGlobal(): boolean {
		return this.state.sectionIds.length === 0;
	}

	/**
	 * O que falta para esta campanha poder ir ao ar. Devolve MOTIVOS, não um
	 * booleano: a tela precisa dizer o que corrigir antes do clique, e "não é
	 * possível ativar" sem o porquê é o que faz alguém abrir chamado.
	 */
	activationBlockers(): readonly string[] {
		const blockers: string[] = [];
		if (!this.state.creative) {
			blockers.push("A campanha precisa de uma imagem.");
		} else if (this.state.creative.altText.trim() === "") {
			blockers.push(
				"A imagem precisa de texto alternativo — é o que um leitor cego ouve no lugar do anúncio.",
			);
		}
		return blockers;
	}

	/**
	 * O estado que a tela mostra, resolvido contra o relógio.
	 *
	 * `AGENDADA` e `ENCERRADA` são DERIVADOS, e é de propósito: guardar "encerrada"
	 * exigiria um job varrendo campanhas vencidas, e no dia em que ele falhasse o
	 * anúncio continuaria no ar depois do fim do contrato — cobrando do portal um
	 * espaço que ninguém pagou.
	 */
	stateAt(now: Date): CampaignState {
		if (this.state.status === "RASCUNHO") {
			return "RASCUNHO";
		}
		if (this.state.status === "PAUSADA") {
			return "PAUSADA";
		}
		if (this.state.flight.endedAt(now)) {
			return "ENCERRADA";
		}
		if (this.state.flight.startsAfter(now)) {
			return "AGENDADA";
		}
		return "NO_AR";
	}

	/** A pergunta que a veiculação faz. Junta as três condições num lugar só,
	 * para a tela do portal não reimplementar nenhuma delas. */
	isLiveAt(now: Date): boolean {
		return (
			this.state.status === "ATIVA" &&
			this.state.flight.containsAt(now) &&
			this.state.creative !== null
		);
	}

	/** A campanha serve esta página? Global serve todas; segmentada, só as suas. */
	servesSection(sectionId: string | null): boolean {
		if (this.isGlobal) {
			return true;
		}
		return sectionId !== null && this.state.sectionIds.includes(sectionId);
	}

	edit(input: {
		name?: string;
		advertiser?: string;
		slot?: string;
		destinationUrl?: string;
		startsAt?: Date;
		endsAt?: Date | null;
		weight?: number;
		sectionIds?: readonly string[];
		creative?: Creative | null;
	}): Result<
		void,
		| CampaignNameRequired
		| AdvertiserRequired
		| InvalidSlot
		| InvalidDestination
		| InvalidFlight
		| InvalidWeight
	> {
		if (input.name !== undefined) {
			const name = input.name.trim();
			if (name === "") {
				return err(new CampaignNameRequired());
			}
			this.state.name = name;
		}
		if (input.advertiser !== undefined) {
			const advertiser = input.advertiser.trim();
			if (advertiser === "") {
				return err(new AdvertiserRequired());
			}
			this.state.advertiser = advertiser;
		}
		if (input.slot !== undefined) {
			if (!isAdSlot(input.slot)) {
				return err(new InvalidSlot(input.slot));
			}
			this.state.slot = input.slot;
		}
		if (input.destinationUrl !== undefined) {
			const destination = Destination.create(input.destinationUrl);
			if (destination.isErr()) {
				return err(destination.error);
			}
			this.state.destination = destination.value;
		}
		if (input.startsAt !== undefined || input.endsAt !== undefined) {
			const flight = Flight.create(
				input.startsAt ?? this.state.flight.startsAt,
				input.endsAt !== undefined ? input.endsAt : this.state.flight.endsAt,
			);
			if (flight.isErr()) {
				return err(flight.error);
			}
			this.state.flight = flight.value;
		}
		if (input.weight !== undefined) {
			if (!isValidWeight(input.weight)) {
				return err(new InvalidWeight(MIN_WEIGHT, MAX_WEIGHT));
			}
			this.state.weight = input.weight;
		}
		if (input.sectionIds !== undefined) {
			this.state.sectionIds = [...input.sectionIds];
		}
		if (input.creative !== undefined) {
			this.state.creative = input.creative;
		}
		return ok(undefined);
	}

	activate(): Result<void, CampaignNotReady> {
		const blockers = this.activationBlockers();
		if (blockers.length > 0) {
			return err(new CampaignNotReady(blockers));
		}
		this.state.status = "ATIVA";
		return ok(undefined);
	}

	/** Pausar é reversível e NÃO mexe no período: o contrato continua correndo,
	 * só a veiculação para. Encurtar a data por causa de uma pausa faria o
	 * portal devolver dias que o anunciante comprou. */
	pause(): void {
		this.state.status = "PAUSADA";
	}
}

function isValidWeight(weight: number): boolean {
	return (
		Number.isInteger(weight) && weight >= MIN_WEIGHT && weight <= MAX_WEIGHT
	);
}
