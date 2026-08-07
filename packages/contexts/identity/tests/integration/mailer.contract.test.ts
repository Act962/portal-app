import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import {
	InMemoryMailer,
	type Mailer,
	type MailMessage,
} from "@portal-app/identity";
import { ResendMailer } from "@portal-app/identity/infrastructure/resend-mailer";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

/**
 * Contrato de `Mailer`, rodado contra o fake in-memory E contra o
 * `ResendMailer` de verdade — só que apontado para um stand-in HTTP local no
 * lugar da API do Resend (mesmo espírito do MinIO no contrato de
 * `MediaStorage`: sem conta em serviço nenhum, mas exercitando o código real
 * de requisição — método, header de autorização, corpo).
 */

type MailerHarness = {
	mailer: Mailer;
	sent: () => MailMessage[];
};

let stub: Server;
let received: { authorization: string | null; body: unknown }[] = [];
let stubUrl: string;

beforeAll(async () => {
	stub = createServer((req, res) => {
		let raw = "";
		req.on("data", (chunk) => {
			raw += chunk;
		});
		req.on("end", () => {
			received.push({
				authorization: req.headers.authorization ?? null,
				body: raw ? JSON.parse(raw) : null,
			});
			res.writeHead(200, { "content-type": "application/json" });
			res.end(JSON.stringify({ id: "stub-email-id" }));
		});
	});
	await new Promise<void>((resolve) => stub.listen(0, resolve));
	const { port } = stub.address() as AddressInfo;
	stubUrl = `http://127.0.0.1:${port}`;
});

afterAll(() => {
	stub.close();
});

function fakeHarness(): MailerHarness {
	const fake = new InMemoryMailer();
	return { mailer: fake, sent: () => fake.sent };
}

function resendHarness(): MailerHarness {
	received = [];
	const mailer = new ResendMailer({
		apiKey: "stub-key",
		from: "nao-responda@fm7cidades.com.br",
		baseUrl: stubUrl,
	});
	return {
		mailer,
		sent: () =>
			received.map((r) => {
				const body = r.body as { to: string[]; subject: string; text: string };
				return { to: body.to[0] ?? "", subject: body.subject, text: body.text };
			}),
	};
}

function contract(label: string, makeHarness: () => MailerHarness): void {
	describe(`Mailer — contrato (${label})`, () => {
		it("envia e o destinatário/assunto/corpo chegam intactos", async () => {
			const h = makeHarness();
			const message: MailMessage = {
				to: "jornalista@fm7cidades.com",
				subject: "Convite para a redação",
				text: "Crie sua conta em https://painel.example/login",
			};

			await h.mailer.send(message);

			expect(h.sent()).toEqual([message]);
		});
	});
}

contract("in-memory", fakeHarness);
contract("resend (stand-in local)", resendHarness);

describe("ResendMailer — autenticação", () => {
	it("manda a API key no header Authorization", async () => {
		received = [];
		const mailer = new ResendMailer({
			apiKey: "minha-chave-secreta",
			from: "nao-responda@fm7cidades.com.br",
			baseUrl: stubUrl,
		});

		await mailer.send({
			to: "a@b.com",
			subject: "oi",
			text: "oi",
		});

		expect(received[0]?.authorization).toBe("Bearer minha-chave-secreta");
	});

	it("erro HTTP do provedor vira exceção, não sucesso silencioso", async () => {
		const closedPortMailer = new ResendMailer({
			apiKey: "x",
			from: "nao-responda@fm7cidades.com.br",
			baseUrl: "http://127.0.0.1:1",
		});

		await expect(
			closedPortMailer.send({ to: "a@b.com", subject: "oi", text: "oi" }),
		).rejects.toThrow();
	});
});
