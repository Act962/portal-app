import { execSync } from "node:child_process";

import {
	PostgreSqlContainer,
	type StartedPostgreSqlContainer,
} from "@testcontainers/postgresql";
import type { GlobalSetupContext } from "vitest/node";

let container: StartedPostgreSqlContainer | undefined;

/**
 * Sobe um Postgres real (a mesma major `postgres:17` de dev/produção) e aplica
 * as migrações versionadas de produção nele, uma vez, antes da suíte. A URL do
 * container é entregue aos testes via `provide`.
 *
 * A imagem vem do espelho oficial no ECR público, e não do Docker Hub: é a
 * MESMA `postgres:17`, mas o Hub limita o `pull` anônimo por IP, os runners do
 * GitHub dividem IP, e a suíte caía com "toomanyrequests" sem rodar um teste.
 */
export async function setup({ provide }: GlobalSetupContext): Promise<void> {
	container = await new PostgreSqlContainer(
		"public.ecr.aws/docker/library/postgres:17",
	).start();
	const databaseUrl = container.getConnectionUri();

	// As MESMAS migrações de produção, num banco limpo. Montar o schema à mão
	// aqui esconderia erro de migração — que é o que o T05 existe para pegar.
	execSync("pnpm --filter @portal-app/db exec prisma migrate deploy", {
		env: { ...process.env, DATABASE_URL: databaseUrl },
		stdio: "inherit",
	});

	provide("databaseUrl", databaseUrl);
}

export async function teardown(): Promise<void> {
	await container?.stop();
}

declare module "vitest" {
	interface ProvidedContext {
		databaseUrl: string;
	}
}
