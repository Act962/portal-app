import { err, ok, type Result } from "@portal-app/shared-kernel";

import { InvalidDestination } from "./errors";

/**
 * Para onde o anúncio leva o leitor.
 *
 * A validação aqui não é burocracia de formulário: este valor vira o `href` de
 * um link que o portal serve a todo mundo, e o texto vem de fora (a equipe
 * comercial copia e cola o que o anunciante mandou). `javascript:` e `data:`
 * num `href` são execução de código na origem do portal — é a rota mais curta
 * entre "um anunciante mandou um link" e "um estranho roda script na nossa
 * página". Por isso o esquema é uma LISTA DE PERMITIDOS, e não uma lista de
 * proibidos: proibido esquecido continua passando.
 */
const ALLOWED_PROTOCOLS = ["http:", "https:"] as const;

export class Destination {
	private constructor(readonly value: string) {}

	static create(raw: string): Result<Destination, InvalidDestination> {
		const trimmed = raw.trim();
		if (trimmed === "") {
			return err(new InvalidDestination("está vazio"));
		}

		let url: URL;
		try {
			url = new URL(trimmed);
		} catch {
			// Sem esquema, `new URL` falha. Dizer isso é mais útil do que "inválido":
			// o erro real de quem cola link é esquecer o `https://`.
			return err(
				new InvalidDestination("precisa começar com https:// (ou http://)"),
			);
		}

		if (!(ALLOWED_PROTOCOLS as readonly string[]).includes(url.protocol)) {
			return err(
				new InvalidDestination(
					`o esquema "${url.protocol}" não é aceito — use https://`,
				),
			);
		}

		return ok(new Destination(url.toString()));
	}

	/** Reidrata o que já está no banco, sem revalidar. O que foi gravado passou
	 * pela validação na entrada; recusar aqui esconderia a campanha em vez de
	 * corrigi-la. */
	static restore(value: string): Destination {
		return new Destination(value);
	}

	/** O domínio do anunciante, para a tela mostrar "leva para exemplo.com.br"
	 * sem obrigar ninguém a ler uma URL de rastreamento de 300 caracteres. */
	get host(): string {
		try {
			return new URL(this.value).host;
		} catch {
			/* v8 ignore next 2 -- só alcançável com valor corrompido no banco */
			return this.value;
		}
	}
}
