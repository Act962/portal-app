import { createPrismaClient } from "@portal-app/db";
import { env } from "@portal-app/env/server";
import { assertCanSignUp } from "@portal-app/identity";
import { createMailer } from "@portal-app/identity/infrastructure/create-mailer";
import { PrismaInvitationRepository } from "@portal-app/identity/infrastructure/prisma-invitation-repository";
import { PrismaStaffRepository } from "@portal-app/identity/infrastructure/prisma-staff-repository";
import { SystemClock } from "@portal-app/shared-kernel";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { APIError } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";

import { recordResetLink } from "./reset-link-capture";

export function createAuth() {
	const prisma = createPrismaClient();

	const gate = {
		invitations: new PrismaInvitationRepository(prisma),
		staff: new PrismaStaffRepository(prisma),
		clock: new SystemClock(),
	};

	const mailer = createMailer({
		apiKey: env.RESEND_API_KEY,
		from: env.MAIL_FROM,
	});

	return betterAuth({
		database: prismaAdapter(prisma, {
			provider: "postgresql",
		}),

		trustedOrigins: [env.CORS_ORIGIN],
		emailAndPassword: {
			enabled: true,
			/**
			 * B5 (recuperação de senha). O link sempre é capturado (para o fluxo em
			 * que o ADMIN mesmo entrega) e, se houver `RESEND_API_KEY`, também vai
			 * por e-mail direto para a pessoa — as duas coisas não se excluem.
			 */
			sendResetPassword: async ({ user, url }) => {
				recordResetLink(url);
				await mailer.send({
					to: user.email,
					subject: "Redefinir sua senha",
					text: `Clique no link para escolher uma nova senha: ${url}\n\nSe você não pediu isto, ignore este e-mail.`,
				});
			},
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		plugins: [nextCookies()],

		/**
		 * O PORTÃO do cadastro (spec 05, D2).
		 *
		 * Fica aqui, e não no `resolveStaff`, porque este gancho vale para
		 * QUALQUER caminho que crie usuário — a rota do Better Auth, um plugin
		 * futuro, um provedor social. Guardar só na resolução do membro deixaria
		 * a conta nascer e barraria depois: o e-mail já estaria tomado, e o
		 * cadastro pareceria ter funcionado.
		 *
		 * Lançar `APIError` aborta a criação; é o mecanismo documentado do Better
		 * Auth para desabilitar cadastro condicionalmente.
		 */
		databaseHooks: {
			user: {
				create: {
					before: async (user) => {
						const allowed = await assertCanSignUp(user.email, gate);
						if (allowed.isErr()) {
							throw new APIError("BAD_REQUEST", {
								message: allowed.unwrapErr().message,
							});
						}
					},
				},
			},
		},
	});
}

export const auth = createAuth();
