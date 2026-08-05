import { type Result, ValueObject, err, ok } from "@portal-app/shared-kernel";

import { InvalidDimensions } from "./errors";

/**
 * Dimensões do arquivo em pixels. Guardadas na criação (o cliente as mede antes
 * do upload) para o corte responsivo e para reservar espaço contra CLS na
 * renderização (Fase 4). Largura e altura são inteiros positivos.
 */
export class Dimensions extends ValueObject<{ width: number; height: number }> {
	private constructor(width: number, height: number) {
		super({ width, height });
	}

	static create(width: number, height: number): Result<Dimensions, InvalidDimensions> {
		if (!isPositiveInt(width) || !isPositiveInt(height)) {
			return err(new InvalidDimensions());
		}
		return ok(new Dimensions(width, height));
	}

	get width(): number {
		return this.props.width;
	}

	get height(): number {
		return this.props.height;
	}

	/** Razão de aspecto (largura/altura) — usada no corte responsivo. */
	get aspectRatio(): number {
		return this.props.width / this.props.height;
	}
}

function isPositiveInt(n: number): boolean {
	return Number.isInteger(n) && n > 0;
}
