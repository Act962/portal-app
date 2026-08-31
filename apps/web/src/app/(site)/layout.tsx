import { Container } from "@portal-app/ui/components/container";
import Script from "next/script";

import { AdPlacement } from "@/components/ads/ad-placement";
import { AnchorAd } from "@/components/layout/anchor-ad";
import { NewsTicker } from "@/components/layout/news-ticker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { TopBar } from "@/components/layout/top-bar";
import { JsonLd } from "@/components/seo/json-ld";
import { getAdSenseScript, hasAdFor } from "@/data/ads";
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
	const [sections, ticker, site, adsense] = await Promise.all([
		getSections(),
		getTicker(),
		loadSiteIdentity(),
		getAdSenseScript(),
	]);
	const anchorAd = await hasAdFor("anchor-mobile", null);

	return (
		<>
			{/*
			  O script do Google só entra quando o AdSense está LIGADO e configurado
			  — desligado no painel, nenhuma requisição sai para o Google em página
			  nenhuma. É o que permite cortar a monetização num clique, sem deploy.

			  `afterInteractive`: depois da página estar utilizável. Publicidade não
			  pode competir com o carregamento da notícia, que é o produto
			  (ui-ux.md §1).
			*/}
			{adsense ? (
				<Script
					id="adsense"
					strategy="afterInteractive"
					async
					src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adsense.publisherId}`}
					crossOrigin="anonymous"
				/>
			) : null}

			<div className="flex min-h-svh flex-col bg-canvas text-ink">
				<SkipLink />
				<TopBar />
				<SiteHeader />

				{/*
				  A trilha de editorias que ficava aqui saiu: a navegação inteira
				  passou para o botão MENU do cabeçalho, que abre o painel lateral
				  (`site-menu.tsx`), por decisão do cliente. `sections` continua sendo
				  carregado porque o RODAPÉ lista todas — e é ELE que mantém cada
				  editoria a um link de distância no HTML de qualquer página. O painel
				  não serve para isso: o conteúdo de um `Sheet` fechado não existe no
				  documento, então o rastreador não o vê.
				*/}
				<NewsTicker articles={ticker} />

				{/*
				  Onde o mockup põe o banner. A altura é reservada pelo `AdPlacement`,
				  então a entrada do criativo não desloca o conteúdo (CLS).

				  O ESPAÇAMENTO (`pt-4`) e a visibilidade (`hidden md:block`) moram no
				  ANÚNCIO, não no contêiner. Já foi o contrário, e o `pt-4` no contêiner
				  virava uma faixa branca de 16px entre o cabeçalho e a manchete no
				  celular — espaço reservado para algo que nunca aparecia naquela
				  largura. Agora o `AdPlacement` não renderiza NADA quando não há
				  anúncio, e o mesmo defeito voltaria por outro caminho: a faixa
				  apareceria em toda tela sem campanha, em qualquer largura. Com as
				  duas classes no anúncio, sumir o anúncio some o espaço junto.

				  O `Container` fica: ele só tem margem horizontal, então vazio ele
				  não ocupa altura nenhuma.
				*/}
				<Container>
					<AdPlacement
						slot="billboard"
						className="mx-auto hidden pt-4 md:block"
					/>
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
				{/* Sem anúncio para a âncora, a barra inteira não existe — nem o
				    botão de fechar. Quem pergunta é o SERVIDOR, porque o `AnchorAd` é
				    cliente e não pode consultar banco; o `cache()` faz esta leitura e
				    a do `AdPlacement` logo abaixo serem a mesma. */}
				{anchorAd ? (
					<AnchorAd>
						<AdPlacement slot="anchor-mobile" />
					</AnchorAd>
				) : null}
			</div>

			<JsonLd schema={organizationSchema(site)} />
		</>
	);
}
