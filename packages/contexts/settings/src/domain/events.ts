import { DomainEvent } from "@portal-app/shared-kernel";

/**
 * A configuração do site mudou (D10).
 *
 * Carrega os NOMES dos campos alterados, nunca os valores: o log de auditoria é
 * lido por mais gente do que o formulário, e telefone, e-mail e endereço da
 * redação não precisam ser copiados para lá. Saber "quem mexeu no contato e
 * quando" já responde a pergunta que a auditoria existe para responder.
 */
export class SiteSettingsChanged extends DomainEvent {
	readonly eventName = "SiteSettingsChanged";
	readonly fields: readonly string[];

	constructor(fields: readonly string[], occurredAt: Date) {
		super(occurredAt);
		this.fields = [...fields];
	}
}
