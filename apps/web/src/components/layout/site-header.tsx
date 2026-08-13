import { Container } from "@portal-app/ui/components/container";
import { Search } from "lucide-react";
import Image from "next/image";
import Link from "next/link";

import { SiteLogo } from "@/components/layout/site-logo";
import { SiteMenu } from "@/components/layout/site-menu";
import { getSections, loadSiteSettings } from "@/data/queries";
import { routes } from "@/lib/routes";

/**
 * Masthead do portal.
 *
 * Três zonas em GRADE, não em flex: `1fr auto 1fr` é o que mantém a marca
 * opticamente centrada mesmo com "MENU" de um lado e um botão redondo do outro.
 * Com `flex` + `flex-1` o centro escorrega alguns pixels a cada mudança de
 * rótulo — e marca desalinhada é a primeira coisa que se nota num cabeçalho.
 *
 * **Fixo no topo** porque a trilha de editorias saiu do layout: sem ela, este
 * cabeçalho é o único acesso a navegação e busca, e um leitor no meio de uma
 * matéria longa não deveria ter de voltar ao início da página para alcançá-los.
 */
export async function SiteHeader() {
	// As duas leituras são `cache()` do React e o layout já as fez para o rodapé
	// — aqui elas custam a chamada, não a consulta.
	const [site, sections] = await Promise.all([
		loadSiteSettings(),
		getSections(),
	]);

	return (
		<header className="sticky top-0 z-30 overflow-hidden bg-brand-deep">
			{/*
			  Os grafismos rupestres da marca — a referência ao Parque Nacional de
			  Sete Cidades que dá nome ao veículo. Vieram na pasta de identidade
			  junto com uma faixa que já era, em essência, este cabeçalho.

			  Decorativo e nada mais: `aria-hidden`, atrás de tudo (`-z-10`) e a
			  20% de opacidade, para texturizar sem disputar com a marca. Some
			  abaixo de `lg`, onde a largura já é do logo e do menu.
			*/}
			<Image
				src="/brand/rupestre.png"
				alt=""
				aria-hidden
				width={900}
				height={186}
				// Sem isto o Next serve a variante de 1920px para uma faixa que é
				// desenhada com 310 — 48 KB por um enfeite, mais do que o PNG
				// original pesa.
				sizes="310px"
				className="pointer-events-none absolute top-1/2 right-0 -z-10 hidden h-16 w-auto -translate-y-1/2 opacity-20 lg:block"
			/>

			<Container className="grid h-14 grid-cols-[1fr_auto_1fr] items-center gap-3 md:h-20 md:gap-6">
				{/*
				  Rótulo escrito, não só o ícone. Com a trilha de editorias fora, este
				  botão passou a ser O caminho para o conteúdo do portal — e o
				  hambúrguer sozinho é reconhecido por muito menos gente do que se
				  costuma supor.
				*/}
				<SiteMenu sections={sections} institutional={site.institutional} />

				<Link
					href={routes.home}
					className="justify-self-center transition-opacity hover:opacity-90"
				>
					<SiteLogo />
					{/* A marca vai com `alt=""`; o nome acessível do link é este. */}
					<span className="sr-only">{site.name} — página inicial</span>
				</Link>

				<Link
					href={routes.search}
					aria-label="Buscar"
					className="flex size-11 items-center justify-center justify-self-end rounded-full bg-surface text-brand-deep transition-colors hover:bg-on-brand-soft"
				>
					<Search size={20} aria-hidden />
				</Link>
			</Container>
		</header>
	);
}
