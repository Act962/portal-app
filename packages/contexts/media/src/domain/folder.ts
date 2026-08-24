import { Entity, err, ok, type Result } from "@portal-app/shared-kernel";

import { MissingFolderName } from "./errors";

/**
 * Pasta da biblioteca — uma gaveta com nome, e nada mais (D1).
 *
 * PLANA de propósito: sem `parentId`, sem caminho, sem mover-com-subárvore. O
 * uso real é separar cobertura por assunto ("Eleições 2026", "Institucional"),
 * e uma redação de portal municipal constrói dez gavetas, não hierarquia de três
 * níveis. Aninhar depois é acrescentar um campo, não refazer o modelo.
 *
 * `Entity` e não `AggregateRoot`: a pasta não emite evento nem coordena
 * invariante de outros objetos. Quem vive sob ela é o `MediaAsset`, que é
 * agregado por conta própria — a pasta só o rotula.
 */
export class Folder extends Entity<string> {
	private constructor(
		id: string,
		private folderName: string,
	) {
		super(id);
	}

	static create(input: {
		id: string;
		name: string;
	}): Result<Folder, MissingFolderName> {
		const name = input.name.trim();
		if (!name) {
			return err(new MissingFolderName());
		}
		return ok(new Folder(input.id, name));
	}

	/** Reidrata da persistência. Assume dado válido. */
	static restore(props: { id: string; name: string }): Folder {
		return new Folder(props.id, props.name);
	}

	rename(name: string): Result<void, MissingFolderName> {
		const trimmed = name.trim();
		if (!trimmed) {
			return err(new MissingFolderName());
		}
		this.folderName = trimmed;
		return ok(undefined);
	}

	get name(): string {
		return this.folderName;
	}
}
