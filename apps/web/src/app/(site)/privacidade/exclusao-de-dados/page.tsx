import type { Metadata } from "next";
import Link from "next/link";

import { LegalPage } from "@/components/layout/legal-page";
import { loadSiteSettings } from "@/data/queries";
import { routes } from "@/lib/routes";
import { loadSiteIdentity } from "@/lib/seo/load-site-identity";
import { pageMetadata } from "@/lib/seo/metadata";

/**
 * Exclusão dos dados recebidos pelo login do Facebook.
 *
 * Existe porque a Meta exige, para aprovar o App, uma página que explique como
 * pedir a exclusão — e é para ELA que a Meta manda a pessoa depois de um pedido
 * (a rota `/api/social/meta/data-deletion` devolve esta URL com `?codigo=`).
 *
 * Não consulta estado nenhum: a exclusão é síncrona e termina antes de a Meta
 * receber a resposta. O código só é mostrado se tiver o formato que a rota
 * gera — texto arbitrário na URL não é repetido na página.
 *
 * Mesmo princípio da Política de Privacidade: o texto descreve o que o código
 * REALMENTE faz, e muda junto com ele.
 */
const UPDATED_AT = "2026-09-14";
const PATH = `${routes.privacy}/exclusao-de-dados`;

export async function generateMetadata(): Promise<Metadata> {
	const identity = await loadSiteIdentity();

	return pageMetadata({
		site: identity,
		title: "Exclusão de dados do Facebook e do Instagram",
		description: `Como pedir que a ${identity.name} apague os dados recebidos pela conexão com o Facebook e o Instagram, e como acompanhar o pedido.`,
		path: PATH,
		eyebrow: "Institucional",
	});
}

export default async function DataDeletionPage({
	searchParams,
}: {
	searchParams: Promise<{ codigo?: string | string[] }>;
}) {
	const [site, { codigo }] = await Promise.all([
		loadSiteSettings(),
		searchParams,
	]);
	const code =
		typeof codigo === "string" && /^[a-f0-9]{16}$/.test(codigo) ? codigo : null;
	const contact = site.contactEmail;

	return (
		<LegalPage
			eyebrow="Institucional"
			title="Exclusão de dados do Facebook e do Instagram"
			description={`Como pedir que o portal da ${site.name} apague o que recebeu da Meta.`}
			updatedAt={UPDATED_AT}
		>
			{code ? (
				<p>
					<strong>Pedido {code} concluído.</strong> Os dados foram apagados no
					instante em que o pedido chegou — não há etapa pendente. Guarde este
					código se quiser falar conosco sobre o pedido.
				</p>
			) : null}

			<h2>Quem é afetado</h2>
			<p>
				Apenas quem integra a equipe da {site.name} e conectou a Página do
				Facebook ou a conta profissional do Instagram do veículo ao painel da
				redação. Quem lê o portal não faz login com o Facebook e não tem dado
				nenhum recebido da Meta.
			</p>

			<h2>O que guardamos</h2>
			<ul>
				<li>
					O identificador, o nome e a foto da Página do Facebook e da conta do
					Instagram conectadas.
				</li>
				<li>
					A autorização de acesso concedida pela Meta, guardada cifrada e usada
					só para publicar as matérias em nome do veículo.
				</li>
			</ul>
			<p>
				Não guardamos dados do seu perfil pessoal, da sua lista de amigos,
				mensagens, seguidores ou métricas.
			</p>

			<h2>Como pedir a exclusão</h2>
			<p>
				Nas configurações do Facebook, abra <em>Apps e sites</em>, remova o
				aplicativo do portal e peça a exclusão dos dados. A Meta nos avisa, e a
				autorização guardada é apagada na hora; as contas aparecem como
				desconectadas no painel.{" "}
				{contact ? (
					<>
						Se preferir, escreva para{" "}
						<a href={`mailto:${contact}`}>{contact}</a>.
					</>
				) : (
					"Se preferir, use os canais de contato listados no rodapé do portal."
				)}
			</p>

			<h2>O que continua existindo</h2>
			<p>
				As publicações que já foram ao ar no Facebook e no Instagram pertencem
				às contas do veículo e permanecem nelas até serem apagadas lá. No
				painel, o histórico dessas publicações (texto e link de cada post)
				continua registrado, porque é registro do que o veículo publicou e não
				contém dado da sua conta pessoal.
			</p>

			<p>
				Veja também a <Link href={routes.privacy}>Política de Privacidade</Link>{" "}
				do portal.
			</p>
		</LegalPage>
	);
}
