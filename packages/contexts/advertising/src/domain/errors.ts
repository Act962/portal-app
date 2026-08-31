/** Erros do contexto de publicidade. Nome estável — a raiz de composição
 * traduz `name` em código HTTP, e mudar o nome muda a resposta da API. */

export class CampaignNotFound extends Error {
	override readonly name = "CampaignNotFound";
	constructor(id: string) {
		super(`Campanha não encontrada: ${id}`);
	}
}

export class AdvertiserRequired extends Error {
	override readonly name = "AdvertiserRequired";
	constructor() {
		super("A campanha precisa do nome do anunciante.");
	}
}

export class CampaignNameRequired extends Error {
	override readonly name = "CampaignNameRequired";
	constructor() {
		super("A campanha precisa de um nome.");
	}
}

export class InvalidDestination extends Error {
	override readonly name = "InvalidDestination";
	constructor(reason: string) {
		super(`Link de destino inválido: ${reason}`);
	}
}

export class InvalidFlight extends Error {
	override readonly name = "InvalidFlight";
	constructor(reason: string) {
		super(`Período inválido: ${reason}`);
	}
}

export class InvalidWeight extends Error {
	override readonly name = "InvalidWeight";
	constructor(min: number, max: number) {
		super(`O peso precisa estar entre ${min} e ${max}.`);
	}
}

export class InvalidSlot extends Error {
	override readonly name = "InvalidSlot";
	constructor(value: string) {
		super(`Posição desconhecida: ${value}`);
	}
}

/** Impede subir ao ar uma campanha incompleta — a lista de pendências vem
 * junto para a tela dizer o que falta ANTES do clique. */
export class CampaignNotReady extends Error {
	override readonly name = "CampaignNotReady";
	constructor(readonly blockers: readonly string[]) {
		/* v8 ignore next -- o `??` é só para o tipo: quem constrói este erro é
		   `activate`, e só quando há ao menos um impedimento. Lista vazia aqui é
		   inalcançável. */
		super(blockers[0] ?? "A campanha não está pronta para ir ao ar.");
	}
}

export class InvalidPublisherId extends Error {
	override readonly name = "InvalidPublisherId";
	constructor() {
		super(
			'O ID do AdSense precisa ter o formato "ca-pub-" seguido de dígitos.',
		);
	}
}

export type AdvertisingError =
	| CampaignNotFound
	| AdvertiserRequired
	| CampaignNameRequired
	| InvalidDestination
	| InvalidFlight
	| InvalidWeight
	| InvalidSlot
	| CampaignNotReady
	| InvalidPublisherId;
