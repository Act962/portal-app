import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/layout/legal-page";
import { JsonLd } from "@/components/seo/json-ld";
import { loadSiteSettings } from "@/data/queries";
import { routes } from "@/lib/routes";
import { breadcrumbSchema } from "@/lib/structured-data";

/**
 * Termos de Uso. Estático e versionado, pelas mesmas razões da Política de
 * Privacidade — ver o comentário de `privacidade/page.tsx`.
 */
const UPDATED_AT = "2026-08-12";

export const metadata: Metadata = {
	title: "Termos de Uso",
	description:
		"As regras de uso do portal da Rádio 7 Cidades: direitos sobre o conteúdo, o que é permitido reproduzir, correções e responsabilidades.",
	alternates: { canonical: routes.terms },
};

export default async function TermsPage() {
	const site = await loadSiteSettings();
	const contact = site.contactEmail;

	return (
		<>
			<LegalPage
				eyebrow="Institucional"
				title="Termos de Uso"
				description={`As regras de uso do portal da ${site.name}.`}
				updatedAt={UPDATED_AT}
			>
				<p>
					Ao acessar o portal da {site.name}, você concorda com os termos
					abaixo. Se não concordar com algum deles, não utilize o site.
				</p>

				<h2>O que é este portal</h2>
				<p>
					Um veículo de comunicação jornalística que publica notícias, análises
					e informações de serviço sobre {site.city} e região. O acesso ao
					conteúdo é gratuito e não exige cadastro.
				</p>

				<h2>Direitos sobre o conteúdo</h2>
				<p>
					Os textos, fotografias, artes e demais materiais publicados são
					protegidos por direito autoral e pertencem à {site.name} ou a quem
					nos licenciou o uso. Isso vale igualmente para o material assinado por
					colunistas, cujos direitos permanecem com seus autores.
				</p>

				<h3>O que você pode fazer</h3>
				<ul>
					<li>
						Ler, imprimir e compartilhar links para as matérias, inclusive em
						redes sociais e aplicativos de mensagem.
					</li>
					<li>
						Citar trechos curtos em trabalhos, comentários ou reportagens,
						desde que identifique a {site.name} como fonte e inclua o link para
						a matéria original.
					</li>
				</ul>

				<h3>O que você não pode fazer</h3>
				<ul>
					<li>
						Reproduzir matérias na íntegra em outro site, blog, boletim ou
						perfil, ainda que com crédito, sem autorização prévia por escrito.
					</li>
					<li>
						Usar nossas fotografias e artes separadamente do contexto em que
						foram publicadas.
					</li>
					<li>
						Alterar o conteúdo e continuar atribuindo-o a nós, ou apresentá-lo
						de forma que sugira endosso do veículo a produto, serviço ou
						candidatura.
					</li>
					<li>
						Coletar o conteúdo de forma automatizada em escala, inclusive para
						treinar modelos de linguagem, sem autorização prévia por escrito.
					</li>
				</ul>
				<p>
					Pedidos de autorização e propostas de parceria de conteúdo podem ser
					enviados{" "}
					{contact ? (
						<>
							para <a href={`mailto:${contact}`}>{contact}</a>
						</>
					) : (
						"pelos canais de contato do rodapé"
					)}
					.
				</p>

				<h2>Compromisso editorial e correções</h2>
				<p>
					Apuramos as informações antes de publicar e assinamos o que
					publicamos. Ainda assim, erros acontecem. Matérias corrigidas ou
					atualizadas depois da publicação exibem a data da atualização junto à
					assinatura — não reescrevemos o passado em silêncio.
				</p>
				<p>
					Se você identificou um erro, entre em contato com a redação. Erros de
					fato são corrigidos assim que verificados.
				</p>

				<h2>Opinião e conteúdo de colunistas</h2>
				<p>
					Artigos de opinião e colunas assinadas expressam a posição de quem os
					assina, que não coincide necessariamente com a do veículo. Eles são
					publicados identificados como tal.
				</p>

				<h2>Publicidade</h2>
				<p>
					Espaços publicitários são identificados como publicidade e mantidos
					visualmente separados do conteúdo jornalístico. Anunciar no portal não
					dá ao anunciante nenhuma influência sobre a cobertura.
				</p>

				<h2>Enquetes</h2>
				<p>
					As enquetes do portal medem a opinião de quem escolheu responder. Não
					são pesquisas de opinião com metodologia estatística e não devem ser
					lidas como representativas da população. Cada navegador pode votar uma
					única vez por consulta.
				</p>

				<h2>Links para outros sites</h2>
				<p>
					Matérias podem levar a sites de terceiros, citados como fonte ou
					referência. Não temos controle sobre o conteúdo, a disponibilidade ou
					as práticas desses sites e não respondemos por eles.
				</p>

				<h2>Disponibilidade do serviço</h2>
				<p>
					Trabalhamos para manter o portal no ar de forma contínua, mas não há
					garantia de funcionamento ininterrupto: manutenções, falhas de
					infraestrutura e indisponibilidades de fornecedores podem ocorrer.
				</p>

				<h2>Dados pessoais</h2>
				<p>
					O tratamento de dados está descrito na{" "}
					<Link href={routes.privacy}>Política de Privacidade</Link>, que é
					parte integrante destes termos.
				</p>

				<h2>Alterações destes termos</h2>
				<p>
					Estes termos podem ser atualizados. A data de última atualização no
					topo indica a versão vigente, e o uso do portal após uma alteração
					significa concordância com o texto em vigor.
				</p>

				<h2>Foro</h2>
				<p>
					Aplica-se a legislação brasileira. Fica eleito o foro da comarca de{" "}
					{site.city} — {site.state} para dirimir questões decorrentes destes
					termos.
				</p>
			</LegalPage>

			<JsonLd
				schema={breadcrumbSchema([
					{ name: "Home", path: "/" },
					{ name: "Termos de Uso", path: routes.terms },
				])}
			/>
		</>
	);
}
