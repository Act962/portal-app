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
	| "ScrollText"
	| "Radio"
	| "ChartLine"
	| "Vote"
	| "PenLine";

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
			// Fica na Redação, não em Administração: é insumo de pauta, e o
			// EDITOR também enxerga.
			{
				href: "/dashboard/insights",
				label: "Insights",
				icon: "ChartLine",
				action: "analytics:view",
			},
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
			// "Programação" (/dashboard/programacao) saiu do menu a pedido da
			// redação — a grade da rádio muda de mês em mês, não de hora em hora,
			// e o item ocupava lugar de coisa usada todo dia. A TELA CONTINUA DE
			// PÉ: quem precisa dela chega pelo endereço, e o rótulo do breadcrumb
			// segue abaixo justamente por isso. Voltar ao menu é reinserir estas
			// cinco linhas.
			{
				href: "/dashboard/colunistas",
				label: "Colunistas",
				icon: "PenLine",
				action: "columnists:manage",
			},
			{
				href: "/dashboard/enquetes",
				label: "Enquetes",
				icon: "Vote",
				action: "polls:manage",
			},
			{
				href: "/dashboard/users",
				label: "Equipe",
				icon: "Users",
				action: "user:manage",
			},
			{
				href: "/dashboard/settings",
				label: "Configurações",
				icon: "Settings",
				action: "settings:manage",
			},
			// "Anúncios" (/dashboard/campaigns) VOLTA AQUI quando o Bloco C
			// existir. Um item que leva a 404 é pior do que um item ausente:
			// parece defeito, não roadmap.
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
	"/dashboard/insights": "Insights",
	"/dashboard/taxonomy": "Editorias e tags",
	"/dashboard/programacao": "Programação",
	"/dashboard/colunistas": "Colunistas",
	"/dashboard/enquetes": "Enquetes",
	"/dashboard/users": "Equipe",
	"/dashboard/settings": "Configurações",
	"/dashboard/audit": "Auditoria",
};
