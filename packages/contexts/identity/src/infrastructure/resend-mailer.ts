import type { Mailer, MailMessage } from "../domain/ports/mailer";

export type ResendMailerConfig = {
	apiKey: string;
	from: string;
	/** Injetável para teste de contrato — aponta para um stand-in local. */
	baseUrl?: string;
};

/**
 * Adapter da porta `Mailer` para a API REST do Resend. Usa `fetch` puro (sem
 * SDK) — a superfície é só "POST /emails" com um corpo JSON, não vale a pena a
 * dependência extra. `baseUrl` é injetável exatamente pelo mesmo motivo do
 * `endpoint` em `S3StorageConfig`: o contrato roda contra um servidor local no
 * lugar do provedor real.
 */
export class ResendMailer implements Mailer {
	private readonly baseUrl: string;

	constructor(private readonly config: ResendMailerConfig) {
		this.baseUrl = (config.baseUrl ?? "https://api.resend.com").replace(
			/\/+$/,
			"",
		);
	}

	async send(message: MailMessage): Promise<void> {
		const res = await fetch(`${this.baseUrl}/emails`, {
			method: "POST",
			headers: {
				Authorization: `Bearer ${this.config.apiKey}`,
				"Content-Type": "application/json",
			},
			body: JSON.stringify({
				from: this.config.from,
				to: [message.to],
				subject: message.subject,
				text: message.text,
			}),
		});

		if (!res.ok) {
			throw new Error(
				`Resend recusou o envio (${res.status}): ${await res.text()}`,
			);
		}
	}
}
