/**
 * Guarda do `db:migrate`.
 *
 * `prisma migrate dev` é um comando de DESENVOLVIMENTO: ele compara schema e
 * banco, e diante de divergência propõe recriar o banco — apagando tudo. Contra
 * produção isso é irreversível.
 *
 * A armadilha é silenciosa: basta o `DATABASE_URL` do `.env` apontar para o
 * banco de produção (o que acontece na primeira vez que alguém quer conferir
 * algo lá) e o comando de sempre passa a mirar o alvo errado, sem avisar. Foi o
 * que aconteceu em 2026-08-06 — a migração era aditiva e não houve perda, mas o
 * susto foi real.
 *
 * Esta guarda recusa o `migrate dev` quando o destino não é um banco local. Para
 * produção existe `db:deploy` (`prisma migrate deploy`), que só aplica o que
 * está pendente e nunca destrói.
 */

// Mesmo carregamento do `prisma.config.ts` — a guarda precisa enxergar
// exatamente o que a CLI vai enxergar, senão bloqueia o que deveria passar.
import dotenv from "dotenv";

dotenv.config({ path: "../../apps/web/.env", quiet: true });

const url = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!url) {
	console.error("\n✖ DATABASE_URL não definida — nada a migrar.\n");
	process.exit(1);
}

const LOCAL_HOSTS = new Set([
	"localhost",
	"127.0.0.1",
	"::1",
	"postgres",
	"db",
]);

let host;
try {
	host = new URL(url).hostname;
} catch {
	console.error("\n✖ DATABASE_URL não é uma URL válida.\n");
	process.exit(1);
}

if (LOCAL_HOSTS.has(host)) {
	process.exit(0);
}

// Escotilha consciente: quem realmente precisa, declara.
if (process.env.ALLOW_REMOTE_MIGRATE === "1") {
	console.warn(
		`\n⚠  migrate dev contra host REMOTO (${host}) — ALLOW_REMOTE_MIGRATE=1.\n`,
	);
	process.exit(0);
}

console.error(`
✖ Recusado: "db:migrate" (prisma migrate dev) apontando para um banco REMOTO.

  host: ${host}

  "migrate dev" é comando de desenvolvimento — diante de divergência entre
  schema e banco ele PROPÕE RECRIAR O BANCO, apagando os dados.

  • Para migrar produção:   pnpm db:deploy
  • Para desenvolver:       aponte DATABASE_URL para o Postgres local
                            (pnpm db:start) e rode de novo.
  • Se você sabe o que faz: ALLOW_REMOTE_MIGRATE=1 pnpm db:migrate
`);
process.exit(1);
