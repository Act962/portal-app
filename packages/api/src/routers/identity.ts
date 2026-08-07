import { auth } from "@portal-app/auth";
import { captureResetLink } from "@portal-app/auth/reset-link-capture";
import { env } from "@portal-app/env/server";
import {
	AuthorProfile,
	activateStaff,
	bindStaffSections,
	changeStaffRole,
	deactivateStaff,
	type Forbidden,
	inviteMember,
	listInvitations,
	listStaff,
	ROLES,
	revokeInvitation,
	type StaffMember,
	StaffNotFound,
	updateAuthorProfile,
} from "@portal-app/identity";
import type { Result } from "@portal-app/shared-kernel";
import { UuidGenerator } from "@portal-app/shared-kernel";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import {
	publicProcedure,
	requirePermission,
	router,
	staffProcedure,
} from "../index";
import { invitationDeps, staffRepo } from "../staff";

const inviteDeps = { ...invitationDeps, ids: new UuidGenerator() };

function toDto(staff: StaffMember) {
	return {
		id: staff.id,
		email: staff.email,
		role: staff.role,
		active: staff.isActive(),
		sectionIds: [...staff.sectionIds],
		authorProfile: {
			bio: staff.authorProfile.bio,
			title: staff.authorProfile.title,
			photoUrl: staff.authorProfile.photoUrl,
			socials: staff.authorProfile.socials,
		},
	};
}

function unwrap(result: Result<StaffMember, Forbidden | StaffNotFound>) {
	if (result.isErr()) {
		const error = result.unwrapErr();
		throw new TRPCError({
			code: error instanceof StaffNotFound ? "NOT_FOUND" : "FORBIDDEN",
			message: error.message,
		});
	}
	return toDto(result.unwrap());
}

const manage = requirePermission("user:manage");

export const identityRouter = router({
	/** O membro por trás da sessão atual — papel, editorias e perfil. */
	me: staffProcedure.query(({ ctx }) => toDto(ctx.staff)),

	/**
	 * Público (a tela de login não tem sessão) — diz ao painel se vale a pena
	 * oferecer a redefinição de senha por conta própria. Sem Mailer, o Better
	 * Auth mandaria uma mensagem genérica sem entregar nada de verdade; melhor
	 * a tela já orientar a falar com um admin do que fingir que enviou.
	 */
	capabilities: router({
		mailerEnabled: publicProcedure.query(() => Boolean(env.RESEND_API_KEY)),
	}),

	users: router({
		list: manage.query(async ({ ctx }) => {
			const result = await listStaff(ctx.staff, { repo: staffRepo });
			if (result.isErr()) {
				throw new TRPCError({ code: "FORBIDDEN" });
			}
			return result.unwrap().map(toDto);
		}),

		setRole: manage
			.input(z.object({ staffId: z.string(), role: z.enum(ROLES) }))
			.mutation(async ({ ctx, input }) =>
				unwrap(await changeStaffRole(ctx.staff, input, { repo: staffRepo })),
			),

		setSections: manage
			.input(z.object({ staffId: z.string(), sectionIds: z.array(z.string()) }))
			.mutation(async ({ ctx, input }) =>
				unwrap(await bindStaffSections(ctx.staff, input, { repo: staffRepo })),
			),

		deactivate: manage
			.input(z.object({ staffId: z.string() }))
			.mutation(async ({ ctx, input }) =>
				unwrap(await deactivateStaff(ctx.staff, input, { repo: staffRepo })),
			),

		activate: manage
			.input(z.object({ staffId: z.string() }))
			.mutation(async ({ ctx, input }) =>
				unwrap(await activateStaff(ctx.staff, input, { repo: staffRepo })),
			),

		/**
		 * B5 — o admin gera o link de redefinição e entrega manualmente (mesma
		 * filosofia "avise você mesmo" do convite, enquanto não há Mailer). A
		 * mensagem do Better-Auth é sempre genérica ("se o e-mail existir..."),
		 * então o link só existe se `captureResetLink` conseguiu pegá-lo — o que
		 * só acontece quando o e-mail é de fato de um usuário existente.
		 */
		resetPassword: manage
			.input(z.object({ staffId: z.string() }))
			.mutation(async ({ input }) => {
				const staff = await staffRepo.findById(input.staffId);
				if (!staff) {
					throw new TRPCError({ code: "NOT_FOUND" });
				}
				const { url } = await captureResetLink(() =>
					auth.api.requestPasswordReset({
						body: {
							email: staff.email,
							redirectTo: `${env.BETTER_AUTH_URL}/reset-password`,
						},
					}),
				);
				if (!url) {
					throw new TRPCError({
						code: "NOT_FOUND",
						message:
							"Não existe conta de login para este e-mail (talvez o convite ainda não foi aceito).",
					});
				}
				return { url };
			}),
	}),

	/**
	 * Convites (spec 05, D2 — emendada: o portão é o e-mail, sem token).
	 *
	 * Convidar é `user:manage` (ADMIN): quem entra na redação e com qual papel é
	 * decisão de quem administra a equipe.
	 */
	invitations: router({
		list: manage.query(async () =>
			(await listInvitations(inviteDeps)).map((invitation) => ({
				id: invitation.id,
				email: invitation.email,
				role: invitation.role,
				sectionIds: [...invitation.sectionIds],
				expiresAt: invitation.expiresAt,
				acceptedAt: invitation.acceptedAt,
				open: invitation.isOpen(new Date()),
			})),
		),

		create: manage
			.input(
				z.object({
					email: z.string(),
					role: z.enum(ROLES),
					sectionIds: z.array(z.string()).optional(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const result = await inviteMember(input, ctx.staff.id, inviteDeps);
				if (result.isErr()) {
					throw new TRPCError({
						code: "BAD_REQUEST",
						message: result.unwrapErr().message,
					});
				}
				const invitation = result.unwrap();
				return {
					id: invitation.id,
					email: invitation.email,
					role: invitation.role,
					expiresAt: invitation.expiresAt,
				};
			}),

		revoke: manage
			.input(z.object({ id: z.string() }))
			.mutation(async ({ input }) => {
				await revokeInvitation(input.id, inviteDeps);
				return { ok: true };
			}),
	}),

	profile: router({
		/** O próprio membro edita seu perfil; um admin edita o de qualquer um. */
		update: staffProcedure
			.input(
				z.object({
					staffId: z.string().optional(),
					bio: z.string().optional(),
					title: z.string().optional(),
					photoUrl: z.string().optional(),
					socials: z.record(z.string(), z.string()).optional(),
				}),
			)
			.mutation(async ({ ctx, input }) => {
				const staffId = input.staffId ?? ctx.staff.id;
				const profile = AuthorProfile.create({
					bio: input.bio,
					title: input.title,
					photoUrl: input.photoUrl,
					socials: input.socials,
				});
				return unwrap(
					await updateAuthorProfile(
						ctx.staff,
						{ staffId, profile },
						{ repo: staffRepo },
					),
				);
			}),
	}),
});
