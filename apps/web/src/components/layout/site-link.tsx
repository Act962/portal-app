import type { Link as SiteLinkData } from "@portal-app/settings";

/**
 * Um destino configurável do rodapé, do topo ou das redes (spec 05b, D9).
 *
 * **Sem `href`, não vira `<a>`.** Os seis links institucionais apontavam todos
 * para `#institucional`, uma âncora que não existe: o leitor clicava e nada
 * acontecia, o que faz o portal parecer quebrado. Enquanto o cliente não
 * preenche o destino, o rótulo aparece como texto — honesto e sem convite falso
 * ao clique.
 *
 * Destino externo abre em nova aba; caminho interno (`/quem-somos`) navega no
 * próprio portal.
 */
export function SiteLink({
	link,
	className,
}: {
	link: SiteLinkData;
	className?: string;
}) {
	if (!link.href) {
		return <span className={className}>{link.label}</span>;
	}

	const isExternal = link.href.startsWith("http");

	return (
		<a
			href={link.href}
			className={className}
			{...(isExternal ? { rel: "noreferrer", target: "_blank" } : {})}
		>
			{link.label}
		</a>
	);
}
