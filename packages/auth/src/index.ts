import { createPrismaClient } from "@portal-app/db";
import { env } from "@portal-app/env/server";
import { provisionStaffForNewUser } from "@portal-app/identity";
import { PrismaStaffRepository } from "@portal-app/identity/infrastructure/prisma-staff-repository";
import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";

export function createAuth() {
	const prisma = createPrismaClient();
	const staffRepo = new PrismaStaffRepository(prisma);

	return betterAuth({
		database: prismaAdapter(prisma, {
			provider: "postgresql",
		}),

		trustedOrigins: [env.CORS_ORIGIN],
		emailAndPassword: {
			enabled: true,
		},
		secret: env.BETTER_AUTH_SECRET,
		baseURL: env.BETTER_AUTH_URL,
		plugins: [nextCookies()],

		// Autenticação é do Better-Auth; identidade/papel é do nosso domínio.
		// Ao criar um usuário, provisionamos o StaffMember correspondente (o
		// primeiro do sistema nasce ADMIN — Decisão D2 da spec da Fase 1).
		databaseHooks: {
			user: {
				create: {
					after: async (user) => {
						await provisionStaffForNewUser(
							{ userId: user.id, email: user.email },
							{ repo: staffRepo },
						);
					},
				},
			},
		},
	});
}

export const auth = createAuth();
