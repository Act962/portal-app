import {
	type ArtContent,
	type ArtDesign,
	type ArtElement,
	DEFAULT_TEXT_STYLE,
	type ElementBase,
	type ImageElement,
	type PhotoElement,
	type RectElement,
	type TemplateVariable,
	type TextElement,
} from "@portal-app/social";

/** Peças de desenho para os testes (spec 10). Só o que o teste muda é passado. */

export function base(
	id: string,
	extra: Partial<ElementBase> = {},
): ElementBase {
	return {
		id,
		name: "",
		x: 130,
		y: 560,
		width: 820,
		height: 240,
		rotation: 0,
		opacity: 1,
		visible: true,
		locked: false,
		...extra,
	};
}

export function texto(
	id: string,
	content = "{{titulo}}",
	extra: Partial<Omit<TextElement, "kind">> = {},
): TextElement {
	return {
		...base(id),
		kind: "TEXT",
		mode: "DYNAMIC",
		content,
		fieldLabel: "",
		style: { ...DEFAULT_TEXT_STYLE },
		...extra,
	};
}

/** O título que a redação pode trocar no post. */
export function tituloEditavel(id = "titulo"): TextElement {
	return texto(id, "{{titulo}}", {
		mode: "EDITABLE",
		fieldLabel: "Título na arte",
	});
}

export function foto(id = "foto"): PhotoElement {
	return {
		...base(id, { x: 0, y: 0, width: 1080, height: 1350 }),
		kind: "PHOTO",
		cornerRadius: 0,
		stroke: null,
	};
}

export function moldura(
	id = "moldura",
	mediaId = "media-moldura",
): ImageElement {
	return {
		...base(id, { x: 0, y: 0, width: 1080, height: 1350 }),
		kind: "IMAGE",
		mediaId,
		fit: "cover",
		cornerRadius: 0,
	};
}

export function cartao(id = "cartao"): RectElement {
	return {
		...base(id, { x: 80, y: 430, width: 920, height: 520 }),
		kind: "RECT",
		fill: { type: "solid", color: "#d9232e" },
		cornerRadius: 48,
		stroke: null,
		shadow: null,
	};
}

export function variavel(
	key: string,
	defaultValue = "",
	extra: Partial<TemplateVariable> = {},
): TemplateVariable {
	return {
		key,
		label: `Campo ${key}`,
		defaultValue,
		multiline: false,
		...extra,
	};
}

export function design(
	elements: readonly ArtElement[] = [],
	variables: readonly TemplateVariable[] = [],
): ArtDesign {
	return { background: "#ffffff", elements, variables };
}

export const CONTEUDO: ArtContent = {
	headline: "Chuva alaga o centro",
	subtitle: "Defesa Civil monitora três bairros",
	kicker: "Últimas",
	sectionName: "Cidades",
	authorName: "Redação",
	siteName: "Portal 7 Cidades",
	date: "2026-09-14T15:00:00.000Z",
};
