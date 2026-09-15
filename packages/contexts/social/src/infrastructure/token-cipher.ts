import {
	createCipheriv,
	createDecipheriv,
	randomBytes,
	scryptSync,
} from "node:crypto";

/**
 * Cifra os tokens da Meta em repouso (spec 08, D9).
 *
 * **Por que cifrar, se o banco já é privado.** Um token de Página da Meta não
 * expira e publica em nome do veículo. Ele vaza pelos caminhos que ninguém
 * chama de vazamento: um `pg_dump` mandado por e-mail para depurar, um backup
 * num bucket, uma captura de tela do Prisma Studio num grupo de WhatsApp. A
 * cifragem não protege contra quem tem o servidor inteiro — protege contra a
 * cópia do banco que sai de perto do servidor, que é o caso que acontece.
 *
 * **AES-256-GCM**, e não AES-CBC: o GCM autentica. Texto cifrado adulterado é
 * REJEITADO na decifragem em vez de virar lixo silencioso.
 *
 * **A chave é derivada do `BETTER_AUTH_SECRET`**, que já existe, já tem mínimo
 * de 32 caracteres e já é tratado como segredo em todo ambiente. A alternativa
 * — mais uma variável obrigatória — teria custo real: um deploy sem ela
 * quebraria a publicação, e o caminho de menor esforço para consertar seria
 * cravar um valor no código. O preço desta escolha está documentado e é
 * aceitável: **trocar o `BETTER_AUTH_SECRET` invalida os tokens guardados**, e
 * a redação precisa reconectar as contas. Reconectar são dois cliques; o
 * contrário seria um segredo a mais para perder.
 */
export class TokenCipher {
	private readonly key: Buffer;

	constructor(secret: string) {
		// `scrypt` em vez de usar o segredo cru: ele transforma qualquer texto
		// numa chave de exatamente 32 bytes e custa caro de forçar. O sal é fixo
		// porque não há por usuário aqui — é uma chave só, do sistema.
		this.key = scryptSync(secret, "portal-app/social/token", 32);
	}

	/**
	 * Devolve `v1.<iv>.<tag>.<cifra>` em base64url.
	 *
	 * O prefixo de versão não é enfeite: o dia em que o algoritmo mudar, é ele
	 * que permite decifrar o que já está gravado enquanto o novo passa a valer —
	 * sem uma migração que precisaria dos tokens em claro para rodar.
	 */
	encrypt(plain: string): string {
		const iv = randomBytes(12);
		const cipher = createCipheriv("aes-256-gcm", this.key, iv);
		const encrypted = Buffer.concat([
			cipher.update(plain, "utf8"),
			cipher.final(),
		]);
		return [
			"v1",
			iv.toString("base64url"),
			cipher.getAuthTag().toString("base64url"),
			encrypted.toString("base64url"),
		].join(".");
	}

	/**
	 * Lança se o texto foi adulterado ou se a chave mudou. **Lançar é o certo**:
	 * token indecifrável não é regra de negócio violada, é configuração quebrada,
	 * e continuar com uma string vazia faria a Meta responder "não autorizado" —
	 * um erro que manda a redação procurar defeito no lugar errado.
	 */
	decrypt(stored: string): string {
		const [version, iv, tag, payload] = stored.split(".");
		if (version !== "v1" || !iv || !tag || !payload) {
			throw new Error("Token guardado em formato desconhecido.");
		}
		const decipher = createDecipheriv(
			"aes-256-gcm",
			this.key,
			Buffer.from(iv, "base64url"),
		);
		decipher.setAuthTag(Buffer.from(tag, "base64url"));
		return Buffer.concat([
			decipher.update(Buffer.from(payload, "base64url")),
			decipher.final(),
		]).toString("utf8");
	}
}
