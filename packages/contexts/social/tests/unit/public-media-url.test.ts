import { mediaUrlProblem } from "@portal-app/social";
import { describe, expect, it } from "vitest";

describe("mediaUrlProblem", () => {
	it("o armazenamento de produção (R2) passa", () => {
		expect(
			mediaUrlProblem("https://pub-d148.r2.dev/social/m-1-1x1-500-500.jpg"),
		).toBeNull();
	});

	it("o MinIO de desenvolvimento é recusado, dizendo o endereço", () => {
		// É o caso real: em dev a conexão com a Meta funciona e a publicação
		// morreria no download, com um erro que não explica nada.
		const problem = mediaUrlProblem(
			"http://localhost:9000/portal-media/social/m-1.jpg",
		);
		expect(problem).toContain("endereço interno");
		expect(problem).toContain("localhost");
	});

	it.each([
		"http://127.0.0.1:9000/x.jpg",
		"http://10.0.0.5/x.jpg",
		"http://192.168.0.10/x.jpg",
		"http://172.16.0.1/x.jpg",
		"http://172.31.255.255/x.jpg",
		"http://169.254.1.1/x.jpg",
		"http://0.0.0.0/x.jpg",
		"http://[::1]:9000/x.jpg",
		"http://minio.local/x.jpg",
		"http://portal.localhost/x.jpg",
		"http://storage.internal/x.jpg",
	])("rede interna é recusada: %s", (url) => {
		expect(mediaUrlProblem(url)).not.toBeNull();
	});

	it.each([
		"http://172.32.0.1/x.jpg",
		"http://8.8.8.8/x.jpg",
		"https://10.example.com/x.jpg",
		"https://cdn.test/x.jpg",
	])("endereço público passa: %s", (url) => {
		expect(mediaUrlProblem(url)).toBeNull();
	});

	it("endereço que nem é URL, ou de outro protocolo, é inválido", () => {
		expect(mediaUrlProblem("capa.jpg")).toBe(
			"o endereço da imagem não é válido",
		);
		expect(mediaUrlProblem("ftp://cdn.test/x.jpg")).toBe(
			"o endereço da imagem não é válido",
		);
	});
});
