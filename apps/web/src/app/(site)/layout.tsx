import { AdSlot } from "@portal-app/ui/components/ad-slot";
import { Container } from "@portal-app/ui/components/container";

import { AnchorAd } from "@/components/layout/anchor-ad";
import { NewsTicker } from "@/components/layout/news-ticker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { TopBar } from "@/components/layout/top-bar";
import { JsonLd } from "@/components/seo/json-ld";
import { getSections, getTicker } from "@/data/queries";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import { organizationSchema } from "@/lib/structured-data";

/**
 * Revalidação do portal público.
 *
 * Sem isto o Next PRÉ-RENDERIZA as páginas no build e as congela: a home
 * publicada continuaria mostrando o que existia no banco no momento do deploy, e
 * toda matéria nova só apareceria depois de um novo build — inaceitável num
 * portal de notícias.
 *
 * 60 segundos é o compromisso: a matéria publicada entra no ar em até um minuto,
 * e o banco recebe no máximo uma consulta por página por minuto (importante com
 * Postgres serverless, que cobra por conexão/computação).
 *
 * O passo seguinte é trocar isto por invalidação POR EVENTO — o consumidor do
 * outbox chamando `revalidateTag` ao publicar, o que põe a matéria no ar na hora
 * e zera as consultas ociosas. Está registrado em `docs/pendencias.md`.
 */
export const revalidate = 60;

/**
 * Public portal shell.
 *
 * Já foi um `LivePlayerProvider` envolvendo tudo, para o `<audio>` sobreviver à
 * troca de rota. A transmissão ao vivo saiu do produto (a rádio se desvinculou),
 * então não há mais estado de player a segurar acima do layout — voltou a ser
 * uma árvore de RSCs sem cliente nenhum na moldura, que é o que o grupo `(site)`
 * quer ser.
 */
export default async function SiteLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const [sections, ticker, site] = await Promise.all([
		getSections(),
		getTicker(),
		loadSiteIdentity(),
	]);

	return (
		<>
			<div className="flex min-h-svh flex-col bg-canvas text-ink">
				<SkipLink />
				<TopBar />
				<SiteHeader />

				{/*
				  A trilha de editorias que ficava aqui saiu: a navegação inteira
				  passou para o botão MENU do cabeçalho (rota `/menu`), por decisão do
				  cliente. `sections` continua sendo carregado porque o RODAPÉ lista
				  todas — é o que mantém cada editoria a um link de distância de
				  qualquer página, para o leitor e para o rastreador.

				  Efeito colateral bem-vindo: `main-nav.tsx` era o único Client
				  Component da moldura (existia só por causa do `usePathname`). Sem
				  ele, o grupo `(site)` voltou a ser uma árvore de RSCs pura.
				*/}
				<NewsTicker articles={ticker} />

				{/* Onde o mockup põe o banner. Altura reservada pelo `AdSlot`, então
				    a entrada do criativo não desloca o conteúdo (CLS). */}
				<Container className="pt-4">
					<AdSlot format="billboard" className="mx-auto hidden md:block" />
				</Container>

				<main id="conteudo" className="flex-1">
					{children}
				</main>

				<SiteFooter sections={sections} />

				{/*
				  DENTRO da coluna, e como último item — não é arrumação, é o que faz
				  o `sticky` funcionar. Aqui fora ele não teria lugar no fluxo, e o
				  espaço voltaria a depender de um padding no wrapper, que é Server
				  Component e não fica sabendo que o leitor fechou o banner.
				*/}
				<AnchorAd />
			</div>

			<JsonLd schema={organizationSchema(site)} />
		</>
	);
}
