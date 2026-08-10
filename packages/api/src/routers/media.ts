import { DEFAULT_PAGE_SIZE, toPageRequest } from "@portal-app/shared-kernel";
import {
	createFolder,
	deleteAsset,
	deleteAssets,
	deleteFolder,
	getAsset,
	listFoldersWithCount,
	listLibrary,
	MEDIA_TYPES,
	type MediaAsset,
	mediaTypeFromMime,
	moveAssets,
	registerAsset,
	renameFolder,
	requestUpload,
} from "@portal-app/media";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { router, staffProcedure } from "../index";
import { mediaDeps, mediaStorage } from "../media";

/**
 * Gerir mídia exige apenas um staff ativo (`staffProcedure`) — redator sobe
 * imagem para a própria matéria. A política fina (quem pode subir o quê) evolui
 * com `ctx.can(...)` quando o Editorial existir.
 */
function assetDto(asset: MediaAsset) {
	return {
		id: asset.id,
		type: asset.type,
		storageKey: asset.storageKey,
		url: mediaStorage.publicUrl(asset.storageKey),
		filename: asset.filename,
		mimeType: asset.mimeType,
		caption: asset.caption.value,
		credit: asset.credit.value,
		altText: asset.altText?.value ?? null,
		width: asset.dimensions?.width ?? null,
		height: asset.dimensions?.height ?? null,
		focalPoint: asset.focalPoint
			? { x: asset.focalPoint.x, y: asset.focalPoint.y }
			: null,
		folderId: asset.folderId,
	};
}

/** Erro de domínio vira código HTTP; a mensagem já vem em pt-BR do domínio. */
function fail(error: Error): never {
	const code =
		error.name === "FolderNotFound" || error.name === "MediaAssetNotFound"
			? "NOT_FOUND"
			: "BAD_REQUEST";
	throw new TRPCError({ code, message: error.message });
}

export const mediaRouter = router({
	/** Passo 1 do upload: devolve a URL PUT pré-assinada e a storageKey. */
	requestUpload: staffProcedure
		.input(
			z.object({ filename: z.string().min(1), contentType: z.string().min(1) }),
		)
		.mutation(({ input }) => requestUpload(input, mediaDeps)),

	/** Passo 2: registra o asset (o domínio valida os invariantes A29). */
	register: staffProcedure
		.input(
			z.object({
				storageKey: z.string().min(1),
				type: z.enum(MEDIA_TYPES),
				filename: z.string().min(1),
				mimeType: z.string().min(1),
				credit: z.string(),
				caption: z.string().nullish(),
				altText: z.string().nullish(),
				dimensions: z
					.object({ width: z.number().int(), height: z.number().int() })
					.nullish(),
				focalPoint: z.object({ x: z.number(), y: z.number() }).nullish(),
			}),
		)
		.mutation(async ({ input }) => {
			const result = await registerAsset(input, mediaDeps);
			if (result.isErr()) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: result.unwrapErr().message,
				});
			}
			return assetDto(result.unwrap());
		}),

	/** Biblioteca: busca textual + filtro por tipo, do mais recente ao mais antigo. */
	library: staffProcedure
		.input(
			z
				.object({
					search: z.string().optional(),
					type: z.enum(MEDIA_TYPES).optional(),
					ids: z.array(z.string()).optional(),
					// `undefined` = todas; `null` = só o que está fora de pasta (D2).
					folderId: z.string().nullish(),
					page: z.number().int().optional(),
					perPage: z.number().int().optional(),
				})
				.optional(),
		)
		.query(async ({ input }) => {
			const { page, perPage, ...query } = input ?? {};
			const result = await listLibrary(
				query,
				mediaDeps,
				toPageRequest({ page, perPage }),
			);
			return {
				items: result.items.map(assetDto),
				total: result.total,
				page: page ?? 1,
				perPage: perPage ?? DEFAULT_PAGE_SIZE,
			};
		}),

	get: staffProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input }) => {
			const asset = await getAsset(input.id, mediaDeps);
			return asset ? assetDto(asset) : null;
		}),

	/**
	 * Classifica o arquivo pelo mime ANTES do upload, para a tela recusar cedo
	 * em vez de deixar o usuário esperar o envio e só então tomar o erro. O
	 * domínio revalida no `register` — esta é a primeira barreira, não a única.
	 */
	classify: staffProcedure
		.input(z.object({ mimeType: z.string() }))
		.query(({ input }) => {
			const type = mediaTypeFromMime(input.mimeType);
			return type.isErr()
				? { accepted: false as const, message: type.error.message }
				: { accepted: true as const, type: type.unwrap() };
		}),

	folders: router({
		list: staffProcedure.query(() => listFoldersWithCount(mediaDeps)),

		create: staffProcedure
			.input(z.object({ name: z.string() }))
			.mutation(async ({ input }) => {
				const result = await createFolder(input, mediaDeps);
				if (result.isErr()) {
					fail(result.error);
				}
				const folder = result.unwrap();
				return { id: folder.id, name: folder.name };
			}),

		rename: staffProcedure
			.input(z.object({ id: z.string(), name: z.string() }))
			.mutation(async ({ input }) => {
				const result = await renameFolder(input, mediaDeps);
				if (result.isErr()) {
					fail(result.error);
				}
				const folder = result.unwrap();
				return { id: folder.id, name: folder.name };
			}),

		remove: staffProcedure
			.input(z.object({ id: z.string() }))
			.mutation(async ({ input }) => {
				const result = await deleteFolder(input, mediaDeps);
				if (result.isErr()) {
					fail(result.error);
				}
				return { ok: true };
			}),
	}),

	remove: staffProcedure
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			const result = await deleteAsset(input, mediaDeps);
			if (result.isErr()) {
				fail(result.error);
			}
			return { ok: true };
		}),

	/** Ações em lote. Devolvem o relatório item a item (D7) — não estouram no
	 * primeiro erro, porque isso obrigaria o editor a descobrir por tentativa e
	 * erro qual arquivo trava a operação. */
	removeMany: staffProcedure
		.input(z.object({ ids: z.array(z.string()).min(1) }))
		.mutation(({ input }) => deleteAssets(input, mediaDeps)),

	moveMany: staffProcedure
		.input(
			z.object({
				ids: z.array(z.string()).min(1),
				folderId: z.string().nullable(),
			}),
		)
		.mutation(({ input }) => moveAssets(input, mediaDeps)),
});
