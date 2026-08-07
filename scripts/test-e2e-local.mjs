#!/usr/bin/env node
// Roda o E2E localmente sem tocar no banco de dev: cria um BANCO efêmero (nome
// com UUID) no MESMO Postgres do `pnpm db:start`, aplica as migrações nele,
// aponta o dev server para lá durante a suíte, e apaga tudo no fim — sucesso,
// falha ou Ctrl-C.
//
// Por que banco e NÃO schema (`?schema=xxx` na mesma database): tentamos
// schema primeiro, e não funciona neste projeto — o Prisma gera SQL
// qualificado como "public"."tabela" (vem do datasource, não do
// multiSchema/preview, que este projeto não usa), ignorando tanto o
// `?schema=` da connection string quanto `options=-c search_path=...`. Banco
// separado sidesteps isso de graça: cada banco novo já nasce com um "public"
// vazio, que é exatamente o schema que o Prisma sempre usa.
//
// Por que banco e não um container novo (como o `test:integration` já faz via
// Testcontainers): `CREATE DATABASE`/`DROP DATABASE` no Postgres que já está
// rodando é bem mais rápido que subir um container, e não precisa de nada além
// do `pnpm db:start` já ligado.
//
// Por que reescrever `apps/web/.env` (e não só herdar a env var do processo):
// o `webServer` do Playwright sobe `pnpm dev:web` (Turborepo), e o Next só
// enxerga a `DATABASE_URL` se ela estiver no ARQUIVO `.env` — passar a
// variável só pelo ambiente do processo não chega lá de forma confiável (é o
// mesmo motivo pelo qual o job de e2e do CI GERA o arquivo `.env`, em vez de
// contar só nas env vars do shell/Turbo).
//
// Uso:  pnpm test:e2e:local
// Pré-requisito: `pnpm db:start` rodando (é o mesmo Postgres do dev).

import { randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const ENV_PATH = path.join(ROOT, "apps/web/.env");
const SEED_PATH = path.join(ROOT, "packages/db/prisma/seed-e2e.sql");
const CONTAINER = "portal-app-postgres";
const PG_USER = "portal";
// Banco "de administração" usado só para dar o CREATE/DROP DATABASE — não dá
// para rodar DROP DATABASE conectado a ele mesmo.
const ADMIN_DB = "portal_app";

const DEV_PORT = 3001;

function fail(message) {
	console.error(`\n✖ ${message}`);
	process.exit(1);
}

/**
 * Alguém já está servindo na porta do dev server?
 *
 * Isto NÃO é preciosismo: o `playwright.config.ts` usa
 * `reuseExistingServer: !process.env.CI`, então um dev server já rodando é
 * REAPROVEITADO — e ele foi iniciado com o `.env` antigo, apontando para o
 * banco de DESENVOLVIMENTO. A suíte rodaria contra os dados reais sem avisar:
 * os testes de auth criam conta, e os de enquete publicam enquete. Já
 * aconteceu numa execução desta suíte; por isso o script agora se recusa a
 * continuar em vez de confiar na sorte.
 */
function portInUse(port) {
	const result = spawnSync(
		"node",
		[
			"-e",
			`const s=require('net').createConnection({port:${port},host:'127.0.0.1'});` +
				`s.on('connect',()=>{s.destroy();process.exit(1)});` +
				`s.on('error',()=>process.exit(0));` +
				`setTimeout(()=>{s.destroy();process.exit(0)},1500);`,
		],
		{ stdio: "ignore" },
	);
	return result.status === 1;
}

// No Windows, `pnpm` é instalado como shim `.cmd` — não é um binário de
// verdade, então `spawnSync` só consegue rodá-lo com `shell: true` (sem isso
// dá ENOENT/EINVAL mesmo com o pnpm no PATH). `docker` é um `.exe` de verdade
// e não precisa disso.
const IS_WINDOWS = process.platform === "win32";

function run(command, args, opts = {}) {
	const result = spawnSync(command, args, {
		stdio: "inherit",
		cwd: ROOT,
		shell: IS_WINDOWS && command === "pnpm",
		...opts,
	});
	if (result.error) {
		throw result.error;
	}
	return result.status ?? 1;
}

function psql(args, opts = {}) {
	return spawnSync(
		"docker",
		["exec", ...(opts.interactive ? ["-i"] : []), CONTAINER, "psql", "-U", PG_USER, ...args],
		{ stdio: opts.interactive ? ["pipe", "inherit", "inherit"] : "inherit", ...opts },
	);
}

if (portInUse(DEV_PORT)) {
	fail(
		`Já existe algo servindo em http://localhost:${DEV_PORT}.\n` +
			`  O Playwright REAPROVEITARIA esse servidor — e ele aponta para o banco de\n` +
			`  desenvolvimento, não para o efêmero. A suíte escreveria nos seus dados reais.\n\n` +
			`  Pare o dev server (o \`pnpm dev\`/preview aberto) e rode de novo.`,
	);
}

if (!existsSync(ENV_PATH)) {
	fail(
		"apps/web/.env não existe. Rode `cp apps/web/.env.example apps/web/.env` primeiro (ver README).",
	);
}

const originalEnv = readFileSync(ENV_PATH, "utf8");
const match = originalEnv.match(/^DATABASE_URL="?([^"\n]+)"?$/m);
if (!match) {
	fail("Não encontrei DATABASE_URL em apps/web/.env.");
}
const baseUrl = new URL(match[1]);

// Nome de banco Postgres válido sem aspas: só letras/dígitos/underscore, sem
// começar com dígito — por isso os `-` do UUID viram `_`.
const dbName = `e2e_${randomUUID().replaceAll("-", "_")}`;
baseUrl.pathname = `/${dbName}`;
baseUrl.searchParams.delete("schema");
const ephemeralUrl = baseUrl.toString();

console.log(`→ Banco efêmero: ${dbName}`);

let restored = false;
function restoreEnv() {
	if (restored) return;
	writeFileSync(ENV_PATH, originalEnv);
	restored = true;
}

let dropped = false;
function dropDatabase() {
	if (dropped) return;
	dropped = true;
	console.log(`→ Removendo banco ${dbName}…`);
	// Sem shell nenhum — o nome vem de nós (só letras/dígitos/underscore), não
	// precisa de aspas de identificador.
	psql(["-d", ADMIN_DB, "-c", `DROP DATABASE IF EXISTS ${dbName} WITH (FORCE);`]);
}

function cleanup() {
	restoreEnv();
	dropDatabase();
}

process.on("SIGINT", () => {
	cleanup();
	process.exit(130);
});
process.on("SIGTERM", () => {
	cleanup();
	process.exit(143);
});

/**
 * Mesmo fixture que o job de e2e do CI aplica
 * (`packages/db/prisma/seed-e2e.sql`) — sem ele, `home.spec.ts` não acha a
 * matéria que espera. Via `docker exec` (não `psql -h localhost`) para não
 * exigir cliente Postgres instalado na máquina do dev.
 */
function seedFixtures() {
	if (!existsSync(SEED_PATH)) return;
	console.log("→ Semeando fixture do e2e…");
	const sql = readFileSync(SEED_PATH, "utf8");
	const result = psql(["-d", dbName, "-v", "ON_ERROR_STOP=1"], {
		interactive: true,
		input: sql,
	});
	if (result.status !== 0) {
		fail("Falha ao semear o fixture do e2e no banco efêmero.");
	}
}

try {
	console.log(`→ Criando banco ${dbName}…`);
	const createStatus = psql(["-d", ADMIN_DB, "-c", `CREATE DATABASE ${dbName};`]).status;
	if (createStatus !== 0) {
		fail("Falha ao criar o banco efêmero.");
	}

	console.log("→ Aplicando migrações…");
	const migrateStatus = run(
		"pnpm",
		["--filter", "@portal-app/db", "exec", "prisma", "migrate", "deploy"],
		{ env: { ...process.env, DATABASE_URL: ephemeralUrl } },
	);
	if (migrateStatus !== 0) {
		fail("Falha ao aplicar migrações no banco efêmero.");
	}

	seedFixtures();

	// Só a partir daqui o dev server passa a ler o banco efêmero — o webServer
	// do Playwright é quem sobe o `pnpm dev:web`.
	const patchedEnv = originalEnv.replace(
		/^DATABASE_URL="?[^"\n]+"?$/m,
		`DATABASE_URL="${ephemeralUrl}"`,
	);
	writeFileSync(ENV_PATH, patchedEnv);

	console.log("→ Rodando Playwright…\n");
	// --workers=1: sem isto, N workers batem no MESMO dev server (Next,
	// cold/lazy-compile) ao mesmo tempo e a primeira rota compilada estoura o
	// timeout de ação. O CI já roda serial pelo mesmo motivo
	// (`workers: process.env.CI ? 1 : …` em playwright.config.ts).
	const testStatus = run("pnpm", ["exec", "playwright", "test", "--workers=1"]);

	cleanup();
	process.exit(testStatus);
} catch (error) {
	cleanup();
	throw error;
}
