import "dotenv/config";
import { createEnv } from "@t3-oss/env-core";
import { z } from "zod";

export const env = createEnv({
	server: {
		DATABASE_URL: z.string().min(1),
		BETTER_AUTH_SECRET: z.string().min(32),
		BETTER_AUTH_URL: z.url(),
		CORS_ORIGIN: z.url(),
		NODE_ENV: z
			.enum(["development", "production", "test"])
			.default("development"),
		// Senha do gatilho de publicação das matérias agendadas
		// (`/api/cron/publish-scheduled`). Opcional porque dev, build e CI não
		// precisam dela — mas SEM ela a rota se recusa a rodar, em vez de ficar
		// aberta: é um endpoint que muda o estado do portal.
		CRON_SECRET: z.string().min(16).optional(),
		// Armazenamento de mídia (S3-compatível). Defaults miram o MinIO local, para
		// dev/build/CI funcionarem sem configuração; produção (R2) sobrescreve tudo.
		S3_ENDPOINT: z.url().default("http://localhost:9000"),
		S3_REGION: z.string().min(1).default("us-east-1"),
		S3_ACCESS_KEY_ID: z.string().min(1).default("minioadmin"),
		S3_SECRET_ACCESS_KEY: z.string().min(1).default("minioadmin"),
		S3_BUCKET: z.string().min(1).default("portal-media"),
		S3_PUBLIC_URL: z.url().default("http://localhost:9000/portal-media"),
		S3_FORCE_PATH_STYLE: z
			.enum(["true", "false"])
			.default("true")
			.transform((value) => value === "true"),
		// Mailer (convite e redefinição de senha, Bloco 1.3). Opcional por
		// desenho: SEM `RESEND_API_KEY`, o adapter cai para um no-op — dev, build
		// e CI funcionam sem conta em serviço nenhum (N10), e em produção o
		// "avise você mesmo" continua sendo o comportamento sem configuração.
		RESEND_API_KEY: z.string().min(1).optional(),
		MAIL_FROM: z.email().default("nao-responda@fm7cidades.com.br"),
		// Contador de "mais lidas" (Bloco 3). Default mira o Redis do
		// `pnpm db:start` — dev funciona sem configurar nada. Sem Redis
		// disponível (build do CI, Redis fora do ar), a leitura degrada para
		// "mais recentes" (N03) em vez de quebrar a página.
		REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
