import type { Page, PageRequest } from "@portal-app/shared-kernel";
import {
	err,
	type IdGenerator,
	ok,
	type Result,
} from "@portal-app/shared-kernel";

import {
	FolderNameTaken,
	FolderNotEmpty,
	FolderNotFound,
	MediaAssetNotFound,
	MediaInUse,
	type MissingFolderName,
} from "../domain/errors";
import { Folder } from "../domain/folder";
import { MediaAsset, type MediaAssetError } from "../domain/media-asset";
import type { MediaType } from "../domain/media-type";
import type { FolderRepository } from "../domain/ports/folder-repository";
import type {
	MediaQuery,
	MediaRepository,
} from "../domain/ports/media-repository";
import type { MediaStorage } from "../domain/ports/media-storage";
import type { MediaUsage } from "../domain/ports/media-usage";

type Deps = {
	repo: MediaRepository;
	folders: FolderRepository;
	storage: MediaStorage;
	usage: MediaUsage;
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
	folderId?: string | null;
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

export async function listLibrary(
	query: MediaQuery,
	deps: Pick<Deps, "repo">,
	page?: PageRequest,
): Promise<Page<MediaAsset>> {
	const [items, total] = await Promise.all([
		deps.repo.list(query, page),
		deps.repo.count(query),
	]);
	return { items, total };
}

export function getAsset(
	id: string,
	deps: Pick<Deps, "repo">,
): Promise<MediaAsset | null> {
	return deps.repo.findById(id);
}

type UpdateDetailsInput = {
	id: string;
	credit?: string;
	caption?: string | null;
	altText?: string | null;
	focalPoint?: { x: number; y: number } | null;
};

/**
 * Corrige os metadados de um arquivo já cadastrado.
 *
 * Não toca no armazenamento: o objeto lá continua o mesmo byte, e é só o
 * registro que muda. Por isso não há aqui nada da dança de ordem que a exclusão
 * exige (D5) — não há duas coisas para sair de sincronia.
 *
 * A validação é toda do agregado, inclusive a recusa de deixar uma IMAGEM sem
 * alt-text. É o mesmo invariante do cadastro, e ele precisa valer nos dois
 * caminhos: senão a edição vira o furo por onde a regra escapa.
 */
export async function updateAssetDetails(
	input: UpdateDetailsInput,
	deps: Pick<Deps, "repo">,
): Promise<Result<MediaAsset, MediaAssetNotFound | MediaAssetError>> {
	const { id, ...details } = input;
	const asset = await deps.repo.findById(id);
	if (!asset) {
		return err(new MediaAssetNotFound(id));
	}
	const updated = asset.updateDetails(details);
	if (updated.isErr()) {
		return err(updated.error);
	}
	await deps.repo.save(asset);
	return ok(asset);
}

/**
 * `uploads/<id>/<nome-seguro>`: o id (uuid) garante unicidade; o nome original
 * saneado sobrevive só para legibilidade/download. Sem data — determinístico.
 */
function buildStorageKey(id: string, filename: string): string {
	const safe = filename
		.trim()
		.toLowerCase()
		.replace(/[^a-z0-9._-]+/g, "-")
		.replace(/^-+|-+$/g, "");
	return `uploads/${id}/${safe || "arquivo"}`;
}

// ---------------------------------------------------------------------------
// Pastas (spec 06)
// ---------------------------------------------------------------------------

export async function createFolder(
	input: { name: string },
	deps: Pick<Deps, "folders" | "ids">,
): Promise<Result<Folder, MissingFolderName | FolderNameTaken>> {
	const folder = Folder.create({ id: deps.ids.generate(), name: input.name });
	if (folder.isErr()) {
		return err(folder.error);
	}
	// Checagem ANTES de gravar. O índice único do banco é a rede de segurança
	// para a corrida entre dois cliques simultâneos; aqui é para a mensagem sair
	// em pt-BR em vez de um erro de constraint.
	const taken = await deps.folders.findByName(folder.value.name);
	if (taken) {
		return err(new FolderNameTaken(folder.value.name));
	}
	await deps.folders.save(folder.value);
	return ok(folder.value);
}

export async function renameFolder(
	input: { id: string; name: string },
	deps: Pick<Deps, "folders">,
): Promise<
	Result<Folder, FolderNotFound | MissingFolderName | FolderNameTaken>
> {
	const folder = await deps.folders.findById(input.id);
	if (!folder) {
		return err(new FolderNotFound(input.id));
	}
	const renamed = folder.rename(input.name);
	if (renamed.isErr()) {
		return err(renamed.error);
	}
	const taken = await deps.folders.findByName(folder.name);
	// Renomear para o PRÓPRIO nome (só mudando a caixa) não é conflito.
	if (taken && taken.id !== folder.id) {
		return err(new FolderNameTaken(folder.name));
	}
	await deps.folders.save(folder);
	return ok(folder);
}

/**
 * Exclui a pasta — só se estiver VAZIA (D3).
 *
 * Apagar uma pasta cheia ou levaria os arquivos junto (destrutivo e
 * surpreendente) ou os deixaria órfãos num limbo invisível. Recusar e dizer
 * quantos são deixa a saída óbvia: mover, depois apagar.
 */
export async function deleteFolder(
	input: { id: string },
	deps: Pick<Deps, "folders">,
): Promise<Result<void, FolderNotFound | FolderNotEmpty>> {
	const folder = await deps.folders.findById(input.id);
	if (!folder) {
		return err(new FolderNotFound(input.id));
	}
	const count = await deps.folders.countAssets(input.id);
	if (count > 0) {
		return err(new FolderNotEmpty(count));
	}
	await deps.folders.delete(input.id);
	return ok(undefined);
}

export function listFolders(deps: Pick<Deps, "folders">): Promise<Folder[]> {
	return deps.folders.list();
}

/**
 * As pastas com QUANTOS arquivos cada uma tem.
 *
 * A contagem não é enfeite: é ela que torna previsível a recusa de excluir
 * pasta cheia (D3). Sem o número na tela, o editor clica em excluir e só então
 * descobre que há 12 arquivos lá dentro.
 *
 * Uma consulta por pasta. São dez gavetas, não dez mil (D1) — trocar por um
 * `groupBy` seria otimizar o que não dói.
 */
export async function listFoldersWithCount(
	deps: Pick<Deps, "folders">,
): Promise<Array<{ id: string; name: string; assetCount: number }>> {
	const folders = await deps.folders.list();
	return Promise.all(
		folders.map(async (folder) => ({
			id: folder.id,
			name: folder.name,
			assetCount: await deps.folders.countAssets(folder.id),
		})),
	);
}

// ---------------------------------------------------------------------------
// Exclusão e movimentação (spec 06)
// ---------------------------------------------------------------------------

/**
 * Exclui um arquivo — se nenhuma matéria o usar (D4).
 *
 * A ordem importa (D5): valida o uso, apaga a LINHA, e só então tenta apagar o
 * objeto no storage. Se o storage falhar, a operação NÃO é revertida — um
 * objeto órfão no bucket custa centavos e é invisível, enquanto uma linha
 * apontando para arquivo inexistente deixa a biblioteca mostrando um item
 * quebrado e insistindo que ele existe.
 */
export async function deleteAsset(
	input: { id: string },
	deps: Pick<Deps, "repo" | "storage" | "usage">,
): Promise<Result<void, MediaAssetNotFound | MediaInUse>> {
	const asset = await deps.repo.findById(input.id);
	if (!asset) {
		return err(new MediaAssetNotFound(input.id));
	}
	if (await deps.usage.isMediaInUse(input.id)) {
		return err(new MediaInUse());
	}

	await deps.repo.delete(input.id);
	try {
		await deps.storage.delete(asset.storageKey);
	} catch {
		// Silêncio deliberado: ver D5. A linha já se foi, e é ela que a
		// biblioteca lê.
	}
	return ok(undefined);
}

export async function moveAsset(
	input: { id: string; folderId: string | null },
	deps: Pick<Deps, "repo" | "folders">,
): Promise<Result<void, MediaAssetNotFound | FolderNotFound>> {
	const asset = await deps.repo.findById(input.id);
	if (!asset) {
		return err(new MediaAssetNotFound(input.id));
	}
	if (input.folderId !== null) {
		const folder = await deps.folders.findById(input.folderId);
		if (!folder) {
			return err(new FolderNotFound(input.folderId));
		}
	}
	asset.moveTo(input.folderId);
	await deps.repo.save(asset);
	return ok(undefined);
}

/** O que aconteceu com CADA item de uma ação em lote. */
export type BulkOutcome = {
	ok: string[];
	failed: Array<{ id: string; reason: string }>;
};

/**
 * Exclui vários — sem transação, relatando item a item (D7).
 *
 * Abortar tudo no primeiro erro obrigaria o editor a descobrir por tentativa e
 * erro qual arquivo trava a operação, refazendo a seleção a cada rodada. O
 * relatório resolve numa passada: "3 excluídos, 3 não: em uso por matéria".
 *
 * SEQUENCIAL de propósito: são exclusões, e disparar N em paralelo contra o
 * mesmo storage troca um relatório legível por uma rajada difícil de auditar.
 */
export async function deleteAssets(
	input: { ids: readonly string[] },
	deps: Pick<Deps, "repo" | "storage" | "usage">,
): Promise<BulkOutcome> {
	const outcome: BulkOutcome = { ok: [], failed: [] };
	for (const id of input.ids) {
		const result = await deleteAsset({ id }, deps);
		if (result.isErr()) {
			outcome.failed.push({ id, reason: result.error.message });
		} else {
			outcome.ok.push(id);
		}
	}
	return outcome;
}

export async function moveAssets(
	input: { ids: readonly string[]; folderId: string | null },
	deps: Pick<Deps, "repo" | "folders">,
): Promise<BulkOutcome> {
	const outcome: BulkOutcome = { ok: [], failed: [] };
	for (const id of input.ids) {
		const result = await moveAsset({ id, folderId: input.folderId }, deps);
		if (result.isErr()) {
			outcome.failed.push({ id, reason: result.error.message });
		} else {
			outcome.ok.push(id);
		}
	}
	return outcome;
}
