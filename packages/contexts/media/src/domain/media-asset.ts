import { AggregateRoot, type Result, err, ok } from "@portal-app/shared-kernel";

import { AltText } from "./alt-text";
import { Caption } from "./caption";
import { Credit } from "./credit";
import { Dimensions } from "./dimensions";
import type { InvalidDimensions, InvalidFocalPoint, MissingCredit } from "./errors";
import { MissingAltText, MissingDimensions } from "./errors";
import { FocalPoint } from "./focal-point";
import type { MediaType } from "./media-type";

type MediaAssetState = {
	type: MediaType;
	storageKey: string;
	filename: string;
	mimeType: string;
	dimensions: Dimensions | null;
	caption: Caption;
	credit: Credit;
	altText: AltText | null;
	focalPoint: FocalPoint | null;
	/** Pasta onde o arquivo está. `null` é estado VÁLIDO — "sem pasta" (D2). */
	folderId: string | null;
};

type CreateInput = {
	id: string;
	type: MediaType;
	storageKey: string;
	filename: string;
	mimeType: string;
	credit: string;
	caption?: string | null;
	altText?: string | null;
	dimensions?: { width: number; height: number } | null;
	focalPoint?: { x: number; y: number } | null;
	folderId?: string | null;
};

export type MediaAssetError =
	| MissingCredit
	| MissingAltText
	| MissingDimensions
	| InvalidDimensions
	| InvalidFocalPoint;

/**
 * MediaAsset — o agregado raiz da biblioteca de mídia. O arquivo em si mora no
 * armazenamento (R2/MinIO), referenciado por `storageKey`; este agregado guarda
 * os METADADOS e os invariantes de acessibilidade/autoria (A29):
 *
 * - todo asset tem crédito;
 * - imagem exige alt-text E dimensões — a acessibilidade é regra do domínio, não
 *   validação de tela; uma imagem sem esses dados nem chega a existir.
 *
 * Metadado ausente é `Result<_, Missing…>`, erro de domínio, não exceção.
 */
export class MediaAsset extends AggregateRoot<string> {
	private state: MediaAssetState;

	private constructor(id: string, state: MediaAssetState) {
		super(id);
		this.state = state;
	}

	static create(input: CreateInput): Result<MediaAsset, MediaAssetError> {
		const credit = Credit.create(input.credit);
		if (credit.isErr()) {
			return err(credit.error);
		}

		let dimensions: Dimensions | null = null;
		if (input.dimensions) {
			const dim = Dimensions.create(input.dimensions.width, input.dimensions.height);
			if (dim.isErr()) {
				return err(dim.error);
			}
			dimensions = dim.value;
		}

		let focalPoint: FocalPoint | null = null;
		if (input.focalPoint) {
			const fp = FocalPoint.create(input.focalPoint.x, input.focalPoint.y);
			if (fp.isErr()) {
				return err(fp.error);
			}
			focalPoint = fp.value;
		}

		// Alt-text em branco conta como ausente (opcional para não-imagem); só vira
		// VO quando há texto de fato.
		let altText: AltText | null = null;
		if ((input.altText ?? "").trim() !== "") {
			const alt = AltText.create(input.altText as string);
			/* v8 ignore next 3 -- texto já não-vazio aqui; guarda por completude de tipo */
			if (alt.isErr()) {
				return err(alt.error);
			}
			altText = alt.value;
		}

		// Invariante A29 para imagens: alt-text e dimensões obrigatórios.
		if (input.type === "IMAGE") {
			if (altText === null) {
				return err(new MissingAltText());
			}
			if (dimensions === null) {
				return err(new MissingDimensions());
			}
		}

		return ok(
			new MediaAsset(input.id, {
				type: input.type,
				storageKey: input.storageKey,
				filename: input.filename,
				mimeType: input.mimeType,
				dimensions,
				caption: Caption.create(input.caption),
				credit: credit.value,
				altText,
				focalPoint,
				folderId: input.folderId ?? null,
			}),
		);
	}

	/** Reidrata da persistência. Assume dados válidos; estoura se não forem. */
	static restore(props: CreateInput): MediaAsset {
		const result = MediaAsset.create(props);
		if (result.isErr()) {
			throw result.error;
		}
		return result.value;
	}

	get type(): MediaType {
		return this.state.type;
	}

	get storageKey(): string {
		return this.state.storageKey;
	}

	get filename(): string {
		return this.state.filename;
	}

	get mimeType(): string {
		return this.state.mimeType;
	}

	get dimensions(): Dimensions | null {
		return this.state.dimensions;
	}

	get caption(): Caption {
		return this.state.caption;
	}

	get credit(): Credit {
		return this.state.credit;
	}

	get altText(): AltText | null {
		return this.state.altText;
	}

	get focalPoint(): FocalPoint | null {
		return this.state.focalPoint;
	}

	get folderId(): string | null {
		return this.state.folderId;
	}

	/**
	 * Move para uma pasta, ou para fora de todas (`null`).
	 *
	 * Não devolve `Result`: mover não tem como falhar no domínio. Se a pasta
	 * existe é pergunta de PERSISTÊNCIA — quem responde é a aplicação, que tem o
	 * repositório à mão; o agregado não sai consultando banco para se validar.
	 */
	moveTo(folderId: string | null): void {
		this.state = { ...this.state, folderId };
	}

	isImage(): boolean {
		return this.state.type === "IMAGE";
	}
}
