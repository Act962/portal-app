/**
 * Semente do portal — conteúdo inicial para o site não nascer vazio.
 *
 * Escrito em `.mjs` sobre o `pg` de propósito: roda com `node` puro, sem `tsx`,
 * sem etapa de build e sem depender do cliente do Prisma (que na v7 é gerado em
 * TypeScript). É o que permite executá-lo contra o banco de PRODUÇÃO a partir de
 * qualquer máquina, apontando a `DATABASE_URL`.
 *
 *   pnpm db:seed                                  # usa a DATABASE_URL do .env
 *   DATABASE_URL="postgresql://…" pnpm db:seed    # aponta para outro banco
 *   SEED_ARTICLES=40 pnpm db:seed                 # muda o volume (padrão: 24)
 *
 * DETERMINÍSTICO e IDEMPOTENTE: o faker roda com semente fixa, então os mesmos
 * títulos (e portanto os mesmos slugs) saem em toda execução, e cada linha é um
 * upsert por slug. Rodar duas vezes não duplica nada.
 *
 * ATENÇÃO: rodar de novo SOBRESCREVE o conteúdo semeado. Estas matérias são
 * material de partida; depois que a redação começar a editar, não rode mais.
 *
 * Por que o corpo NÃO usa `faker.lorem`: lorem ipsum é latim. Num portal que vai
 * ser mostrado a um cliente, texto em latim denuncia que é falso. O faker entra
 * onde rende — nomes, números, datas, variedade e volume — e as frases vêm de
 * moldes em português, montados com esses valores.
 *
 * CAPAS: as matérias recebem, em rodízio, imagens que JÁ EXISTEM no bucket do
 * R2 (ver `IMAGENS` abaixo). O seed não sobe arquivo — só registra os metadados
 * e a chave no storage. Por isso as capas só aparecem quando a `S3_PUBLIC_URL`
 * do ambiente aponta para o bucket onde os arquivos estão; no MinIO local elas
 * não resolvem e o portal mostra o espaço da imagem reservado, sem quebrar.
 */
import { randomUUID } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { fakerPT_BR as faker } from "@faker-js/faker";
import dotenv from "dotenv";
import pg from "pg";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({
	path: path.join(here, "..", "..", "..", "apps", "web", ".env"),
});

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
	console.error(
		"DATABASE_URL não definida. Aponte para o banco antes de semear:\n" +
			'  DATABASE_URL="postgresql://…" pnpm db:seed',
	);
	process.exit(1);
}

// Semente fixa: mesma saída em toda execução, o que mantém os slugs estáveis.
faker.seed(70931);

const TOTAL = Number(process.env.SEED_ARTICLES ?? 24);

// --- Vocabulário local -----------------------------------------------------
// O portal é de Piracuruca (PI); os nomes próprios vêm daqui para o conteúdo
// soar regional, não genérico.

const CIDADES = [
	"Piracuruca",
	"Piripiri",
	"Pedro II",
	"Batalha",
	"Campo Maior",
	"Barras",
	"Esperantina",
	"São José do Divino",
];

const BAIRROS = [
	"Centro",
	"Alto da Boa Vista",
	"Nova Piracuruca",
	"Bela Vista",
	"São Francisco",
	"Vila Nova",
];

const ORGAOS = [
	"a Prefeitura",
	"a Câmara Municipal",
	"o Governo do Estado",
	"a Secretaria de Saúde",
	"a Secretaria de Educação",
	"o Departamento de Trânsito",
];

const CARGOS = [
	"prefeito",
	"secretário de Infraestrutura",
	"secretária de Saúde",
	"vereador",
	"diretor do hospital regional",
	"presidente do sindicato",
];

/** Moldes de manchete por editoria. `{cidade}`, `{bairro}`, `{n}` e `{orgao}`
 * são preenchidos pelo faker — é o que dá variedade sem repetir texto. */
const MOLDES = {
	cidades: [
		{
			kicker: "INFRAESTRUTURA",
			headline: "{orgao} anuncia obras de pavimentação no bairro {bairro}",
			standfirst:
				"Serviço deve durar {n} meses e atender cerca de {n2} mil moradores. Trânsito terá desvios durante o período.",
		},
		{
			kicker: "SANEAMENTO",
			headline: "Rede de esgoto chega a mais {n} ruas de {cidade}",
			standfirst:
				"Ampliação faz parte do plano municipal de saneamento e beneficia moradores da zona leste.",
		},
		{
			kicker: "TEMPO",
			headline: "Chuva forte alaga ruas do {bairro} e Defesa Civil monitora",
			standfirst:
				"Volume registrado em duas horas superou a média histórica do mês. Não há vítimas.",
		},
		{
			kicker: "SERVIÇOS",
			headline: "Mutirão de atendimento leva {n} serviços ao {bairro}",
			standfirst:
				"Atendimento acontece no sábado, das 8h às 16h, por ordem de chegada e sem agendamento.",
		},
		{
			kicker: "TRÂNSITO",
			headline: "Trecho da BR-343 tem interdição parcial a partir de segunda",
			standfirst:
				"Obras de recuperação do asfalto seguem por {n} semanas. Rota alternativa está sinalizada.",
		},
	],
	politica: [
		{
			kicker: "CÂMARA",
			headline: "Câmara aprova orçamento municipal por {n} votos a {n3}",
			standfirst:
				"Emendas destinam recursos adicionais à saúde e à reforma de escolas da zona rural.",
		},
		{
			kicker: "PREFEITURA",
			headline: "{orgao} publica edital de concurso com {n2} vagas",
			standfirst:
				"Há oportunidades de níveis fundamental, médio e superior. Inscrições vão até o fim do mês.",
		},
		{
			kicker: "GESTÃO",
			headline: "Audiência pública discute plano diretor de {cidade}",
			standfirst:
				"Encontro é aberto à população e define as regras de ocupação da cidade para a próxima década.",
		},
		{
			kicker: "CONTAS",
			headline: "Tribunal aprova com ressalvas as contas do município",
			standfirst:
				"Parecer aponta necessidade de ajustes na prestação de contas, sem indicativo de irregularidade grave.",
		},
	],
	policia: [
		{
			kicker: "SEGURANÇA",
			headline: "Operação apreende {n2} produtos irregulares em {cidade}",
			standfirst:
				"Ação conjunta entre polícia e vigilância sanitária percorreu {n} estabelecimentos.",
		},
		{
			kicker: "TRÂNSITO",
			headline: "Fiscalização flagra {n2} motoristas sem habilitação",
			standfirst:
				"Blitz aconteceu na entrada da cidade e seguirá em pontos alternados durante o mês.",
		},
		{
			kicker: "INVESTIGAÇÃO",
			headline: "Polícia investiga furto em prédio público do {bairro}",
			standfirst:
				"Equipamentos foram levados durante a madrugada. Câmeras de segurança serão analisadas.",
		},
	],
	esportes: [
		{
			kicker: "FUTEBOL",
			headline: "Time de {cidade} vence fora de casa e assume a liderança",
			standfirst:
				"Vitória por {n3} a 0 colocou a equipe na ponta da tabela a três rodadas do fim da primeira fase.",
		},
		{
			kicker: "VAQUEJADA",
			headline: "Parque recebe {n2} competidores no fim de semana",
			standfirst:
				"Premiação total passa de R$ {n2} mil e a expectativa é de público recorde.",
		},
		{
			kicker: "AMADOR",
			headline: "Campeonato amador começa com {n} times inscritos",
			standfirst:
				"Jogos acontecem aos domingos e a final está marcada para o próximo mês.",
		},
	],
	economia: [
		{
			kicker: "EMPREGO",
			headline: "Comércio de {cidade} abre {n2} vagas temporárias",
			standfirst:
				"Contratações miram o aumento do movimento no fim do ano. Currículos podem ser entregues na associação.",
		},
		{
			kicker: "AGRONEGÓCIO",
			headline: "Produtores da região colhem safra {n}% maior que a anterior",
			standfirst:
				"Chuvas regulares e crédito rural explicam o resultado, segundo a associação de produtores.",
		},
		{
			kicker: "CUSTO DE VIDA",
			headline: "Cesta básica sobe {n}% em {cidade} no último mês",
			standfirst:
				"Levantamento aponta alta puxada por hortifrúti. Carnes tiveram leve queda no período.",
		},
	],
};

const EDITORIAS = [
	{
		slug: "cidades",
		name: "Cidades",
		description: "O dia a dia de Piracuruca e das cidades da região.",
		color: "#0ea5e9",
		order: 0,
	},
	{
		slug: "politica",
		name: "Política",
		description:
			"Prefeitura, Câmara, Assembleia e as decisões que afetam o Piauí.",
		color: "#6366f1",
		order: 1,
	},
	{
		slug: "policia",
		name: "Polícia",
		description: "Segurança pública, ocorrências e investigações.",
		color: "#ef4444",
		order: 2,
	},
	{
		slug: "esportes",
		name: "Esportes",
		description: "Futebol piauiense, vaquejada e o esporte amador da região.",
		color: "#22c55e",
		order: 3,
	},
	{
		slug: "economia",
		name: "Economia",
		description: "Emprego, comércio, agronegócio e o bolso do piauiense.",
		color: "#f59e0b",
		order: 4,
	},
];

const ASSUNTOS = [
	{ slug: "piracuruca", name: "Piracuruca" },
	{ slug: "br-343", name: "BR-343" },
	{ slug: "prefeitura", name: "Prefeitura" },
	{ slug: "saude", name: "Saúde" },
	{ slug: "educacao", name: "Educação" },
	{ slug: "concurso-publico", name: "Concurso público" },
	{ slug: "seguranca", name: "Segurança" },
	{ slug: "emprego", name: "Emprego" },
];

/**
 * Imagens já presentes no bucket do R2, usadas como capa das matérias semeadas.
 *
 * Guardamos a CHAVE no storage, nunca a URL inteira — é o que o domínio de mídia
 * faz (ADR 0009). A URL pública é montada na leitura como
 * `${S3_PUBLIC_URL}/${storageKey}`, então trocar de bucket, de CDN ou de domínio
 * é mudar uma variável de ambiente, não reescrever linhas do banco.
 *
 * ⚠️ Para estas capas aparecerem, a `S3_PUBLIC_URL` do ambiente precisa apontar
 * para o bucket onde os arquivos estão:
 *   S3_PUBLIC_URL="https://pub-d14859754dc2458b927087bc10b1e102.r2.dev"
 * No ambiente local padrão (MinIO) elas não resolvem, e o portal mostra o espaço
 * da imagem reservado — sem quebrar o layout.
 */
const IMAGENS = [
	{
		storageKey: "6a71d9292a0d1-edicao-imagens-g1-5-webp.webp",
		altText: "Equipe de reportagem durante a edição de imagens na redação",
		credit: "Foto: Divulgação",
		caption: "",
	},
	{
		storageKey: "6a73402be2d07-fundacao-cultural-webp.webp",
		altText: "Fachada do prédio da fundação cultural",
		credit: "Foto: Divulgação",
		caption: "",
	},
	{
		storageKey: "6a735167a78dd-tiagoscheuer02-qhhqm4rmmxio-webp.webp",
		altText: "Vista externa de prédio público em dia claro",
		credit: "Foto: Tiago Scheuer",
		caption: "",
	},
	{
		storageKey: "6a737fce9f4f1-1000398734-webp.webp",
		altText: "Registro de rua da cidade com movimento de pessoas",
		credit: "Foto: Arquivo",
		caption: "",
	},
	{
		storageKey: "6a73828254c29-michelle-bolsonaro-d1ebd5009b-webp.webp",
		altText: "Autoridade durante evento público",
		credit: "Foto: Agência Brasil",
		caption: "",
	},
	{
		storageKey: "6a738e93c2d78-1000398768-webp.webp",
		altText: "Registro de atividade na cidade",
		credit: "Foto: Arquivo",
		caption: "",
	},
];

// --- Montagem do conteúdo --------------------------------------------------

const pick = (list) => faker.helpers.arrayElement(list);

/** Preenche os marcadores de um molde com valores do faker. */
function preencher(texto) {
	return texto
		.replaceAll("{cidade}", () => pick(CIDADES))
		.replaceAll("{bairro}", () => pick(BAIRROS))
		.replaceAll("{orgao}", () => pick(ORGAOS))
		.replaceAll("{n}", () => String(faker.number.int({ min: 3, max: 18 })))
		.replaceAll("{n2}", () => String(faker.number.int({ min: 40, max: 900 })))
		.replaceAll("{n3}", () => String(faker.number.int({ min: 1, max: 4 })));
}

const slugify = (valor) =>
	valor
		.normalize("NFD")
		.replace(/[̀-ͯ]/g, "")
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, "-")
		.replace(/^-+|-+$/g, "")
		.slice(0, 80);

/** Blocos do corpo, no formato com nós inline (ADR 0010). */
const p = (...nodes) => ({
	type: "paragraph",
	content: nodes.map((n) =>
		typeof n === "string" ? { type: "text", text: n } : n,
	),
});
const forte = (text) => ({ type: "strong", text });
const h2 = (text) => ({
	type: "heading",
	level: 2,
	content: [{ type: "text", text }],
});
const citacao = (text, cite) => ({
	type: "quote",
	content: [{ type: "text", text }],
	cite,
});
const lista = (...items) => ({
	type: "list",
	ordered: false,
	items: items.map((item) => [{ type: "text", text: item }]),
});

const ABERTURAS = [
	"A informação foi confirmada nesta {dia} pela assessoria do órgão responsável.",
	"O anúncio foi feito durante coletiva de imprensa na manhã desta {dia}.",
	"A medida começa a valer a partir da próxima semana, segundo o comunicado oficial.",
	"Moradores da região acompanharam o anúncio e cobraram prazos definidos.",
];

const DESDOBRAMENTOS = [
	"Segundo o cronograma apresentado, as primeiras frentes de trabalho começam ainda neste trimestre.",
	"A expectativa é de que o serviço seja concluído antes do período chuvoso.",
	"O investimento sai de recursos próprios, com contrapartida do governo estadual.",
	"Técnicos farão vistoria semanal para acompanhar o andamento dos trabalhos.",
	"Uma nova reunião foi marcada para daqui a 30 dias, quando o balanço será apresentado.",
];

const FECHAMENTOS = [
	"A reportagem procurou os responsáveis e aguarda retorno.",
	"Quem tiver dúvidas pode procurar o atendimento presencial, de segunda a sexta.",
	"Mais informações serão divulgadas no site oficial nos próximos dias.",
];

const DIAS = [
	"segunda-feira",
	"terça-feira",
	"quarta-feira",
	"quinta-feira",
	"sexta-feira",
];

function montarCorpo(molde) {
	const valor = faker.number.int({ min: 2, max: 140 });
	const dia = pick(DIAS);
	const autoridade = `${faker.person.fullName()}, ${pick(CARGOS)}`;

	const corpo = [
		p(
			preencher(molde.standfirst.replace(/\.$/, "")),
			". ",
			pick(ABERTURAS).replace("{dia}", dia),
		),
		p(
			"O investimento previsto é de ",
			forte(`R$ ${valor} milhões`),
			", segundo o documento apresentado. ",
			pick(DESDOBRAMENTOS),
		),
		h2(pick(["O que muda", "Como vai funcionar", "Próximos passos"])),
		lista(
			preencher("Atendimento ampliado em {n} pontos da cidade"),
			preencher("Prazo estimado de {n} meses para a conclusão"),
			preencher("Cerca de {n2} pessoas diretamente beneficiadas"),
		),
		citacao(
			pick([
				"É o maior investimento na região nos últimos dez anos.",
				"Vamos acompanhar de perto para que o prazo seja cumprido.",
				"A população cobrou, e a resposta está saindo do papel.",
			]),
			autoridade,
		),
		p(pick(DESDOBRAMENTOS), " ", pick(FECHAMENTOS)),
	];

	return corpo;
}

/** Gera as matérias, distribuindo entre editorias e espalhando as datas. */
function gerarMaterias(total) {
	const editoriaSlugs = Object.keys(MOLDES);
	const materias = [];
	const usados = new Set();

	// A primeira matéria de cada editoria garante que nenhuma nasça vazia.
	const ordem = [
		...editoriaSlugs,
		...Array.from({ length: Math.max(0, total - editoriaSlugs.length) }, () =>
			pick(editoriaSlugs),
		),
	].slice(0, total);

	ordem.forEach((secao, indice) => {
		const molde = pick(MOLDES[secao]);
		const headline = preencher(molde.headline);

		let slug = slugify(headline);
		if (usados.has(slug)) {
			slug = `${slug}-${indice}`;
		}
		usados.add(slug);

		materias.push({
			slug,
			headline,
			kicker: molde.kicker,
			standfirst: preencher(molde.standfirst),
			secao,
			assuntos: faker.helpers.arrayElements(
				ASSUNTOS.map((a) => a.slug),
				{ min: 1, max: 3 },
			),
			autor: faker.person.fullName(),
			// Espalha da mais recente (2h) para a mais antiga, sem repetir horário.
			horasAtras: 2 + indice * faker.number.int({ min: 4, max: 11 }),
			body: montarCorpo(molde),
		});
	});

	return materias;
}

// --- Escrita ---------------------------------------------------------------

const client = new pg.Client({ connectionString });

async function main() {
	await client.connect();
	const agora = Date.now();
	const materias = gerarMaterias(TOTAL);

	console.log("Semeando o portal…\n");

	const idPorEditoria = new Map();
	for (const e of EDITORIAS) {
		const { rows } = await client.query(
			`INSERT INTO section (id, name, slug, description, color, "order", status, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6, 'ATIVA', now(), now())
			 ON CONFLICT (slug) DO UPDATE
			   SET name = EXCLUDED.name,
			       description = EXCLUDED.description,
			       color = EXCLUDED.color,
			       "order" = EXCLUDED."order",
			       "updatedAt" = now()
			 RETURNING id`,
			[randomUUID(), e.name, e.slug, e.description, e.color, e.order],
		);
		idPorEditoria.set(e.slug, rows[0].id);
	}
	console.log(`  ${EDITORIAS.length} editorias`);

	const idPorAssunto = new Map();
	for (const a of ASSUNTOS) {
		const { rows } = await client.query(
			`INSERT INTO tag (id, name, slug, "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, now(), now())
			 ON CONFLICT (slug) DO UPDATE
			   SET name = EXCLUDED.name, "updatedAt" = now()
			 RETURNING id`,
			[randomUUID(), a.name, a.slug],
		);
		idPorAssunto.set(a.slug, rows[0].id);
	}
	console.log(`  ${ASSUNTOS.length} assuntos`);

	// --- Mídia -------------------------------------------------------------
	// Ponto focal em 0.5/0.4: um pouco acima do centro, que é onde costuma estar
	// o rosto ou o assunto numa foto jornalística — evita cortar cabeça no 16:9.
	const midias = [];
	for (const img of IMAGENS) {
		const { rows } = await client.query(
			`INSERT INTO media_asset
			   (id, type, "storageKey", filename, "mimeType", caption, credit,
			    "altText", width, height, "focalX", "focalY", "createdAt", "updatedAt")
			 VALUES ($1, 'IMAGE', $2, $3, 'image/webp', $4, $5, $6, 1600, 900, 0.5, 0.4,
			         now(), now())
			 ON CONFLICT ("storageKey") DO UPDATE
			   SET "altText" = EXCLUDED."altText",
			       credit = EXCLUDED.credit,
			       caption = EXCLUDED.caption,
			       "updatedAt" = now()
			 RETURNING id`,
			[
				randomUUID(),
				img.storageKey,
				img.storageKey,
				img.caption,
				img.credit,
				img.altText,
			],
		);
		midias.push({ id: rows[0].id, altText: img.altText });
	}
	console.log(`  ${midias.length} imagens`);

	for (const [indice, m] of materias.entries()) {
		const publishedAt = new Date(agora - m.horasAtras * 60 * 60 * 1000);
		const tagIds = m.assuntos
			.map((slug) => idPorAssunto.get(slug))
			.filter(Boolean);
		// Rodízio pelo índice em vez de sorteio: com poucas imagens, o sorteio
		// repetiria a mesma foto em manchetes vizinhas na home.
		const capa = midias[indice % midias.length];

		await client.query(
			`INSERT INTO article
			   (id, headline, slug, kicker, standfirst, body, "authorId", "authorName",
			    "sectionId", "tagIds", "coverMediaId", "coverAltText", status,
			    "publishedAt", "firstPublishedAt", "createdAt", "updatedAt")
			 VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7, $8, $9, $10::text[], $11, $12,
			         'PUBLICADA', $13, $13, now(), now())
			 ON CONFLICT (slug) DO UPDATE
			   SET headline = EXCLUDED.headline,
			       kicker = EXCLUDED.kicker,
			       standfirst = EXCLUDED.standfirst,
			       body = EXCLUDED.body,
			       "authorName" = EXCLUDED."authorName",
			       "sectionId" = EXCLUDED."sectionId",
			       "tagIds" = EXCLUDED."tagIds",
			       "coverMediaId" = EXCLUDED."coverMediaId",
			       "coverAltText" = EXCLUDED."coverAltText",
			       status = EXCLUDED.status,
			       "publishedAt" = EXCLUDED."publishedAt",
			       "updatedAt" = now()`,
			[
				randomUUID(),
				m.headline,
				m.slug,
				m.kicker,
				m.standfirst,
				JSON.stringify(m.body),
				// Referência por id puro, SEM chave estrangeira (contextos isolados):
				// não exige um usuário criado. A redação real assina as suas depois.
				`seed-${slugify(m.autor)}`,
				m.autor,
				idPorEditoria.get(m.secao) ?? null,
				tagIds,
				capa.id,
				capa.altText,
				publishedAt,
			],
		);
	}
	console.log(`  ${materias.length} matérias publicadas, todas com capa`);

	console.log("\nPronto. Abra o portal para ver o conteúdo no ar.");

	const base = process.env.S3_PUBLIC_URL ?? "(não definida)";
	if (!base.includes("r2.dev") && !base.includes("r2.cloudflarestorage")) {
		console.log(
			`\nAviso: S3_PUBLIC_URL = ${base}\n` +
				"As capas semeadas vivem no bucket do R2. Com esta variável apontando\n" +
				"para outro storage, as imagens não vão resolver e o portal mostra o\n" +
				"espaço reservado. Em produção, use a URL pública do bucket.",
		);
	}
}

main()
	.catch((error) => {
		console.error("\nFalha ao semear:", error.message ?? error);
		process.exitCode = 1;
	})
	.finally(() => client.end());
