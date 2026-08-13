import { AdSlot } from "@portal-app/ui/components/ad-slot";
import type { Metadata } from "next";

import { ContentWithSidebar } from "@/components/layout/content-with-sidebar";
import { MostReadList } from "@/components/news/most-read-list";
import { PageHeading } from "@/components/news/page-heading";
import { JsonLd } from "@/components/seo/json-ld";
import { PollCard } from "@/components/sidebar/poll-card";
import { PollResultCard } from "@/components/sidebar/poll-result-card";
import { loadClosedPolls, loadCurrentPoll } from "@/data/polls";
import { getMostRead } from "@/data/queries";
import { routes } from "@/lib/routes";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema } from "@/lib/structured-data";

export async function generateMetadata(): Promise<Metadata> {
	const site = await loadSiteIdentity();

	return pageMetadata({
		site,
		title: "Enquetes",
		description: `A enquete da semana da ${site.name} e o resultado das consultas já encerradas.`,
		path: routes.polls,
		eyebrow: "Audiência",
	});
}

/**
 * A página das enquetes: a que está no ar para votar, e o arquivo das
 * encerradas com o resultado.
 *
 * Dá destino ao "Enquetes" do rodapé, que era texto morto, e resolve um limite
 * real do card da barra lateral: ele mostra UMA enquete e some quando não há
 * nenhuma publicada — as anteriores, com todo o resultado que a redação
 * apurou, não apareciam em lugar nenhum do portal.
 *
 * A regra de "só vê o resultado quem votou" continua valendo para a enquete
 * ABERTA (o `PollCard` é o mesmo da home, e quem zera as porcentagens é o
 * servidor). Nas fechadas o número é aberto: não há mais voto para influenciar.
 */
export default async function PollsPage() {
	const [current, closed, mostRead, site] = await Promise.all([
		loadCurrentPoll(),
		loadClosedPolls(),
		getMostRead(),
		loadSiteIdentity(),
	]);

	return (
		<>
			<ContentWithSidebar
				gap="section"
				sidebar={
					<>
						<AdSlot format="sidebar" />
						<MostReadList articles={mostRead} />
					</>
				}
			>
				<PageHeading
					eyebrow="Audiência"
					title="Enquetes"
					description="O que a audiência da 7 Cidades pensa. Vote na consulta aberta e veja o resultado das anteriores."
				/>

				{current ? (
					<section className="mb-section">
						<h2 className="mb-2.5 font-mono text-[9px] text-brand-red uppercase tracking-[0.16em]">
							No ar agora
						</h2>
						<PollCard poll={current} />
					</section>
				) : null}

				<section>
					<h2 className="mb-2.5 font-mono text-[9px] text-meta uppercase tracking-[0.16em]">
						Enquetes encerradas
					</h2>

					{closed.length === 0 ? (
						/* Dois vazios diferentes, e a diferença importa: sem NENHUMA
						   enquete, a página explica o que ela é; com uma aberta e nenhuma
						   fechada, explica só que o arquivo ainda vai existir. */
						<p className="py-10 text-center text-ink-muted text-sm">
							{current
								? "Ainda não há enquetes encerradas. O resultado desta aparece aqui quando a redação fechar a consulta."
								: "Nenhuma enquete no ar e nenhuma encerrada ainda. Quando a redação publicar a primeira, ela aparece aqui e na home."}
						</p>
					) : (
						<ul className="flex flex-col gap-4">
							{closed.map((poll) => (
								<li key={poll.id}>
									<PollResultCard poll={poll} />
								</li>
							))}
						</ul>
					)}
				</section>
			</ContentWithSidebar>

			<JsonLd
				schema={breadcrumbSchema(site, [
					{ name: "Home", path: "/" },
					{ name: "Enquetes", path: routes.polls },
				])}
			/>
		</>
	);
}
