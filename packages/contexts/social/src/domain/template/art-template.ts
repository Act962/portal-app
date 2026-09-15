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
import { SYSTEM_VARIABLE_KEYS, tokensIn, VARIABLE_KEY } from "./variables";

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

// ── o desenho (spec 10, §4) ─────────────────────────────────────────────────

export type Stroke = { color: string; width: number };

export type Shadow = {
	color: string;
	blur: number;
	offsetX: number;
	offsetY: number;
	opacity: number;
};

export type GradientStop = { offset: number; color: string };

export type Fill =
	| { type: "solid"; color: string }
	/** `angle` em graus: 0 vai da esquerda para a direita; 90, de cima para baixo. */
	| { type: "linear"; angle: number; stops: GradientStop[] };

/**
 * O que todo elemento tem. Posição e tamanho em pixels do quadro final; `x/y` é
 * o canto superior esquerdo ANTES da rotação, e a rotação (graus) gira em torno
 * do centro da caixa (D7).
 */
export type ElementBase = {
	id: string;
	/** Como a camada se chama no painel. */
	name: string;
	x: number;
	y: number;
	width: number;
	height: number;
	rotation: number;
	/** 0 a 1. */
	opacity: number;
	visible: boolean;
	/** Travado não se seleciona no palco — é a moldura que ninguém quer arrastar
	 * sem querer. */
	locked: boolean;
};

/** O lugar da foto do post, enquadrada pelo ponto focal. */
export type PhotoElement = ElementBase & {
	kind: "PHOTO";
	/** Ausente em padrões antigos: uma única foto. */
	repeat?: "none" | "vertical" | "horizontal";
	repeatCount?: number;
	cornerRadius: number;
	stroke: Stroke | null;
};

/** A moldura, o logo, o selo — da biblioteca de mídia. */
export type ImageElement = ElementBase & {
	kind: "IMAGE";
	mediaId: string;
	fit: "cover" | "contain" | "stretch";
	cornerRadius: number;
};

export type RectElement = ElementBase & {
	kind: "RECT";
	fill: Fill;
	cornerRadius: number;
	stroke: Stroke | null;
	shadow: Shadow | null;
};

export type EllipseElement = ElementBase & {
	kind: "ELLIPSE";
	fill: Fill;
	stroke: Stroke | null;
	shadow: Shadow | null;
};

/** Uma linha horizontal no meio da caixa; a inclinação é a rotação. */
export type LineElement = ElementBase & { kind: "LINE"; stroke: Stroke };

export type TextBackground = {
	color: string;
	radius: number;
	paddingX: number;
	paddingY: number;
	/** `hug` abraça o texto (a pílula "ÚLTIMAS"); `box` ocupa a caixa inteira. */
	shape: "hug" | "box";
};

export type TextStyle = {
	fontFamily: TemplateFontFamily;
	fontWeight: number;
	italic: boolean;
	/** O tamanho cheio — o que o texto curto usa. */
	fontSize: number;
	/** Até onde o texto pode encolher para caber (D8). */
	minFontSize: number;
	maxLines: number;
	/** Entrelinha, em múltiplos do tamanho da fonte. */
	lineHeight: number;
	/** Espaço entre letras, em pixels. */
	letterSpacing: number;
	color: string;
	align: "left" | "center" | "right";
	verticalAlign: "top" | "middle" | "bottom";
	uppercase: boolean;
	stroke: Stroke | null;
	shadow: Shadow | null;
	background: TextBackground | null;
};

/** De onde vem o texto da caixa, e quem pode mexer nele (D3). */
export const TEXT_MODES = ["STATIC", "DYNAMIC", "EDITABLE"] as const;
export type TextMode = (typeof TEXT_MODES)[number];

export type TextElement = ElementBase & {
	kind: "TEXT";
	mode: TextMode;
	/** O texto — com `{{variáveis}}` nos modos Dinâmico e Editável. */
	content: string;
	/** No modo Editável, o nome do campo que aparece no post. */
	fieldLabel: string;
	style: TextStyle;
};

export type ArtElement =
	| PhotoElement
	| ImageElement
	| RectElement
	| EllipseElement
	| LineElement
	| TextElement;

export type ElementKind = ArtElement["kind"];

/** Uma variável criada pelo designer (D2): `{{chamada}}`. */
export type TemplateVariable = {
	key: string;
	label: string;
	defaultValue: string;
	multiline: boolean;
};

export type ArtDesign = {
	/** A cor do quadro onde nenhum elemento cobre. */
	background: string;
	/** A ORDEM é a pilha: o primeiro fica embaixo. */
	elements: readonly ArtElement[];
	variables: readonly TemplateVariable[];
};

export const EMPTY_DESIGN: ArtDesign = {
	background: "#ffffff",
	elements: [],
	variables: [],
};

export const MAX_ELEMENTS = 60;
export const MAX_VARIABLES = 20;
export const TEMPLATE_NAME_MAX = 60;
export const TEMPLATE_TEXT_MAX = 300;
export const LABEL_MAX = 40;
const COLOR = /^#(?:[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** O estilo com que uma caixa de texto nasce no editor. */
export const DEFAULT_TEXT_STYLE: TextStyle = {
	fontFamily: "Montserrat",
	fontWeight: 800,
	italic: false,
	fontSize: 64,
	minFontSize: 32,
	maxLines: 4,
	lineHeight: 1.15,
	letterSpacing: 0,
	color: "#ffffff",
	align: "left",
	verticalAlign: "top",
	uppercase: false,
	stroke: null,
	shadow: null,
	background: null,
};

/**
 * O padrão recusou, com a lista do que corrigir — a tela do editor precisa
 * apontar o elemento, não dizer "inválido".
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
 * É a regra que impede um padrão 4:5 de virar o padrão dos Stories (09, D10).
 */
export function formatServes(
	format: ArtFormat,
	destination: SocialDestination,
): boolean {
	return DESTINATION_FORMAT[destination] === "STORY"
		? format === "9:16"
		: format !== "9:16";
}

/** Como o elemento se chama numa frase de problema. */
export function elementLabel(element: ArtElement, index: number): string {
	const name = element.name.trim();
	return name ? `"${name}"` : `Elemento ${index + 1}`;
}

/**
 * Tudo o que está errado no padrão, em frases para a tela. Lista vazia é padrão
 * válido. Exportada porque o editor a chama a cada mudança.
 */
export function templateProblems(input: {
	name: string;
	format: ArtFormat;
	design: ArtDesign;
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
	problems.push(...designProblems(input.format, input.design));
	for (const destination of input.defaultFor) {
		if (!formatServes(input.format, destination)) {
			problems.push(
				`Um padrão ${input.format} não pode ser o padrão de ${DESTINATION_LABEL[destination]}.`,
			);
		}
	}
	return problems;
}

/** Os problemas só do desenho — sem nome nem destinos. */
export function designProblems(format: ArtFormat, design: ArtDesign): string[] {
	const problems: string[] = [];
	if (!COLOR.test(design.background)) {
		problems.push(`Cor de fundo do quadro inválida (${design.background}).`);
	}
	problems.push(...variableProblems(design.variables));

	const { elements } = design;
	if (elements.length > MAX_ELEMENTS) {
		problems.push(`Um padrão aceita até ${MAX_ELEMENTS} elementos.`);
	}
	if (elements.filter((element) => element.kind === "PHOTO").length > 1) {
		problems.push("O padrão só pode ter um lugar de foto.");
	}

	const known = new Set([
		...SYSTEM_VARIABLE_KEYS,
		...design.variables.map((variable) => variable.key),
	]);
	const canvas = canvasOf(format);
	const seen = new Set<string>();
	elements.forEach((element, index) => {
		const label = elementLabel(element, index);
		if (element.id.trim() === "") {
			problems.push(`${label}: falta o identificador.`);
		} else if (seen.has(element.id)) {
			problems.push(`${label}: identificador repetido (${element.id}).`);
		}
		seen.add(element.id);
		problems.push(...baseProblems(label, element, canvas));
		problems.push(...kindProblems(label, element, known));
	});
	return problems;
}

function variableProblems(variables: readonly TemplateVariable[]): string[] {
	const problems: string[] = [];
	if (variables.length > MAX_VARIABLES) {
		problems.push(`Um padrão aceita até ${MAX_VARIABLES} variáveis.`);
	}
	const seen = new Set<string>();
	for (const variable of variables) {
		const label = `Variável {{${variable.key}}}`;
		if (!VARIABLE_KEY.test(variable.key)) {
			problems.push(
				`${label}: a chave usa só letras minúsculas, números e _, começando por letra.`,
			);
		} else if (SYSTEM_VARIABLE_KEYS.includes(variable.key)) {
			problems.push(`${label}: essa chave já é uma variável da matéria.`);
		} else if (seen.has(variable.key)) {
			problems.push(`${label}: chave repetida.`);
		}
		seen.add(variable.key);
		if (variable.label.trim() === "") {
			problems.push(`${label}: dê um nome ao campo.`);
		} else if ([...variable.label].length > LABEL_MAX) {
			problems.push(`${label}: o nome passa de ${LABEL_MAX} caracteres.`);
		}
		if ([...variable.defaultValue].length > TEMPLATE_TEXT_MAX) {
			problems.push(
				`${label}: o valor padrão passa de ${TEMPLATE_TEXT_MAX} caracteres.`,
			);
		}
	}
	return problems;
}

function baseProblems(
	label: string,
	element: ArtElement,
	canvas: Size,
): string[] {
	const numbers = [
		element.x,
		element.y,
		element.width,
		element.height,
		element.rotation,
	];
	if (!numbers.every(Number.isFinite)) {
		return [`${label}: posição, tamanho ou rotação inválidos.`];
	}
	const problems: string[] = [];
	if (element.width < 1 || element.height < 1) {
		problems.push(`${label}: a caixa precisa ter largura e altura.`);
	} else if (!touchesCanvas(element, canvas)) {
		problems.push(`${label}: está todo fora do quadro.`);
	}
	if (!(element.opacity >= 0 && element.opacity <= 1)) {
		problems.push(`${label}: a opacidade vai de 0 a 1.`);
	}
	if ([...element.name].length > TEMPLATE_NAME_MAX) {
		problems.push(`${label}: o nome passa de ${TEMPLATE_NAME_MAX} caracteres.`);
	}
	return problems;
}

/**
 * A caixa girada encosta no quadro? Pode sangrar para fora (moldura maior que a
 * tela é comum); não pode estar INTEIRA fora, porque aí nunca aparece. Usa a
 * caixa envolvente da caixa girada — pode aceitar um canto que só a envolvente
 * toca, e isso é inofensivo.
 */
export function touchesCanvas(
	element: Pick<ElementBase, "x" | "y" | "width" | "height" | "rotation">,
	canvas: Size,
): boolean {
	const bounds = rotatedBounds(element);
	return (
		bounds.x < canvas.width &&
		bounds.y < canvas.height &&
		bounds.x + bounds.width > 0 &&
		bounds.y + bounds.height > 0
	);
}

/** A caixa alinhada aos eixos que contém a caixa girada em torno do centro. */
export function rotatedBounds(
	element: Pick<ElementBase, "x" | "y" | "width" | "height" | "rotation">,
): { x: number; y: number; width: number; height: number } {
	const radians = (element.rotation * Math.PI) / 180;
	const cos = Math.abs(Math.cos(radians));
	const sin = Math.abs(Math.sin(radians));
	const width = element.width * cos + element.height * sin;
	const height = element.width * sin + element.height * cos;
	const cx = element.x + element.width / 2;
	const cy = element.y + element.height / 2;
	return { x: cx - width / 2, y: cy - height / 2, width, height };
}

function kindProblems(
	label: string,
	element: ArtElement,
	known: ReadonlySet<string>,
): string[] {
	switch (element.kind) {
		case "PHOTO":
			return [
				...(element.repeat !== undefined &&
				!["none", "vertical", "horizontal"].includes(element.repeat)
					? [`${label}: direção de repetição inválida.`]
					: []),
				...(element.repeatCount !== undefined &&
				(!Number.isInteger(element.repeatCount) ||
					element.repeatCount < 2 ||
					element.repeatCount > 6)
					? [`${label}: use de 2 a 6 repetições.`]
					: []),
				...radiusProblems(label, element.cornerRadius),
				...strokeProblems(label, element.stroke),
			];
		case "IMAGE":
			return [
				...(element.mediaId.trim() === ""
					? [`${label}: escolha a imagem da biblioteca.`]
					: []),
				...radiusProblems(label, element.cornerRadius),
			];
		case "RECT":
			return [
				...fillProblems(label, element.fill),
				...radiusProblems(label, element.cornerRadius),
				...strokeProblems(label, element.stroke),
				...shadowProblems(label, element.shadow),
			];
		case "ELLIPSE":
			return [
				...fillProblems(label, element.fill),
				...strokeProblems(label, element.stroke),
				...shadowProblems(label, element.shadow),
			];
		case "LINE":
			return strokeProblems(label, element.stroke);
		case "TEXT":
			return textProblems(label, element, known);
	}
}

function colorProblem(label: string, what: string, color: string): string[] {
	return COLOR.test(color) ? [] : [`${label}: ${what} inválida (${color}).`];
}

function radiusProblems(label: string, radius: number): string[] {
	return radius >= 0
		? []
		: [`${label}: o arredondamento não pode ser negativo.`];
}

function fillProblems(label: string, fill: Fill): string[] {
	if (fill.type === "solid") {
		return colorProblem(label, "cor", fill.color);
	}
	const problems: string[] = [];
	if (!Number.isFinite(fill.angle)) {
		problems.push(`${label}: ângulo do degradê inválido.`);
	}
	if (fill.stops.length < 2) {
		problems.push(`${label}: o degradê precisa de ao menos duas cores.`);
	}
	let previous = -1;
	for (const stop of fill.stops) {
		problems.push(...colorProblem(label, "cor do degradê", stop.color));
		if (!(stop.offset >= 0 && stop.offset <= 1) || stop.offset < previous) {
			problems.push(
				`${label}: as paradas do degradê vão de 0 a 1, em ordem crescente.`,
			);
		}
		previous = stop.offset;
	}
	return problems;
}

function strokeProblems(label: string, stroke: Stroke | null): string[] {
	if (!stroke) {
		return [];
	}
	return [
		...colorProblem(label, "cor do contorno", stroke.color),
		...(stroke.width >= 0 && stroke.width <= 200
			? []
			: [`${label}: a espessura do contorno vai de 0 a 200.`]),
	];
}

function shadowProblems(label: string, shadow: Shadow | null): string[] {
	if (!shadow) {
		return [];
	}
	const problems = colorProblem(label, "cor da sombra", shadow.color);
	if (!(shadow.blur >= 0 && shadow.blur <= 200)) {
		problems.push(`${label}: o desfoque da sombra vai de 0 a 200.`);
	}
	if (!(shadow.opacity >= 0 && shadow.opacity <= 1)) {
		problems.push(`${label}: a opacidade da sombra vai de 0 a 1.`);
	}
	if (![shadow.offsetX, shadow.offsetY].every(Number.isFinite)) {
		problems.push(`${label}: deslocamento da sombra inválido.`);
	}
	return problems;
}

function textProblems(
	label: string,
	element: TextElement,
	known: ReadonlySet<string>,
): string[] {
	const problems: string[] = [];
	const { style } = element;

	if (!(TEXT_MODES as readonly string[]).includes(element.mode)) {
		problems.push(`${label}: modo do texto desconhecido.`);
	}
	if ([...element.content].length > TEMPLATE_TEXT_MAX) {
		problems.push(
			`${label}: o texto passa de ${TEMPLATE_TEXT_MAX} caracteres.`,
		);
	}
	if (element.mode === "STATIC") {
		if (element.content.trim() === "") {
			problems.push(`${label}: escreva o texto fixo.`);
		}
	} else {
		for (const key of tokensIn(element.content)) {
			if (!known.has(key)) {
				problems.push(`${label}: a variável {{${key}}} não existe.`);
			}
		}
	}
	if (element.mode === "EDITABLE") {
		if (element.fieldLabel.trim() === "") {
			problems.push(`${label}: dê um nome ao campo que aparece no post.`);
		} else if ([...element.fieldLabel].length > LABEL_MAX) {
			problems.push(
				`${label}: o nome do campo passa de ${LABEL_MAX} caracteres.`,
			);
		}
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
	if (!(style.lineHeight >= 0.6 && style.lineHeight <= 3)) {
		problems.push(`${label}: a entrelinha vai de 0,6 a 3.`);
	}
	if (!(style.letterSpacing >= -20 && style.letterSpacing <= 100)) {
		problems.push(`${label}: o espaço entre letras vai de -20 a 100.`);
	}
	if (
		!(Number.isInteger(style.maxLines) && style.maxLines >= 1) ||
		style.maxLines > 12
	) {
		problems.push(`${label}: o máximo de linhas vai de 1 a 12.`);
	}
	problems.push(...colorProblem(label, "cor do texto", style.color));
	problems.push(...strokeProblems(label, style.stroke));
	problems.push(...shadowProblems(label, style.shadow));
	if (style.background) {
		const { color, radius, paddingX, paddingY } = style.background;
		problems.push(...colorProblem(label, "cor do fundo do texto", color));
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
	design: ArtDesign;
	defaultFor: readonly SocialDestination[];
	/** Sobe a cada mudança no DESENHO. O post guarda a versão que aprovou (09, D9). */
	version: number;
	archived: boolean;
	createdAt: Date;
	updatedAt: Date;
};

/**
 * Um padrão de arte: o desenho que a notícia veste nas redes (specs 09 e 10).
 *
 * Agregado próprio porque tem invariantes que valem em todo caminho de escrita
 * — um lugar de foto só, fonte que o desenhista conhece, variável que existe,
 * formato compatível com o destino — e porque tem VERSÃO: o post aprovado
 * guarda o desenho que alguém viu.
 */
export class ArtTemplate extends AggregateRoot<string> {
	private constructor(private state: ArtTemplateProps) {
		super(state.id);
	}

	static create(input: {
		id: string;
		name: string;
		format: ArtFormat;
		design?: ArtDesign;
		defaultFor?: readonly SocialDestination[];
		createdAt: Date;
	}): Result<ArtTemplate, InvalidArtTemplate> {
		const props: ArtTemplateProps = {
			id: input.id,
			name: input.name.trim(),
			format: input.format,
			design: copyDesign(input.design ?? EMPTY_DESIGN),
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
			design: copyDesign(props.design),
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
	get design(): ArtDesign {
		return this.state.design;
	}
	get elements(): readonly ArtElement[] {
		return this.state.design.elements;
	}
	get variables(): readonly TemplateVariable[] {
		return this.state.design.variables;
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

	/** O lugar da foto do post, se o padrão tem um. */
	get photoElement(): PhotoElement | null {
		return photoElementOf(this.state.design);
	}

	get textElements(): readonly TextElement[] {
		return textElementsOf(this.state.design);
	}

	/** Os ids da biblioteca que o desenho usa — a checagem de "mídia em uso". */
	get mediaIds(): readonly string[] {
		return mediaIdsOf(this.state.design);
	}

	isDefaultFor(destination: SocialDestination): boolean {
		return !this.state.archived && this.state.defaultFor.includes(destination);
	}

	/**
	 * Muda o desenho. **Sobe a versão.** Tudo ou nada: com qualquer problema,
	 * nada muda.
	 */
	update(
		input: { name?: string; format?: ArtFormat; design?: ArtDesign },
		at: Date,
	): Result<void, InvalidArtTemplate> {
		const next: ArtTemplateProps = {
			...this.state,
			name: input.name?.trim() ?? this.state.name,
			format: input.format ?? this.state.format,
			design: input.design ? copyDesign(input.design) : this.state.design,
		};
		const problems = templateProblems(next);
		if (problems.length > 0) {
			return err(new InvalidArtTemplate(problems));
		}
		this.state = { ...next, version: this.state.version + 1, updatedAt: at };
		return ok(undefined);
	}

	/**
	 * De que destinos este padrão é o padrão. **Não sobe a versão.** "Só um por
	 * destino" é regra da aplicação (09, D10).
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

	/** Tira o padrão da escolha, sem apagar: posts aprovados apontam para ele. */
	archive(at: Date): void {
		this.state = {
			...this.state,
			archived: true,
			defaultFor: [],
			updatedAt: at,
		};
	}
}

export function photoElementOf(design: ArtDesign): PhotoElement | null {
	return (
		design.elements.find(
			(element): element is PhotoElement => element.kind === "PHOTO",
		) ?? null
	);
}

export function textElementsOf(design: ArtDesign): readonly TextElement[] {
	return design.elements.filter(
		(element): element is TextElement => element.kind === "TEXT",
	);
}

export function mediaIdsOf(design: ArtDesign): readonly string[] {
	return [
		...new Set(
			design.elements
				.filter((element): element is ImageElement => element.kind === "IMAGE")
				.map((element) => element.mediaId),
		),
	];
}

/** Cópia profunda e plana: o agregado não guarda a referência de quem chamou. */
function copyDesign(design: ArtDesign): ArtDesign {
	return JSON.parse(JSON.stringify(design)) as ArtDesign;
}

function unique<T>(values: readonly T[]): readonly T[] {
	return [...new Set(values)];
}
