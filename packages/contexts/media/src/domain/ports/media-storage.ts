/**
 * Porta de ARMAZENAMENTO do arquivo binário. O domínio declara o contrato; os
 * adapters implementam: S3/R2 em produção, MinIO no dev/CI (mesma API S3), e um
 * in-memory nos testes de aplicação.
 *
 * O ponto central (A28): o upload é DIRETO do cliente para o storage por uma URL
 * PUT pré-assinada — o arquivo nunca passa pelo servidor da app. `getUploadUrl`
 * devolve essa URL; `publicUrl` dá o endereço de leitura; `delete` remove.
 */
export interface MediaStorage {
	/** URL PUT pré-assinada para o cliente enviar o arquivo direto ao storage. */
	getUploadUrl(key: string, contentType: string): Promise<string>;
	/** Endereço público de leitura do objeto. */
	publicUrl(key: string): string;
	/** Remove o objeto do storage. */
	delete(key: string): Promise<void>;
}

/**
 * Fake in-memory da porta. Mora junto do contrato (como os repositórios): a
 * mesma suíte de contrato roda contra ele e contra o MinIO real (M10). Como não
 * há HTTP, a "URL pré-assinada" é um esquema `memory://` e os métodos `put`/
 * `get` de teste simulam o upload/leitura que, no real, passam pela rede.
 */
export class InMemoryMediaStorage implements MediaStorage {
	private readonly objects = new Map<string, Uint8Array>();

	getUploadUrl(key: string): Promise<string> {
		return Promise.resolve(`memory://upload/${encodeURIComponent(key)}`);
	}

	publicUrl(key: string): string {
		return `memory://public/${encodeURIComponent(key)}`;
	}

	delete(key: string): Promise<void> {
		this.objects.delete(key);
		return Promise.resolve();
	}

	/** Helper de teste: simula o PUT que o cliente faria na URL pré-assinada. */
	put(key: string, body: Uint8Array): void {
		this.objects.set(key, body);
	}

	/** Helper de teste: lê o que foi "enviado". */
	get(key: string): Uint8Array | null {
		return this.objects.get(key) ?? null;
	}
}
