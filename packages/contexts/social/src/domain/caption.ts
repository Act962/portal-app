import { err, ok, type Result } from "@portal-app/shared-kernel";

import { CaptionRequired } from "./errors";
import { PLATFORM_LIMITS, type SocialPlatform } from "./platform";

/** Hashtag: `#` seguido de letra, número ou `_`. `\p{L}` para acento e cedilha
 * contarem — `#seleção` e `#coração` são hashtags reais no Brasil, e um `\w`
 * ASCII cortaria as duas no meio. */
const HASHTAG = /#[\p{L}\p{N}_]+/gu;

/** Menção a perfil: `@` seguido de letra, número, `_` ou `.`. */
const MENTION = /@[\p{L}\p{N}_.]+/gu;

/**
 * O texto que acompanha o post.
 *
 * É objeto de valor e não string solta porque tem três perguntas que a tela e o
 * agregado fazem o tempo todo — quanto mede, quantas hashtags tem, cabe nesta
 * rede — e cada uma respondida à mão num lugar diferente é uma chance de
 * divergirem.
 *
 * **A medida é em pontos de código, não em `length`.** O `.length` do
 * JavaScript conta unidades UTF-16, e um emoji como 🎉 conta 2 ali. A legenda
 * de portal tem emoji em quase toda linha de chamada, e contar por `.length`
 * recusaria texto que a Meta aceita. (Nem os pontos de código são perfeitos —
 * uma bandeira são dois — mas erram muito menos, e para menos.)
 */
export class Caption {
	private constructor(readonly value: string) {}

	/**
	 * Só há uma regra na criação: legenda vazia não é legenda. O limite de
	 * tamanho NÃO é verificado aqui, e é de propósito — ele depende da rede, e a
	 * rede se escolhe depois de escrever. Recusar no construtor obrigaria a
	 * redação a escolher o destino antes do texto, que é a ordem inversa de como
	 * se trabalha.
	 */
	static create(text: string): Result<Caption, CaptionRequired> {
		const trimmed = text.trim();
		if (trimmed === "") {
			return err(new CaptionRequired());
		}
		return ok(new Caption(trimmed));
	}

	static restore(text: string): Caption {
		return new Caption(text);
	}

	/** Caracteres como um humano (e a Meta) os conta. */
	get length(): number {
		return [...this.value].length;
	}

	get hashtags(): readonly string[] {
		return this.value.match(HASHTAG) ?? [];
	}

	get mentions(): readonly string[] {
		return this.value.match(MENTION) ?? [];
	}

	/** A legenda estoura o limite desta rede? */
	exceedsLengthFor(platform: SocialPlatform): boolean {
		return this.length > PLATFORM_LIMITS[platform].captionMaxLength;
	}

	/** Passou do teto de hashtags desta rede? */
	exceedsHashtagsFor(platform: SocialPlatform): boolean {
		return this.hashtags.length > PLATFORM_LIMITS[platform].hashtagMaxCount;
	}

	equals(other: Caption): boolean {
		return this.value === other.value;
	}
}
