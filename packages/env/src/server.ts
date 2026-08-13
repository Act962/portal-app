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
		// Token da AwesomeAPI (faixa de cotações da home). Opcional: sem ele a
		// busca continua funcionando, e é assim que dev, build e CI rodam sem
		// conta em serviço nenhum (N10).
		//
		// Em PRODUÇÃO ele deixou de ser opcional na prática. O limite do acesso
		// anônimo é por ENDEREÇO IP, e os IPs de saída da Vercel são
		// compartilhados com outros clientes: a cota se esgota por uso de
		// terceiros, não pelo nosso. O portal tomou 429 em toda visita até esta
		// variável existir.
		AWESOMEAPI_TOKEN: z.string().min(1).optional(),
		MAIL_FROM: z.email().default("nao-responda@fm7cidades.com.br"),
		// Contador de "mais lidas" (Bloco 3). Default mira o Redis do
		// `pnpm db:start` — dev funciona sem configurar nada. Sem Redis
		// disponível (build do CI, Redis fora do ar), a leitura degrada para
		// "mais recentes" (N03) em vez de quebrar a página.
		REDIS_URL: z.string().min(1).default("redis://localhost:6379"),
		// Inngest — o agendador de produção (ADR 0007). O próprio SDK lê estas três
		// do ambiente; estão declaradas aqui para ficarem documentadas e validadas
		// num lugar só. Todas opcionais, porque a combinação válida depende do
		// ambiente e não dá para exprimir isso campo a campo.
		//
		// INNGEST_DEV=1 põe o SDK em modo local, falando com o Dev Server
		// (`pnpm dev:inngest`) em vez da nuvem — é o que faz dev e CI rodarem sem
		// conta em serviço nenhum (N10). **Não é inferido do `NODE_ENV`**: sem a
		// variável o SDK assume nuvem e a rota `/api/inngest` responde 500 pedindo
		// a chave. Recusar assim é o comportamento certo — o contrário seria um
		// deploy de produção conversando em silêncio com um servidor local que não
		// existe.
		//
		// SIGNING_KEY: verifica que quem chama `/api/inngest` é o Inngest.
		// EVENT_KEY: autentica o envio de eventos NOSSOS para o Inngest — hoje não
		// enviamos nenhum (só usamos gatilho por cron), mas é o que o `EventBus`
		// durável vai precisar quando for plugado.
		// Verificação de propriedade do Search Console (spec 07, D7). Opcional: sem
		// ela nenhuma tag é emitida. É um segredo POR AMBIENTE — cravá-lo no
		// código faria o deploy de preview reivindicar o domínio de produção.
		GOOGLE_SITE_VERIFICATION: z.string().min(1).optional(),
		INNGEST_DEV: z.string().optional(),
		INNGEST_SIGNING_KEY: z.string().min(1).optional(),
		INNGEST_EVENT_KEY: z.string().min(1).optional(),
	},
	runtimeEnv: process.env,
	skipValidation: !!process.env.SKIP_ENV_VALIDATION,
	emptyStringAsUndefined: true,
});
