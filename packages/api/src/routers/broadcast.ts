import {
	createProgram,
	deleteProgram,
	listPrograms,
	type Program,
	reorderPrograms,
	updateProgram,
} from "@portal-app/broadcast";
import type { Result } from "@portal-app/shared-kernel";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { programDeps } from "../broadcast";
import { publicProcedure, requirePermission, router } from "../index";

/**
 * A leitura é pública: a grade aparece no portal para qualquer leitor, sem
 * sessão. Só as mutações exigem `broadcast:manage` (Admin) — mesmo desenho de
 * `taxonomy.ts`.
 */
const manage = requirePermission("broadcast:manage");

function programDto(program: Program) {
	return {
		id: program.id,
		name: program.name,
		host: program.host,
		dayOfWeek: program.dayOfWeek,
		startTime: program.startTime,
		endTime: program.endTime,
		order: program.order,
	};
}

function codeFor(error: Error): TRPCError["code"] {
	return error.name === "ProgramNotFound" ? "NOT_FOUND" : "BAD_REQUEST";
}

function ensure<T>(result: Result<T, Error>): T {
	if (result.isErr()) {
		const error = result.unwrapErr();
		throw new TRPCError({ code: codeFor(error), message: error.message });
	}
	return result.unwrap();
}

export const broadcastRouter = router({
	list: publicProcedure.query(async () =>
		(await listPrograms(programDeps)).map(programDto),
	),

	create: manage
		.input(
			z.object({
				name: z.string(),
				host: z.string(),
				dayOfWeek: z.number().int().min(0).max(6),
				startTime: z.string(),
				endTime: z.string(),
			}),
		)
		.mutation(async ({ input }) =>
			programDto(ensure(await createProgram(input, programDeps))),
		),

	update: manage
		.input(
			z.object({
				id: z.string(),
				name: z.string().optional(),
				host: z.string().optional(),
				dayOfWeek: z.number().int().min(0).max(6).optional(),
				startTime: z.string().optional(),
				endTime: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) =>
			programDto(ensure(await updateProgram(input, programDeps))),
		),

	reorder: manage
		.input(
			z.object({
				orders: z.array(z.object({ id: z.string(), order: z.number().int() })),
			}),
		)
		.mutation(async ({ input }) => {
			ensure(await reorderPrograms(input, programDeps));
			return { ok: true };
		}),

	delete: manage
		.input(z.object({ id: z.string() }))
		.mutation(async ({ input }) => {
			ensure(await deleteProgram(input, programDeps));
			return { ok: true };
		}),
});
