/**
 * A geometria do corte da imagem para a rede social — sem biblioteca de imagem,
 * sem I/O, só aritmética.
 *
 * Mora no domínio, e não junto do `sharp` na raiz de composição, porque é a
 * parte que pode errar em silêncio: um corte que ignora o ponto focal não lança
 * exceção nenhuma, só publica no Instagram a foto do prefeito sem a cabeça. Uma
 * função pura se prova com uma tabela de casos; o `sharp` só executa o que ela
 * decidiu.
 */

export type Size = { width: number; height: number };

/** Ponto focal em frações do quadrado unitário — o mesmo formato do contexto de
 * mídia: (0,0) é o topo-esquerda, (1,1) o canto inferior-direito. */
export type Focal = { x: number; y: number };

export type CropAspect = "1:1" | "4:5" | "9:16";

export type CropBox = {
	left: number;
	top: number;
	width: number;
	height: number;
};

/**
 * O tamanho final de cada proporção, em pixels.
 *
 * 1080 de largura é a resolução em que o Instagram exibe o feed. Mandar maior
 * só aumenta o download que a Meta faz (com teto de 8 MB) sem ganho visível;
 * mandar menor, ela amplia e borra. `9:16` é a tela cheia dos Stories.
 */
export const OUTPUT_SIZE: Record<CropAspect, Size> = {
	"1:1": { width: 1080, height: 1080 },
	"4:5": { width: 1080, height: 1350 },
	"9:16": { width: 1080, height: 1920 },
};

/**
 * Onde a foto INTEIRA fica dentro do quadro do story (§17).
 *
 * O story não usa o corte do feed. Foto de notícia é quase sempre deitada, e
 * cortá-la em 9:16 deixaria uma fatia vertical de um terço da imagem — o
 * prefeito sem o público, o acidente sem a rua. O quadro mostra a foto inteira,
 * o maior possível e centrada; o que sobra em cima e embaixo é preenchido com
 * a própria foto ampliada e desfocada (quem desenha isso é o `sharp`, na raiz
 * de composição).
 *
 * Nunca amplia além do quadro e nunca devolve dimensão zero.
 */
export function storyLayout(image: Size): CropBox {
	const frame = OUTPUT_SIZE["9:16"];
	const scale = Math.min(
		frame.width / Math.max(1, image.width),
		frame.height / Math.max(1, image.height),
	);
	const width = clamp(Math.round(image.width * scale), 1, frame.width);
	const height = clamp(Math.round(image.height * scale), 1, frame.height);
	return {
		left: Math.floor((frame.width - width) / 2),
		top: Math.floor((frame.height - height) / 2),
		width,
		height,
	};
}

/**
 * O maior retângulo da proporção pedida que cabe na imagem, centrado no ponto
 * focal — e empurrado para dentro quando o ponto está perto da borda.
 *
 * O "empurrado para dentro" é o que distingue isto de um corte ingênuo: com o
 * rosto no canto da foto, centrar exatamente nele faria o retângulo sair da
 * imagem. O certo é encostar na borda e manter o rosto no quadro, ainda que
 * fora do centro.
 *
 * Arredonda para pixels inteiros e nunca devolve largura ou altura zero, porque
 * é o que o `extract` do `sharp` exige.
 */
export function focalCrop(
	image: Size,
	focal: Focal,
	aspect: CropAspect,
): CropBox {
	return focalCropTo(image, focal, OUTPUT_SIZE[aspect]);
}

/**
 * O mesmo corte, para uma proporção QUALQUER — a da caixa da foto num padrão de
 * arte (spec 09), que não é 1:1 nem 4:5, é o retângulo que o padrão desenhou.
 */
export function focalCropTo(image: Size, focal: Focal, target: Size): CropBox {
	const ratio = Math.max(1, target.width) / Math.max(1, target.height);

	let width = image.width;
	let height = Math.round(width / ratio);
	if (height > image.height) {
		height = image.height;
		width = Math.round(height * ratio);
	}
	width = Math.max(1, Math.min(width, image.width));
	height = Math.max(1, Math.min(height, image.height));

	const fx = clampUnit(focal.x);
	const fy = clampUnit(focal.y);

	const left = clamp(
		Math.round(fx * image.width - width / 2),
		0,
		image.width - width,
	);
	const top = clamp(
		Math.round(fy * image.height - height / 2),
		0,
		image.height - height,
	);

	return { left, top, width, height };
}

/**
 * A chave do arquivo cortado no armazenamento.
 *
 * O ponto focal ENTRA na chave. Sem isso, a redação corrige o ponto focal da
 * capa, aprova o post, e a Meta recebe o corte antigo — porque o arquivo com o
 * mesmo nome já existia. Com ele na chave, mudar o ponto é gerar outro arquivo,
 * e o antigo simplesmente deixa de ser usado.
 */
export function croppedImageKey(
	mediaId: string,
	aspect: CropAspect,
	focal: Focal,
): string {
	const fx = Math.round(clampUnit(focal.x) * 1000);
	const fy = Math.round(clampUnit(focal.y) * 1000);
	return `social/${mediaId}-${aspect.replace(":", "x")}-${fx}-${fy}.jpg`;
}

function clampUnit(value: number): number {
	if (!Number.isFinite(value)) {
		return 0.5;
	}
	return clamp(value, 0, 1);
}

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}
