import { AnchorAd } from "@/components/layout/anchor-ad";
import { MainNav } from "@/components/layout/main-nav";
import { NewsTicker } from "@/components/layout/news-ticker";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { SkipLink } from "@/components/layout/skip-link";
import { TopBar } from "@/components/layout/top-bar";
import { JsonLd } from "@/components/seo/json-ld";
import { getSections, getTicker } from "@/data/queries";
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
	const [sections, ticker] = await Promise.all([getSections(), getTicker()]);

	return (
		<>
			{/* Bottom padding clears the sticky anchor ad on small screens. */}
			<div className="flex min-h-svh flex-col bg-canvas pb-[68px] text-ink md:pb-0">
				<SkipLink />
				<TopBar />
				<SiteHeader />
				<MainNav sections={sections} />
				<NewsTicker articles={ticker} />

				<main id="conteudo" className="flex-1">
					{children}
				</main>

				<SiteFooter sections={sections} />
			</div>

			<AnchorAd />
			<JsonLd schema={organizationSchema()} />
		</>
	);
}
