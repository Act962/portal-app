import { AggregateRoot, err, ok, type Result } from "@portal-app/shared-kernel";

import { OUTPUT_SIZE, type Size } from "../focal-crop";
import {
	DESTINATION_FORMAT,
	DESTINATION_LABEL,
	type SocialDestination,
} from "../platform";
import {
	fontSupports,
	isTemplateFontFamily,
	type TemplateFontFamily,
} from "./fonts";

/**
 * O formato do quadro. Declarado pelo padrão (spec 09, D3): 9:16 serve aos
 * Stories; 1:1 e 4:5, ao feed.
 */
export const ART_FORMATS = ["1:1", "4:5", "9:16"] as const;
export type ArtFormat = (typeof ART_FORMATS)[number];

/** O tamanho do quadro em pixels — o mesmo em que a arte é desenhada. */
export function canvasOf(format: ArtFormat): Size {
	return OUTPUT_SIZE[format];
}

/** Onde a camada fica, em pixels do quadro final. */
export type Box = { x: number; y: number; width: number; height: number };

/**
 * De onde vem o texto da caixa.
 *
 * `STATIC` é o texto fixo do padrão ("MATÉRIA COMPLETA NOS STORIES"). Os outros
 * vêm da matéria — e em todos a redação pode trocar o texto NO POST, sem mexer
 * no padrão (`textForLayer`).
 */
export const TEXT_SOURCES = [
	"HEADLINE",
	"KICKER",
	"SECTION",
	"STATIC",
] as const;
export type TextSource = (typeof TEXT_SOURCES)[number];

export type TextBackground = {
	color: string;
	radius: number;
	paddingX: number;
	paddingY: number;
};

export type TextStyle = {
	fontFamily: TemplateFontFamily;
	fontWeight: number;
	italic: boolean;
	/** O tamanho cheio — o que o título curto usa. */
	fontSize: number;
	/** Até onde o texto pode encolher para caber (D7). */
	minFontSize: number;
	/** Entrelinha, em múltiplos do tamanho da fonte. */
	lineHeight: number;
	color: string;
	uppercase: boolean;
	align: "left" | "center" | "right";
	verticalAlign: "top" | "middle" | "bottom";
	maxLines: number;
	/** A pílula atrás do texto ("ÚLTIMAS"). `null` é texto solto. */
	background: TextBackground | null;
};

export type PhotoLayer = { id: string; kind: "PHOTO"; box: Box };

export type ImageLayer = {
	id: string;
	kind: "IMAGE";
	box: Box;
	/** A moldura, o logo, o selo — da biblioteca de mídia. */
	mediaId: string;
	fit: "cover" | "contain";
};

export type ShapeLayer = {
	id: string;
	kind: "SHAPE";
	box: Box;
	color: string;
	radius: number;
	opacity: number;
};

export type TextLayer = {
	id: string;
	kind: "TEXT";
	box: Box;
	source: TextSource;
	/** Em `STATIC`, o texto. Nos outros, o exemplo que o editor mostra. */
	text: string;
	style: TextStyle;
};

/** Uma camada. A ORDEM na lista é a pilha: a primeira fica embaixo. */
export type TemplateLayer = PhotoLayer | ImageLayer | ShapeLayer | TextLayer;

export const MAX_LAYERS = 30;
export const TEMPLATE_NAME_MAX = 60;
export const TEMPLATE_TEXT_MAX = 300;
const COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** O estilo com que uma caixa de texto nasce no editor. */
export const DEFAULT_TEXT_STYLE: TextStyle = {
	fontFamily: "Montserrat",
	fontWeight: 800,
	italic: false,
	fontSize: 64,
	minFontSize: 32,
	lineHeight: 1.15,
	color: "#ffffff",
	uppercase: false,
	align: "left",
	verticalAlign: "top",
	maxLines: 4,
	background: null,
};

/**
 * O padrão recusou, com a lista do que corrigir — pelo mesmo motivo do
 * `PostNotReady`: a tela do editor precisa apontar a camada, não dizer "inválido".
 */
export class InvalidArtTemplate extends Error {
	override readonly name = "InvalidArtTemplate";
	constructor(readonly problems: readonly string[]) {
		/* v8 ignore next -- o `??` é só para o tipo: só se constrói com problema. */
		super(problems[0] ?? "O padrão de arte é inválido.");
	}
}

/**
 * Este formato serve a este destino? Story pede 9:16; feed pede 1:1 ou 4:5.
 * É a regra que impede um padrão 4:5 de virar o padrão dos Stories (D10).
 */
export function formatServes(
	format: ArtFormat,
	destination: SocialDestination,
): boolean {
	return DESTINATION_FORMAT[destination] === "STORY"
		? format === "9:16"
		: format !== "9:16";
}

/**
 * Tudo o que está errado no padrão, em frases para a tela. Lista vazia é padrão
 * válido.
 *
 * Função exportada, e não só a guarda do agregado, porque o editor a chama a
 * cada mudança: o problema aparece do lado da camada enquanto a pessoa monta,
 * e não só quando ela clica em salvar.
 */
export function templateProblems(input: {
	name: string;
	format: ArtFormat;
	layers: readonly TemplateLayer[];
	defaultFor: readonly SocialDestination[];
}): string[] {
	const problems: string[] = [];
	const name = input.name.trim();
	if (name === "") {
		problems.push("Dê um nome ao padrão.");
	} else if ([...name].length > TEMPLATE_NAME_MAX) {
		problems.push(`O nome do padrão passa de ${TEMPLATE_NAME_MAX} caracteres.`);
	}
	if (!(ART_FORMATS as readonly string[]).includes(input.format)) {
		problems.push(`Formato desconhecido: ${input.format}.`);
		return problems;
	}

	if (input.layers.length > MAX_LAYERS) {
		problems.push(`Um padrão aceita até ${MAX_LAYERS} camadas.`);
	}
	if (input.layers.filter((layer) => layer.kind === "PHOTO").length > 1) {
		problems.push("O padrão só pode ter uma camada de foto.");
	}

	const canvas = canvasOf(input.format);
	const seen = new Set<string>();
	input.layers.forEach((layer, index) => {
		const label = `Camada ${index + 1}`;
		if (layer.id.trim() === "") {
			problems.push(`${label}: falta o identificador.`);
		} else if (seen.has(layer.id)) {
			problems.push(`${label}: identificador repetido (${layer.id}).`);
		}
		seen.add(layer.id);
		problems.push(...boxProblems(label, layer.box, canvas));
		problems.push(...layerProblems(label, layer));
	});

	for (const destination of input.defaultFor) {
		if (!formatServes(input.format, destination)) {
			problems.push(
				`Um padrão ${input.format} não pode ser o padrão de ${DESTINATION_LABEL[destination]}.`,
			);
		}
	}

	return problems;
}

function boxProblems(label: string, box: Box, canvas: Size): string[] {
	const values = [box.x, box.y, box.width, box.height];
	if (!values.every(Number.isFinite)) {
		return [`${label}: posição ou tamanho inválido.`];
	}
	if (box.width < 1 || box.height < 1) {
		return [`${label}: a caixa precisa ter largura e altura.`];
	}
	// Pode sangrar para fora do quadro (moldura maior que a tela é comum); não
	// pode estar INTEIRA fora, porque aí é camada que nunca aparece.
	const inside =
		box.x < canvas.width &&
		box.y < canvas.height &&
		box.x + box.width > 0 &&
		box.y + box.height > 0;
	return inside ? [] : [`${label}: a caixa está toda fora do quadro.`];
}

function layerProblems(label: string, layer: TemplateLayer): string[] {
	switch (layer.kind) {
		case "PHOTO":
			return [];
		case "IMAGE":
			return layer.mediaId.trim() === ""
				? [`${label}: escolha a imagem da biblioteca.`]
				: [];
		case "SHAPE": {
			const problems: string[] = [];
			if (!COLOR.test(layer.color)) {
				problems.push(`${label}: cor inválida (${layer.color}).`);
			}
			if (!(layer.opacity >= 0 && layer.opacity <= 1)) {
				problems.push(`${label}: a opacidade vai de 0 a 1.`);
			}
			if (!(layer.radius >= 0)) {
				problems.push(`${label}: o arredondamento não pode ser negativo.`);
			}
			return problems;
		}
		case "TEXT":
			return textProblems(label, layer);
	}
}

function textProblems(label: string, layer: TextLayer): string[] {
	const problems: string[] = [];
	const { style } = layer;

	if (!(TEXT_SOURCES as readonly string[]).includes(layer.source)) {
		problems.push(`${label}: origem do texto desconhecida.`);
	}
	if (layer.source === "STATIC" && layer.text.trim() === "") {
		problems.push(`${label}: escreva o texto fixo.`);
	}
	if ([...layer.text].length > TEMPLATE_TEXT_MAX) {
		problems.push(
			`${label}: o texto passa de ${TEMPLATE_TEXT_MAX} caracteres.`,
		);
	}

	if (!isTemplateFontFamily(style.fontFamily)) {
		problems.push(`${label}: a fonte ${style.fontFamily} não está disponível.`);
	} else if (!fontSupports(style.fontFamily, style.fontWeight, style.italic)) {
		problems.push(
			`${label}: a ${style.fontFamily} não tem ${style.italic ? "itálico " : ""}no peso ${style.fontWeight}.`,
		);
	}
	if (!(style.fontSize >= 8 && style.fontSize <= 400)) {
		problems.push(`${label}: o tamanho da fonte vai de 8 a 400.`);
	}
	if (!(style.minFontSize >= 8 && style.minFontSize <= style.fontSize)) {
		problems.push(
			`${label}: o tamanho mínimo vai de 8 até o tamanho da fonte.`,
		);
	}
	if (!(style.lineHeight >= 0.8 && style.lineHeight <= 2)) {
		problems.push(`${label}: a entrelinha vai de 0,8 a 2.`);
	}
	if (
		!(Number.isInteger(style.maxLines) && style.maxLines >= 1) ||
		style.maxLines > 12
	) {
		problems.push(`${label}: o máximo de linhas vai de 1 a 12.`);
	}
	if (!COLOR.test(style.color)) {
		problems.push(`${label}: cor do texto inválida (${style.color}).`);
	}
	if (style.background) {
		const { color, radius, paddingX, paddingY } = style.background;
		if (!COLOR.test(color)) {
			problems.push(`${label}: cor do fundo inválida (${color}).`);
		}
		if (!(radius >= 0 && paddingX >= 0 && paddingY >= 0)) {
			problems.push(
				`${label}: arredondamento e respiro do fundo não podem ser negativos.`,
			);
		}
	}
	return problems;
}

type ArtTemplateProps = {
	id: string;
	name: string;
	format: ArtFormat;
	layers: readonly TemplateLayer[];
	defaultFor: readonly SocialDestination[];
	/** Sobe a cada mudança no DESENHO. O post guarda a versão que aprovou (D9). */
	version: number;
	archived: boolean;
	createdAt: Date;
	updatedAt: Date;
};

/**
 * Um padrão de arte: o desenho que a notícia veste nas redes (spec 09).
 *
 * É um agregado próprio, e não configuração solta, porque tem invariantes que
 * valem em todo caminho de escrita — uma foto só, fonte que o renderizador
 * conhece, formato compatível com o destino de que é padrão — e porque tem
 * VERSÃO: o post aprovado aponta para o desenho que alguém viu, e editar o
 * padrão depois não pode mudar o que já está a caminho do Instagram.
 */
export class ArtTemplate extends AggregateRoot<string> {
	private constructor(private state: ArtTemplateProps) {
		super(state.id);
	}

	static create(input: {
		id: string;
		name: string;
		format: ArtFormat;
		layers?: readonly TemplateLayer[];
		defaultFor?: readonly SocialDestination[];
		createdAt: Date;
	}): Result<ArtTemplate, InvalidArtTemplate> {
		const props: ArtTemplateProps = {
			id: input.id,
			name: input.name.trim(),
			format: input.format,
			layers: [...(input.layers ?? [])],
			defaultFor: unique(input.defaultFor ?? []),
			version: 1,
			archived: false,
			createdAt: input.createdAt,
			updatedAt: input.createdAt,
		};
		const problems = templateProblems(props);
		if (problems.length > 0) {
			return err(new InvalidArtTemplate(problems));
		}
		return ok(new ArtTemplate(props));
	}

	/** Reidrata do banco, sem revalidar. */
	static restore(props: ArtTemplateProps): ArtTemplate {
		return new ArtTemplate({
			...props,
			layers: [...props.layers],
			defaultFor: [...props.defaultFor],
		});
	}

	get name(): string {
		return this.state.name;
	}
	get format(): ArtFormat {
		return this.state.format;
	}
	get canvas(): Size {
		return canvasOf(this.state.format);
	}
	get layers(): readonly TemplateLayer[] {
		return this.state.layers;
	}
	get defaultFor(): readonly SocialDestination[] {
		return this.state.defaultFor;
	}
	get version(): number {
		return this.state.version;
	}
	get archived(): boolean {
		return this.state.archived;
	}
	get createdAt(): Date {
		return this.state.createdAt;
	}
	get updatedAt(): Date {
		return this.state.updatedAt;
	}

	/** A camada da foto do post, se o padrão tem uma. */
	get photoLayer(): PhotoLayer | null {
		return (
			this.state.layers.find(
				(layer): layer is PhotoLayer => layer.kind === "PHOTO",
			) ?? null
		);
	}

	get textLayers(): readonly TextLayer[] {
		return this.state.layers.filter(
			(layer): layer is TextLayer => layer.kind === "TEXT",
		);
	}

	/** Os ids da biblioteca que o desenho usa (molduras, logos) — a checagem de
	 * "esta mídia está em uso" precisa deles. */
	get mediaIds(): readonly string[] {
		return this.state.layers
			.filter((layer): layer is ImageLayer => layer.kind === "IMAGE")
			.map((layer) => layer.mediaId);
	}

	isDefaultFor(destination: SocialDestination): boolean {
		return !this.state.archived && this.state.defaultFor.includes(destination);
	}

	/**
	 * Muda o desenho. **Sobe a versão** — é o que separa os posts já aprovados
	 * (que guardam a versão antiga) dos próximos.
	 *
	 * Tudo ou nada: com qualquer problema, nada muda.
	 */
	update(
		input: {
			name?: string;
			format?: ArtFormat;
			layers?: readonly TemplateLayer[];
		},
		at: Date,
	): Result<void, InvalidArtTemplate> {
		const next: ArtTemplateProps = {
			...this.state,
			name: input.name?.trim() ?? this.state.name,
			format: input.format ?? this.state.format,
			layers: input.layers ? [...input.layers] : this.state.layers,
		};
		const problems = templateProblems(next);
		if (problems.length > 0) {
			return err(new InvalidArtTemplate(problems));
		}
		this.state = { ...next, version: this.state.version + 1, updatedAt: at };
		return ok(undefined);
	}

	/**
	 * De que destinos este padrão é o padrão. **Não sobe a versão**: não muda o
	 * desenho. "Só um por destino" é regra da aplicação (D10), que desmarca o
	 * anterior — o agregado não enxerga os outros padrões.
	 */
	setDefaultFor(
		destinations: readonly SocialDestination[],
		at: Date,
	): Result<void, InvalidArtTemplate> {
		const defaultFor = unique(destinations);
		const problems = templateProblems({ ...this.state, defaultFor });
		if (problems.length > 0) {
			return err(new InvalidArtTemplate(problems));
		}
		this.state = { ...this.state, defaultFor, updatedAt: at };
		return ok(undefined);
	}

	/**
	 * Tira o padrão da lista de escolha. Não apaga: posts já aprovados apontam
	 * para ele e precisam continuar sendo desenhados (D9). Deixa de ser padrão
	 * de qualquer destino — senão o post automático continuaria nascendo com um
	 * desenho que ninguém mais vê na tela.
	 */
	archive(at: Date): void {
		this.state = {
			...this.state,
			archived: true,
			defaultFor: [],
			updatedAt: at,
		};
	}
}

function unique<T>(values: readonly T[]): readonly T[] {
	return [...new Set(values)];
}
