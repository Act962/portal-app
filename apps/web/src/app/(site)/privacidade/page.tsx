import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/layout/legal-page";
import { JsonLd } from "@/components/seo/json-ld";
import { getAdSenseScript } from "@/data/ads";
import { loadSiteSettings } from "@/data/queries";
import { routes } from "@/lib/routes";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import { pageMetadata } from "@/lib/seo/metadata";
import { breadcrumbSchema } from "@/lib/structured-data";

/**
 * Política de Privacidade.
 *
 * Texto ESTÁTICO, versionado no git de propósito: é um documento com efeito
 * jurídico, muda raramente, e cada alteração precisa deixar rastro de quando e
 * por quem — que é exatamente o que um campo editável no painel não dá.
 *
 * O conteúdo descreve o que o portal REALMENTE faz hoje, não um modelo
 * genérico: sem conta de leitor, sem newsletter, sem rastreador de terceiro; o
 * log de leitura não guarda IP nem user-agent (decisão N09) e o voto da enquete
 * usa um token anônimo. Se qualquer uma dessas coisas mudar, este texto muda
 * junto — é por isso que ele mora ao lado do código.
 *
 * O nome e o contato saem das Configurações para não divergirem do rodapé.
 */
const UPDATED_AT = "2026-08-31";

export async function generateMetadata(): Promise<Metadata> {
	const identity = await loadSiteIdentity();

	return pageMetadata({
		site: identity,
		title: "Política de Privacidade",
		description: `Como a ${identity.name} trata os dados de quem navega no portal: o que é coletado, por quê, por quanto tempo e quais são os seus direitos pela LGPD.`,
		path: routes.privacy,
		eyebrow: "Institucional",
	});
}

export default async function PrivacyPage() {
	// A seção de publicidade descreve o que está REALMENTE ligado. Sem isto o
	// texto seria falso numa das duas pontas: prometeria cookies que não existem
	// enquanto o AdSense estivesse desligado, ou negaria rastreadores que
	// passaram a existir depois de ligado. É o mesmo princípio que fez este
	// documento morar ao lado do código.
	const [site, identity, adsense] = await Promise.all([
		loadSiteSettings(),
		loadSiteIdentity(),
		getAdSenseScript(),
	]);
	const contact = site.contactEmail;

	return (
		<>
			<LegalPage
				eyebrow="Institucional"
				title="Política de Privacidade"
				description={`Como o portal da ${site.name} trata os dados de quem navega aqui.`}
				updatedAt={UPDATED_AT}
			>
				<p>
					Esta política explica quais dados o portal da {site.name} coleta
					quando você navega, para que eles servem e o que você pode exigir a
					respeito deles. Ela segue a Lei Geral de Proteção de Dados Pessoais
					(Lei nº 13.709/2018).
				</p>

				<h2>O resumo, antes do detalhe</h2>
				<p>
					Não é preciso criar conta para ler o portal, não há cadastro de leitor
					e não enviamos newsletter. Não pedimos nome, telefone, CPF nem
					endereço para nada do que está disponível publicamente aqui. O que
					medimos é o comportamento AGREGADO de leitura — quantas pessoas
					abriram cada matéria —, e essa medição foi construída para não
					identificar ninguém.
				</p>

				<h2>O que coletamos</h2>

				<h3>Medição de audiência</h3>
				<p>
					Quando você abre uma matéria, registramos que aquela matéria foi lida,
					em que dia, por quanto tempo aproximadamente e de que tipo de origem
					você chegou (busca, rede social, link direto ou navegação dentro do
					próprio portal). É o que alimenta a lista de “mais lidas” e os
					relatórios internos da redação.
				</p>
				<p>
					Esse registro <strong>não guarda o seu endereço IP</strong>, não
					guarda o seu navegador ou sistema operacional e não guarda nenhum
					identificador que ligue duas leituras à mesma pessoa. A origem do
					acesso é classificada no servidor e o endereço completo é descartado
					em seguida — guardamos apenas a categoria. Na prática, o registro diz
					“uma pessoa leu esta matéria hoje”, e não quem.
				</p>

				<h3>Voto em enquetes</h3>
				<p>
					Se você votar em uma enquete, gravamos um cookie no seu navegador com
					um código aleatório. Ele existe por um único motivo: impedir que o
					mesmo navegador vote duas vezes na mesma consulta. Esse código não é
					ligado ao seu nome, e-mail ou qualquer outro dado, e não é usado para
					nenhuma outra finalidade.
				</p>

				<h3>Acesso ao painel de administração</h3>
				<p>
					A área restrita da redação (login e painel) usa cookies de sessão para
					manter a pessoa autenticada. Ela é destinada apenas à equipe do
					veículo e não faz parte da navegação pública.
				</p>

				<h2>Cookies</h2>
				<p>Usamos apenas cookies necessários ao funcionamento do portal:</p>
				<ul>
					<li>
						<strong>Voto em enquete</strong> — código aleatório que evita voto
						repetido. Expira em um ano.
					</li>
					<li>
						<strong>Sessão de administração</strong> — mantém a equipe
						autenticada no painel. Só é criado após login.
					</li>
					{adsense ? (
						<li>
							<strong>Publicidade do Google</strong> — o portal exibe anúncios
							do Google AdSense, que grava cookies próprios no seu navegador
							para medir exibições e limitar a repetição do mesmo anúncio.
						</li>
					) : null}
				</ul>
				<p>
					{adsense
						? "Não vendemos dados de navegação. Os anúncios do Google são pedidos na modalidade não personalizada: são escolhidos pelo conteúdo da página que você está lendo, e não por um perfil montado a partir do seu histórico de navegação. Ainda assim, o Google grava cookies próprios para medição e controle de frequência."
						: "Não usamos cookies de publicidade comportamental, não vendemos dados de navegação e não incorporamos rastreadores de terceiros para perfilamento."}{" "}
					Você pode apagar os cookies do portal a qualquer momento pelas
					configurações do seu navegador; a única consequência é que uma enquete
					em que você já votou voltará a aceitar o seu voto.
				</p>
				{adsense ? (
					<p>
						Para controlar a publicidade do Google diretamente com ele, use as{" "}
						<a
							href="https://adssettings.google.com/"
							target="_blank"
							rel="noreferrer"
						>
							configurações de anúncios da sua Conta Google
						</a>
						. Já os anúncios vendidos diretamente pela {site.name} a anunciantes
						locais não usam cookies: contamos apenas quantas vezes cada peça foi
						exibida e clicada, sem identificar quem viu.
					</p>
				) : null}

				<h2>Com quem os dados são compartilhados</h2>
				<p>
					Com ninguém para fins comerciais. Utilizamos fornecedores de
					infraestrutura (hospedagem, banco de dados e armazenamento de imagens)
					que processam os dados exclusivamente para manter o portal no ar, sob
					nossa instrução. Podemos compartilhar informações quando houver
					obrigação legal ou determinação judicial.
				</p>

				<h2>Por quanto tempo guardamos</h2>
				<p>
					Os registros de audiência são mantidos enquanto forem úteis à análise
					editorial e podem ser descartados a qualquer momento — como são
					anônimos, não há como recuperá-los ou associá-los a uma pessoa depois
					de gravados. O cookie de voto expira em um ano. Dados de contas da
					equipe são mantidos enquanto a pessoa integrar a redação.
				</p>

				<h2>Seus direitos</h2>
				<p>
					A LGPD garante a você o direito de confirmar a existência de
					tratamento, acessar seus dados, corrigi-los, solicitar anonimização,
					bloqueio ou eliminação, e revogar consentimento. Aplicado a este
					portal, isso tem um limite prático que preferimos declarar de forma
					honesta:{" "}
					<strong>
						a navegação pública não gera dados que identifiquem você
					</strong>
					, de modo que não temos como localizar “os seus dados” para exibir ou
					apagar — não porque nos recusemos, mas porque eles não existem em
					forma identificável.
				</p>
				<p>
					Se você entrou em contato conosco por e-mail, WhatsApp ou telefone, ou
					se integra ou integrou a equipe, esses dados existem e os direitos
					acima se aplicam integralmente.
				</p>

				<h2>Conteúdo de terceiros</h2>
				<p>
					Matérias podem conter links para outros sites. Ao segui-los, você
					passa a estar sujeito à política de privacidade daquele site, sobre a
					qual não temos controle.{" "}
					{adsense
						? "O mesmo vale para os anúncios: ao clicar em um deles você vai para o site do anunciante, que tem política própria."
						: ""}
				</p>

				<h2>Crianças e adolescentes</h2>
				<p>
					O portal é de conteúdo jornalístico geral e não é dirigido a crianças.
					Não coletamos conscientemente dados de menores de idade.
				</p>

				<h2>Mudanças nesta política</h2>
				<p>
					Se o portal passar a coletar algo diferente do descrito aqui, este
					texto será atualizado antes da mudança entrar no ar, e a data de
					última atualização no topo refletirá isso.
				</p>

				<h2>Como falar conosco</h2>
				<p>
					Dúvidas, pedidos ou reclamações relacionados a dados pessoais podem
					ser enviados{" "}
					{contact ? (
						<>
							para <a href={`mailto:${contact}`}>{contact}</a>
						</>
					) : (
						"pelos canais de contato listados no rodapé do portal"
					)}
					. Também respondemos pelos demais canais da redação.
				</p>

				<p>
					Veja também os <Link href={routes.terms}>Termos de Uso</Link> do
					portal.
				</p>
			</LegalPage>

			<JsonLd
				schema={breadcrumbSchema(identity, [
					{ name: "Home", path: "/" },
					{ name: "Política de Privacidade", path: routes.privacy },
				])}
			/>
		</>
	);
}
