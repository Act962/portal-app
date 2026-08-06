import {
	getAsset,
	listLibrary,
	MEDIA_TYPES,
	type MediaAsset,
	registerAsset,
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
	};
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
				})
				.optional(),
		)
		.query(async ({ input }) =>
			(await listLibrary(input ?? {}, mediaDeps)).map(assetDto),
		),

	get: staffProcedure
		.input(z.object({ id: z.string() }))
		.query(async ({ input }) => {
			const asset = await getAsset(input.id, mediaDeps);
			return asset ? assetDto(asset) : null;
		}),
});
