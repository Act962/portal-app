import { err, ok, type Result, ValueObject } from "@portal-app/shared-kernel";

import { InvalidFocalPoint } from "./errors";

/**
 * Ponto focal — a coordenada relativa que deve permanecer visível quando a
 * imagem é cortada para diferentes proporções (capa, thumbnail, destaque).
 * `x`/`y` são frações no quadrado unitário [0,1]×[0,1]: (0,0) é o topo-esquerda,
 * (1,1) o canto inferior-direito. O corte por breakpoint em si é da Fase 4.
 */
export class FocalPoint extends ValueObject<{ x: number; y: number }> {
	private constructor(x: number, y: number) {
		super({ x, y });
	}

	static create(x: number, y: number): Result<FocalPoint, InvalidFocalPoint> {
		if (!inUnitRange(x) || !inUnitRange(y)) {
			return err(new InvalidFocalPoint());
		}
		return ok(new FocalPoint(x, y));
	}

	/** Centro da imagem — padrão sensato quando não há ponto focal escolhido. */
	static center(): FocalPoint {
		return new FocalPoint(0.5, 0.5);
	}

	get x(): number {
		return this.props.x;
	}

	get y(): number {
		return this.props.y;
	}
}

function inUnitRange(n: number): boolean {
	return Number.isFinite(n) && n >= 0 && n <= 1;
}
