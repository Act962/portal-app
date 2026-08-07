import { type Mailer, NoopMailer } from "../domain/ports/mailer";
import { ResendMailer } from "./resend-mailer";

/**
 * Único lugar que decide "Resend ou nada" — as duas raízes de composição que
 * precisam de um `Mailer` (`packages/auth` e `packages/api`) chamam esta
 * função em vez de repetir o `if` cada uma para o seu lado.
 */
export function createMailer(config: {
	apiKey?: string;
	from: string;
}): Mailer {
	if (!config.apiKey) {
		return new NoopMailer();
	}
	return new ResendMailer({ apiKey: config.apiKey, from: config.from });
}
