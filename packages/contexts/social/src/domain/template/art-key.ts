/**
 * A chave da arte desenhada no armazenamento (spec 09, D8).
 *
 * A arte é CACHE: a chave é o hash de tudo que define o desenho. Mesma entrada,
 * mesma chave — reenviar não redesenha. Qualquer entrada diferente (outra
 * versão do padrão, outro ponto focal, uma vírgula no título) dá outra chave, e
 * a arte velha simplesmente deixa de ser usada em vez de ser servida no lugar
 * da nova. É o que o `croppedImageKey` faz com o ponto focal, generalizado.
 */
export type ArtKeyInput = {
	templateId: string;
	templateVersion: number;
	/** A foto do post e o ponto focal com que foi enquadrada. */
	photo: { mediaId: string; focal: { x: number; y: number } } | null;
	/** O texto final de cada caixa, por id da camada. */
	texts: Readonly<Record<string, string>>;
	/** As molduras e logos resolvidos, por id — trocar a moldura muda a arte. */
	images?: Readonly<Record<string, string>>;
};

export function artImageKey(input: ArtKeyInput): string {
	return `social/art/${input.templateId}-v${input.templateVersion}-${stableHash(input)}.jpg`;
}

/** O que define o vídeo montado: o desenho, mais os trechos NA ORDEM. */
export type VideoKeyInput = ArtKeyInput & {
	clips: readonly {
		mediaId: string;
		startSeconds: number;
		endSeconds: number;
		muted: boolean;
	}[];
};

/**
 * A chave do vídeo montado (spec 12, D5). Mesma ideia da arte, e aqui ela vale
 * muito mais: remontar um vídeo custa dezenas de segundos de processador, e
 * reenviar um post que falhou no Instagram não pode pagar isso de novo.
 *
 * Os TRECHOS entram na chave junto com o desenho, na ordem. Sem eles, aparar
 * meio segundo — ou trocar dois cortes de lugar — e reenviar devolveria o
 * arquivo antigo, e o defeito seria invisível: um vídeo quase igual não chama a
 * atenção de ninguém.
 *
 * `.mp4` e `.jpg` (a capa) saem da mesma chave, para as duas andarem juntas: a
 * capa de um vídeo antigo sobre um vídeo novo é exatamente o tipo de mistura
 * que um cache com duas chaves independentes produz.
 */
export function videoArtKey(input: VideoKeyInput): {
	video: string;
	cover: string;
} {
	const base = `social/video/${input.templateId}-v${input.templateVersion}-${stableHash(input)}`;
	return { video: `${base}.mp4`, cover: `${base}.jpg` };
}

/**
 * Hash estável de um valor serializável: as chaves dos objetos são ordenadas,
 * então `{a, b}` e `{b, a}` dão o mesmo resultado.
 *
 * Não é criptográfico, e não precisa ser: ninguém ganha nada forjando colisão
 * de nome de arquivo de arte. São dois FNV-1a de 32 bits com sementes
 * diferentes — 16 dígitos hex, sem dependência nenhuma (o domínio não tem npm).
 */
export function stableHash(value: unknown): string {
	const text = canonical(value);
	return hex(fnv1a(text, 0x811c9dc5)) + hex(fnv1a(text, 0x9e3779b9));
}

function canonical(value: unknown): string {
	if (Array.isArray(value)) {
		return `[${value.map(canonical).join(",")}]`;
	}
	if (value !== null && typeof value === "object") {
		const entries = Object.entries(value as Record<string, unknown>)
			.filter(([, item]) => item !== undefined)
			.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
		return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonical(item)}`).join(",")}}`;
	}
	return JSON.stringify(value) ?? "null";
}

function fnv1a(text: string, seed: number): number {
	let hash = seed >>> 0;
	for (let index = 0; index < text.length; index += 1) {
		hash ^= text.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return hash >>> 0;
}

function hex(value: number): string {
	return value.toString(16).padStart(8, "0");
}
