import type { Action } from "@portal-app/identity";

/**
 * O modelo de navegação do painel — dados puros, sem JSX e sem componentes.
 *
 * O layout (RSC) filtra estes itens por `can()` e passa o resultado para a
 * sidebar (client). Por isso o ícone é o NOME do ícone e não o componente:
 * função não atravessa a fronteira servidor→cliente. A sidebar resolve o nome
 * num mapa local, o que também mantém o tree-shaking do lucide.
 */
export type NavIcon =
	| "LayoutDashboard"
	| "Newspaper"
	| "Image"
	| "Tags"
	| "Users"
	| "Megaphone"
	| "Settings"
	| "ScrollText";

export type NavItem = {
	href: string;
	label: string;
	icon: NavIcon;
	/** Permissão exigida. Sem isto, todo membro ativo vê o item. */
	action?: Action;
	/** Casa a rota ativa por prefixo (o padrão) ou só exata (a raiz). */
	exact?: boolean;
};

export type NavGroup = {
	label: string;
	items: NavItem[];
};

export const ADMIN_NAV: NavGroup[] = [
	{
		label: "Redação",
		items: [
			{
				href: "/dashboard",
				label: "Visão geral",
				icon: "LayoutDashboard",
				exact: true,
			},
			{ href: "/dashboard/articles", label: "Matérias", icon: "Newspaper" },
			{ href: "/dashboard/media", label: "Mídia", icon: "Image" },
		],
	},
	{
		label: "Administração",
		items: [
			{
				href: "/dashboard/taxonomy",
				label: "Editorias e tags",
				icon: "Tags",
				action: "taxonomy:manage",
			},
			{
				href: "/dashboard/users",
				label: "Equipe",
				icon: "Users",
				action: "user:manage",
			},
			// "Anúncios" (/dashboard/campaigns) e "Configurações"
			// (/dashboard/settings) VOLTAM AQUI quando os Blocos B e C existirem.
			// Estavam listados antes das telas, então o ADMIN — a única pessoa com
			// `settings:manage`, ou seja, o dono do portal — clicava e caía num 404.
			// Um item que não leva a lugar nenhum é pior do que um item ausente:
			// parece defeito, não roadmap. Os ícones seguem no `NavIcon` de
			// propósito, à espera deles.
			{
				href: "/dashboard/audit",
				label: "Auditoria",
				icon: "ScrollText",
				action: "audit:view",
			},
		],
	},
];

/** Rótulos das rotas, para o breadcrumb. Segmentos dinâmicos são resolvidos
 * pela própria página (ver `BreadcrumbTitle`). */
export const ROUTE_LABELS: Record<string, string> = {
	"/dashboard": "Visão geral",
	"/dashboard/articles": "Matérias",
	"/dashboard/media": "Mídia",
	"/dashboard/taxonomy": "Editorias e tags",
	"/dashboard/users": "Equipe",
	"/dashboard/audit": "Auditoria",
};
