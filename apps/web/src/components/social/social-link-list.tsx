import type { Link as SiteLinkData } from "@portal-app/settings";

import { SiteLink } from "@/components/layout/site-link";
import { SocialIcon } from "@/components/social/social-icon";
import { resolveNetwork } from "@/lib/social-networks";

/**
 * As redes do veículo, com ícone quando dá para saber qual rede é.
 *
 * Duas degradações, e as duas já existiam separadas — aqui elas se somam:
 *
 * 1. **Sem `href`**, o rótulo vira texto e não vira link (regra do `SiteLink`,
 *    D9): melhor do que um clique que não leva a lugar nenhum.
 * 2. **Com `href` mas sem rede reconhecida**, mostra o rótulo escrito. O
 *    administrador digita o nome à mão nas Configurações, então cedo ou tarde
 *    aparece um "Nosso canal" — e é melhor ler isso do que ver um ícone
 *    genérico que não diz nada, ou pior, o logo da rede errada.
 */
export function SocialLinkList({
	links,
	siteName,
	className,
	linkClassName,
	iconClassName = "size-4",
}: {
	links: readonly SiteLinkData[];
	/** Entra no nome acessível: "Rádio 7 Cidades no Instagram". */
	siteName: string;
	className?: string;
	linkClassName?: string;
	iconClassName?: string;
}) {
	return (
		<nav aria-label="Redes sociais" className={className}>
			{links.map((link) => {
				const network = link.href ? resolveNetwork(link.label) : null;

				if (!network) {
					return (
						<SiteLink
							key={link.label}
							link={{ ...link, label: link.label.toUpperCase() }}
							className={linkClassName}
						/>
					);
				}

				return (
					<a
						key={link.label}
						href={link.href}
						target="_blank"
						rel="noreferrer"
						aria-label={`${siteName} no ${link.label}`}
						className={linkClassName}
					>
						<SocialIcon network={network} className={iconClassName} />
					</a>
				);
			})}
		</nav>
	);
}
