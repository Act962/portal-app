export type MailMessage = {
	to: string;
	subject: string;
	text: string;
};

/**
 * Porta de ENVIO de e-mail. Usada pelo convite e pela redefinição de senha
 * (Bloco 1.3). Como Redis e Inngest, é peça trocável: o adapter padrão é um
 * no-op (nada é enviado, o "avise você mesmo" continua valendo), e um adapter
 * real entra atrás dela só quando configurado — nunca amarra a aplicação a um
 * provedor específico.
 */
export interface Mailer {
	send(message: MailMessage): Promise<void>;
}

/** Adapter padrão: não envia nada. É o comportamento sem provedor configurado. */
export class NoopMailer implements Mailer {
	send(): Promise<void> {
		return Promise.resolve();
	}
}

/** Fake de teste: guarda o que foi "enviado" para os testes inspecionarem. */
export class InMemoryMailer implements Mailer {
	readonly sent: MailMessage[] = [];

	send(message: MailMessage): Promise<void> {
		this.sent.push(message);
		return Promise.resolve();
	}
}
