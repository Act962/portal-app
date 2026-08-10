import { describe, expect, it } from "vitest";

import {
	ACCEPTED_UPLOAD_MIME,
	mediaTypeFromMime,
	UnsupportedMediaType,
} from "../../src/index";

describe("mediaTypeFromMime", () => {
	it.each([
		["image/jpeg", "IMAGE"],
		["image/png", "IMAGE"],
		["image/webp", "IMAGE"],
		["video/mp4", "VIDEO"],
		["audio/mpeg", "AUDIO"],
		["application/pdf", "DOCUMENT"],
		["text/csv", "DOCUMENT"],
		["text/plain", "DOCUMENT"],
		["application/vnd.ms-excel", "DOCUMENT"],
		[
			"application/vnd.openxmlformats-officedocument.wordprocessingml.document",
			"DOCUMENT",
		],
	])("classifica %s como %s", (mime, expected) => {
		expect(mediaTypeFromMime(mime).unwrap()).toBe(expected);
	});

	// O navegador manda `text/csv;charset=utf-8` para arquivo salvo do Excel, e
	// alguns sistemas mandam o mime em caixa alta. Sem normalizar, um CSV
	// legítimo seria recusado no envio.
	it.each(["text/csv;charset=utf-8", "TEXT/CSV", "  application/pdf  "])(
		"normaliza parâmetro e caixa: %j",
		(mime) => {
			expect(mediaTypeFromMime(mime).isOk()).toBe(true);
		},
	);

	// A lista de documentos é fechada de propósito: um `application/*` genérico
	// deixaria passar executável, e biblioteca de portal não é lugar para isso.
	it.each([
		"application/x-msdownload",
		"application/octet-stream",
		"application/zip",
		"",
	])("recusa tipo não aceito: %j", (mime) => {
		expect(mediaTypeFromMime(mime).unwrapErr()).toBeInstanceOf(
			UnsupportedMediaType,
		);
	});

	it("a mensagem de erro diz qual foi o tipo", () => {
		expect(mediaTypeFromMime("application/zip").unwrapErr().message).toContain(
			"application/zip",
		);
	});
});

describe("ACCEPTED_UPLOAD_MIME", () => {
	// A tela e o domínio precisam concordar. Se o `accept` do input aceitasse
	// algo que o domínio recusa, o usuário escolheria o arquivo, esperaria o
	// upload e só então tomaria o erro.
	it("cobre imagem e os documentos aceitos", () => {
		expect(ACCEPTED_UPLOAD_MIME).toContain("image/*");
		expect(ACCEPTED_UPLOAD_MIME).toContain("application/pdf");
		expect(ACCEPTED_UPLOAD_MIME).toContain("text/csv");
	});

	it("não abre para curinga de aplicação", () => {
		expect(ACCEPTED_UPLOAD_MIME).not.toContain("application/*");
	});
});
