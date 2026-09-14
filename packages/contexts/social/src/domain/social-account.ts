import { Entity } from "@portal-app/shared-kernel";

import type { SocialPlatform } from "./platform";

/**
 * O que o painel decidiu sobre a conta. `EXPIRADA` e `EXPIRANDO` NÃO estão
 * aqui: são derivados do relógio (ver `stateAt`), pela mesma razão que levou a
 * publicidade a derivar `ENCERRADA` do período — status guardado e data são
 * duas fontes para a mesma verdade, e elas divergem no dia em que ninguém roda
 * o job que deveria sincronizá-las.
 */
export type AccountStatus = "CONECTADA" | "DESCONECTADA";

/** O que a tela mostra, já resolvido contra o relógio. */
export type AccountState =
	| "CONECTADA"
	| "EXPIRANDO"
	| "EXPIRADA"
	| "DESCONECTADA";

/**
 * Com quantos dias de antecedência o painel começa a pedir socorro.
 *
 * Sete, e não um, porque a renovação exige uma PESSOA: alguém com acesso à
 * Página precisa refazer o login da Meta. Avisar na véspera é avisar no fim de
 * semana em que essa pessoa está viajando, e aí a fila para.
 */
export const TOKEN_WARNING_DAYS = 7;

type AccountProps = {
	id: string;
	platform: SocialPlatform;
	/** O id da conta NA META: `ig-user-id` no Instagram, `page-id` no Facebook. */
	remoteId: string;
	/** `@radio7cidades` ou "Rádio 7 Cidades" — o que a tela mostra para a pessoa
	 * conferir que conectou a conta certa. Só isso: não é chave de nada. */
	displayName: string;
	avatarUrl: string | null;
	/**
	 * Quando o token para de valer. **Nulo é estado normal e bom**: o token de
	 * Página de longa duração da Meta não expira. Quem expira é o token de
	 * usuário (60 dias), e é dele que o token de Página é derivado.
	 */
	tokenExpiresAt: Date | null;
	status: AccountStatus;
	connectedAt: Date;
	/** Quem conectou. Fica para a auditoria poder responder "quem autorizou este
	 * aplicativo a falar pelo veículo?". */
	connectedByStaffId: string;
};

/**
 * Uma conta da Meta conectada ao portal.
 *
 * **O token NÃO mora aqui, e isso é a decisão central deste arquivo.** O
 * agregado guarda quando o token vence e se a conta está ligada; o segredo em
 * si fica atrás do repositório, cifrado, e só o adapter que fala com a Meta o
 * enxerga. O motivo é prático, não cerimonial: este objeto vira DTO do tRPC,
 * vira linha de auditoria e vira log de erro — três caminhos por onde um
 * `accessToken` em campo público vazaria sem ninguém ter escrito uma linha
 * errada.
 */
export class SocialAccount extends Entity<string> {
	private constructor(private readonly state: AccountProps) {
		super(state.id);
	}

	static connect(input: {
		id: string;
		platform: SocialPlatform;
		remoteId: string;
		displayName: string;
		avatarUrl?: string | null;
		tokenExpiresAt: Date | null;
		connectedAt: Date;
		connectedByStaffId: string;
	}): SocialAccount {
		return new SocialAccount({
			...input,
			avatarUrl: input.avatarUrl ?? null,
			status: "CONECTADA",
		});
	}

	static restore(props: AccountProps): SocialAccount {
		return new SocialAccount({ ...props });
	}

	get platform(): SocialPlatform {
		return this.state.platform;
	}
	get remoteId(): string {
		return this.state.remoteId;
	}
	get displayName(): string {
		return this.state.displayName;
	}
	get avatarUrl(): string | null {
		return this.state.avatarUrl;
	}
	get tokenExpiresAt(): Date | null {
		return this.state.tokenExpiresAt;
	}
	get status(): AccountStatus {
		return this.state.status;
	}
	get connectedAt(): Date {
		return this.state.connectedAt;
	}
	get connectedByStaffId(): string {
		return this.state.connectedByStaffId;
	}

	stateAt(now: Date): AccountState {
		if (this.state.status === "DESCONECTADA") {
			return "DESCONECTADA";
		}
		if (this.state.tokenExpiresAt === null) {
			return "CONECTADA";
		}
		const remainingMs = this.state.tokenExpiresAt.getTime() - now.getTime();
		if (remainingMs <= 0) {
			return "EXPIRADA";
		}
		if (remainingMs <= TOKEN_WARNING_DAYS * 24 * 60 * 60 * 1000) {
			return "EXPIRANDO";
		}
		return "CONECTADA";
	}

	/**
	 * A conta consegue publicar agora?
	 *
	 * `EXPIRANDO` responde **sim**: o token ainda vale, e recusar por causa do
	 * aviso deixaria o portal mudo uma semana inteira antes do necessário.
	 */
	isUsableAt(now: Date): boolean {
		const state = this.stateAt(now);
		return state === "CONECTADA" || state === "EXPIRANDO";
	}

	/** Por que não dá para publicar — em português, para a tela repetir sem
	 * traduzir nada. Nulo quando está tudo certo. */
	unusableReasonAt(now: Date): string | null {
		switch (this.stateAt(now)) {
			case "DESCONECTADA":
				return "a conta foi desconectada do portal";
			case "EXPIRADA":
				return "a autorização venceu e precisa ser renovada com um novo login na Meta";
			default:
				return null;
		}
	}

	/** Renova a validade após um novo login na Meta. O token novo é gravado pelo
	 * repositório; aqui só muda a data e a conta volta a valer. */
	renew(tokenExpiresAt: Date | null): void {
		this.state.tokenExpiresAt = tokenExpiresAt;
		this.state.status = "CONECTADA";
	}

	/**
	 * Desliga a conta. **Não apaga o registro**, e isso é de propósito: os posts
	 * já publicados apontam para esta conta, e apagá-la transformaria o histórico
	 * do que foi ao ar em uma lista de ids órfãos.
	 */
	disconnect(): void {
		this.state.status = "DESCONECTADA";
	}
}
