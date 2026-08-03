import type { Article, ArticleBlock, InlineNode } from "./types";

/**
 * Fixed clock for the whole fixture set.
 *
 * Relative labels ("há 12 min") are derived from this constant instead of
 * `Date.now()` so the server and the client always render the same string —
 * a live clock here would cause a hydration mismatch on every page.
 */
export const FIXTURE_NOW = new Date("2026-08-03T10:26:00-03:00");

const text = (value: string): InlineNode => ({ kind: "text", text: value });
const strong = (value: string): InlineNode => ({ kind: "strong", text: value });
const link = (value: string, href: string): InlineNode => ({
	kind: "link",
	text: value,
	href,
});

const paragraph = (...content: InlineNode[]): ArticleBlock => ({
	kind: "paragraph",
	content,
});

/** Body used by every article that is not the lead story. */
function standardBody(topic: string): ArticleBlock[] {
	return [
		paragraph(
			text(
				`O detalhamento apresentado nesta segunda-feira traz prazos, valores e os municípios envolvidos em ${topic}. A equipe técnica responsável apresentou os números durante a reunião.`,
			),
		),
		paragraph(
			text("Segundo os responsáveis, as próximas etapas dependem da "),
			strong("conclusão do cronograma"),
			text(" e da liberação orçamentária prevista para o mês seguinte."),
		),
		{ kind: "subheading", text: "O que acontece agora" },
		paragraph(
			text(
				"O acompanhamento das etapas será divulgado semanalmente, e a Rádio 7 Cidades segue os desdobramentos do assunto na programação e no portal.",
			),
		),
	];
}

/** The lead story keeps the full block vocabulary, including a pull quote. */
const headlineBody: ArticleBlock[] = [
	paragraph(
		text(
			"O pacote apresentado em audiência pública prevê investimento em rodovias, saneamento e ampliação de unidades de saúde em nove municípios do norte do estado. O cronograma começa em setembro.",
		),
	),
	paragraph(
		text("Trechos considerados prioritários receberão "),
		strong("obras emergenciais"),
		text(
			" ainda neste semestre. O detalhamento por município foi publicado em ",
		),
		link("nota oficial", "/politica"),
		text(" e será acompanhado por uma comissão de fiscalização."),
	),
	{
		kind: "quote",
		text: "O cronograma foi construído com os prefeitos da região, e cada etapa terá acompanhamento público mês a mês.",
		attribution: "Coordenação do programa de obras",
	},
	{ kind: "subheading", text: "Municípios contemplados" },
	paragraph(
		text(
			"Piracuruca, Piripiri e São José do Divino estão entre as cidades da primeira etapa. As demais entram no cronograma a partir de novembro, conforme o levantamento apresentado.",
		),
	),
	paragraph(
		text(
			"O fechamento da matéria traz o contexto e as próximas etapas do assunto, com indicação de onde acompanhar os desdobramentos.",
		),
	),
];

export const ARTICLES: Article[] = [
	{
		slug: "pacote-de-obras-para-o-norte-do-piaui",
		title:
			"Governo anuncia pacote de obras para o norte do Piauí em audiência pública",
		kicker: "POLÍTICA",
		standfirst:
			"Investimento previsto contempla rodovias, saneamento e ampliação de unidades de saúde em nove municípios da região. Cronograma começa em setembro.",
		sectionSlug: "politica",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T08:14:00-03:00",
		updatedAt: "2026-08-03T10:14:00-03:00",
		readingMinutes: 4,
		coverCaption: "Audiência pública reuniu prefeitos da região — Divulgação",
		tags: ["piaui", "obras", "governo", "piracuruca"],
		body: headlineBody,
		isHeadline: true,
	},
	{
		slug: "nova-linha-de-onibus-liga-interior-a-capital",
		title:
			"Nova linha de ônibus liga o interior à capital a partir de setembro",
		kicker: "CIDADES",
		standfirst:
			"Trajeto terá quatro saídas diárias e deve reduzir em uma hora o tempo de viagem entre os municípios do norte e Teresina.",
		sectionSlug: "cidades",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T09:46:00-03:00",
		readingMinutes: 3,
		coverCaption: "Terminal rodoviário de Piracuruca — Divulgação",
		tags: ["mobilidade", "transporte", "piaui"],
		body: standardBody("a nova linha intermunicipal"),
		mostReadRank: 1,
	},
	{
		slug: "concurso-publico-abre-240-vagas-para-o-piaui",
		title: "Concurso público abre 240 vagas para o Piauí; veja os cargos",
		kicker: "CONCURSOS",
		standfirst:
			"Inscrições vão até o fim do mês e contemplam níveis médio e superior, com lotação em municípios do interior.",
		sectionSlug: "educacao",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T09:26:00-03:00",
		readingMinutes: 3,
		coverCaption: "Candidatos durante prova aplicada no ano passado — Arquivo",
		tags: ["concursos", "emprego", "piaui"],
		body: standardBody("o edital do novo concurso"),
		mostReadRank: 2,
	},
	{
		slug: "chuvas-acima-da-media-no-norte-do-estado",
		title: "Chuvas acima da média são previstas para o norte do estado",
		kicker: "CIDADES",
		standfirst:
			"Boletim aponta volume acima do esperado para agosto e recomenda atenção em áreas de risco nos municípios ribeirinhos.",
		sectionSlug: "cidades",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T07:00:00-03:00",
		readingMinutes: 2,
		coverCaption: "Céu carregado sobre a BR-343 — Arquivo",
		tags: ["clima", "defesa-civil", "piaui"],
		body: standardBody("o boletim meteorológico do mês"),
		mostReadRank: 3,
	},
	{
		slug: "festival-de-musica-do-interior-confirma-atracoes",
		title: "Festival de música do interior confirma atrações e datas",
		kicker: "ENTRETENIMENTO",
		standfirst:
			"Programação de três dias reúne artistas da região e shows gratuitos na praça central, em setembro.",
		sectionSlug: "entretenimento",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T06:00:00-03:00",
		readingMinutes: 2,
		coverCaption: "Palco montado na edição anterior do festival — Divulgação",
		tags: ["cultura", "musica", "piracuruca"],
		body: standardBody("a programação do festival"),
		mostReadRank: 4,
	},
	{
		slug: "feira-do-produtor-movimenta-400-mil",
		title: "Feira do produtor movimenta R$ 400 mil no fim de semana",
		kicker: "ECONOMIA",
		standfirst:
			"Balanço da organização aponta alta de 18% em relação à edição anterior, puxada pela venda de hortifrúti.",
		sectionSlug: "economia",
		authorSlug: "aldo-costa",
		publishedAt: "2026-08-03T08:26:00-03:00",
		readingMinutes: 3,
		coverCaption: "Movimento na feira no domingo — Divulgação",
		tags: ["economia", "agricultura", "piaui"],
		body: standardBody("o balanço da feira do produtor"),
		mostReadRank: 5,
	},
	{
		slug: "reforma-da-praca-central-e-entregue",
		title:
			"Prefeitura entrega reforma da praça central após seis meses de obras",
		kicker: "CIDADES",
		standfirst:
			"Espaço recebeu nova iluminação, acessibilidade e área infantil; investimento foi de R$ 1,2 milhão.",
		sectionSlug: "cidades",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T09:52:00-03:00",
		readingMinutes: 3,
		coverCaption: "Praça central reaberta ao público — Divulgação",
		tags: ["obras", "piracuruca", "cidades"],
		body: standardBody("a reforma da praça central"),
	},
	{
		slug: "operacao-apreende-carga-irregular-na-br-343",
		title: "Operação apreende carga irregular na BR-343",
		kicker: "POLÍCIA",
		standfirst:
			"Fiscalização parou dois veículos durante a madrugada; material foi encaminhado à delegacia regional.",
		sectionSlug: "policia",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T09:26:00-03:00",
		readingMinutes: 2,
		coverCaption: "Ponto de fiscalização na rodovia — Divulgação",
		tags: ["seguranca", "br-343", "piaui"],
		body: standardBody("a operação na rodovia"),
	},
	{
		slug: "time-da-casa-vence-classico-regional",
		title: "Time da casa vence clássico regional e assume a liderança",
		kicker: "ESPORTES",
		standfirst:
			"Vitória por 2 a 1 no estádio municipal coloca a equipe no topo da tabela a três rodadas do fim.",
		sectionSlug: "esportes",
		authorSlug: "daniel-oliveira",
		publishedAt: "2026-08-03T07:26:00-03:00",
		readingMinutes: 3,
		coverCaption: "Comemoração no estádio municipal — Divulgação",
		tags: ["futebol", "esportes", "piaui"],
		body: standardBody("a partida do clássico regional"),
	},
	{
		slug: "matriculas-da-rede-estadual-seguem-abertas",
		title: "Matrículas da rede estadual seguem abertas até sexta-feira",
		kicker: "EDUCAÇÃO",
		standfirst:
			"Atendimento acontece nas escolas e pelo portal da secretaria; vagas remanescentes serão divulgadas na semana seguinte.",
		sectionSlug: "educacao",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T06:26:00-03:00",
		readingMinutes: 2,
		coverCaption: "Secretaria escolar durante atendimento — Arquivo",
		tags: ["educacao", "matriculas", "piaui"],
		body: standardBody("o período de matrículas"),
	},
	{
		slug: "mutirao-de-exames-atende-12-bairros",
		title: "Mutirão de exames atende 12 bairros nesta semana",
		kicker: "SAÚDE",
		standfirst:
			"Ação percorre unidades básicas com exames preventivos e vacinação; atendimento é por ordem de chegada.",
		sectionSlug: "saude",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T05:26:00-03:00",
		readingMinutes: 2,
		coverCaption: "Unidade básica de saúde no bairro Centro — Divulgação",
		tags: ["saude", "mutirao", "piracuruca"],
		body: standardBody("o mutirão de exames"),
	},
	{
		slug: "camara-aprova-projeto-de-mobilidade-urbana",
		title: "Câmara aprova em segunda votação o projeto de mobilidade urbana",
		kicker: "POLÍTICA",
		standfirst:
			"Texto cria faixas exclusivas e prevê revisão do transporte coletivo em até doze meses.",
		sectionSlug: "politica",
		authorSlug: "mariano-wikoli",
		publishedAt: "2026-08-03T10:24:00-03:00",
		readingMinutes: 3,
		coverCaption: "Sessão na câmara municipal — Divulgação",
		tags: ["politica", "mobilidade", "camara"],
		body: standardBody("o projeto de mobilidade urbana"),
	},
	{
		slug: "assembleia-define-pauta-do-segundo-semestre",
		title: "Assembleia define pauta prioritária para o segundo semestre",
		kicker: "POLÍTICA",
		standfirst:
			"Lista inclui projetos de saneamento, segurança e revisão do plano plurianual do estado.",
		sectionSlug: "politica",
		authorSlug: "mariano-wikoli",
		publishedAt: "2026-08-03T10:05:00-03:00",
		readingMinutes: 3,
		coverCaption: "Plenário da assembleia legislativa — Divulgação",
		tags: ["politica", "assembleia", "piaui"],
		body: standardBody("a pauta do segundo semestre"),
	},
	{
		slug: "audiencia-publica-discute-plano-diretor",
		title: "Audiência pública discute plano diretor na próxima quinta",
		kicker: "POLÍTICA",
		standfirst:
			"Encontro é aberto à população e vai tratar do zoneamento urbano e das áreas de expansão da cidade.",
		sectionSlug: "politica",
		authorSlug: "mariano-wikoli",
		publishedAt: "2026-08-03T09:05:00-03:00",
		readingMinutes: 2,
		coverCaption: "Auditório onde acontece a audiência — Arquivo",
		tags: ["politica", "plano-diretor", "piracuruca"],
		body: standardBody("a audiência sobre o plano diretor"),
	},
	{
		slug: "comissao-apresenta-relatorio-sobre-convenios",
		title: "Comissão apresenta relatório sobre convênios municipais",
		kicker: "POLÍTICA",
		standfirst:
			"Documento analisa 42 convênios firmados nos últimos dois anos e aponta pendências de prestação de contas.",
		sectionSlug: "politica",
		authorSlug: "mariano-wikoli",
		publishedAt: "2026-08-03T08:12:00-03:00",
		readingMinutes: 4,
		coverCaption: "Reunião da comissão de fiscalização — Divulgação",
		tags: ["politica", "convenios", "fiscalizacao"],
		body: standardBody("o relatório sobre convênios"),
	},
	{
		slug: "obra-de-saneamento-chega-a-tres-bairros",
		title: "Obra de saneamento chega a três bairros da zona norte",
		kicker: "CIDADES",
		standfirst:
			"Serviço de esgotamento sanitário atende cerca de 4 mil moradores e deve ser concluído em dezembro.",
		sectionSlug: "cidades",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T10:02:00-03:00",
		readingMinutes: 3,
		coverCaption: "Frente de obra na zona norte — Divulgação",
		tags: ["saneamento", "obras", "cidades"],
		body: standardBody("a obra de saneamento"),
	},
	{
		slug: "plano-de-ciclovias-entra-em-consulta",
		title: "Plano de ciclovias entra em consulta pública nesta semana",
		kicker: "CIDADES",
		standfirst:
			"Proposta prevê 14 km de novas faixas ligando bairros da zona sul ao centro da cidade.",
		sectionSlug: "cidades",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T09:10:00-03:00",
		readingMinutes: 2,
		coverCaption: "Ciclovia existente na avenida principal — Arquivo",
		tags: ["mobilidade", "ciclovia", "cidades"],
		body: standardBody("o plano de ciclovias"),
	},
	{
		slug: "coleta-seletiva-chega-a-novos-bairros",
		title: "Coleta seletiva chega a novos bairros a partir de segunda",
		kicker: "CIDADES",
		standfirst:
			"Roteiro passa a incluir seis bairros, com coleta em dias alternados e ponto de entrega voluntária no centro.",
		sectionSlug: "cidades",
		authorSlug: "redacao",
		publishedAt: "2026-08-03T08:20:00-03:00",
		readingMinutes: 2,
		coverCaption: "Caminhão da coleta seletiva — Divulgação",
		tags: ["meio-ambiente", "coleta", "cidades"],
		body: standardBody("a ampliação da coleta seletiva"),
	},
];
