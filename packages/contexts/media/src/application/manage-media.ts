import { type IdGenerator, type Result, err, ok } from "@portal-app/shared-kernel";

import { MediaAsset, type MediaAssetError } from "../domain/media-asset";
import type { MediaType } from "../domain/media-type";
import type { MediaQuery, MediaRepository } from "../domain/ports/media-repository";
import type { MediaStorage } from "../domain/ports/media-storage";

type Deps = {
	repo: MediaRepository;
	storage: MediaStorage;
	ids: IdGenerator;
};

/**
 * Passo 1 do upload direto (A28): gera a `storageKey` e a URL PUT pré-assinada.
 * O cliente sobe o arquivo DIRETO no storage por essa URL — não passa pelo
 * servidor da app. A key nasce da porta de ids (previsível nos testes).
 */
export async function requestUpload(
	input: { filename: string; contentType: string },
	deps: Pick<Deps, "storage" | "ids">,
): Promise<{ key: string; url: string }> {
	const key = buildStorageKey(deps.ids.generate(), input.filename);
	const url = await deps.storage.getUploadUrl(key, input.contentType);
	return { key, url };
}

type RegisterInput = {
	storageKey: string;
	type: MediaType;
	filename: string;
	mimeType: string;
	credit: string;
	caption?: string | null;
	altText?: string | null;
	dimensions?: { width: number; height: number } | null;
	focalPoint?: { x: number; y: number } | null;
};

/**
 * Passo 2: registra o asset depois que o arquivo já subiu. O DOMÍNIO valida os
 * invariantes A29 (crédito; imagem com alt-text e dimensões); metadado ausente
 * é `Result` de erro, não exceção — a tela é só a segunda barreira.
 */
export async function registerAsset(
	input: RegisterInput,
	deps: Pick<Deps, "repo" | "ids">,
): Promise<Result<MediaAsset, MediaAssetError>> {
	const created = MediaAsset.create({ id: deps.ids.generate(), ...input });
	if (created.isErr()) {
		return err(created.error);
	}
	await deps.repo.save(created.value);
	return ok(created.value);
}

export function listLibrary(
	query: MediaQuery,
	deps: Pick<Deps, "repo">,
): Promise<MediaAsset[]> {
	return deps.repo.list(query);
}

export function getAsset(id: string, deps: Pick<Deps, "repo">): Promise<MediaAsset | null> {
	return deps.repo.findById(id);
}

/**
 * `uploads/<id>/<nome-seguro>`: o id (uuid) garante unicidade; o nome original
 * saneado sobrevive só para legibilidade/download. Sem data — determinístico.
 */
function buildStorageKey(id: string, filename: string): string {
	const safe = filename.trim().toLowerCase().replace(/[^a-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "");
	return `uploads/${id}/${safe || "arquivo"}`;
}
