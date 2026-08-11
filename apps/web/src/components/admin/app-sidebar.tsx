"use client";

import {
	Sidebar,
	SidebarContent,
	SidebarFooter,
	SidebarGroup,
	SidebarGroupContent,
	SidebarGroupLabel,
	SidebarHeader,
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	SidebarRail,
} from "@portal-app/ui/components/sidebar";
import {
	ChartLine,
	Image as ImageIcon,
	LayoutDashboard,
	Megaphone,
	Newspaper,
	PenLine,
	Radio,
	ScrollText,
	Settings,
	Tags,
	Users,
	Vote,
} from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { siteConfig } from "@/config/site";
import type { NavGroup, NavIcon } from "@/lib/admin-nav";

import { type AdminUser, AdminUserMenu } from "./admin-user-menu";

/**
 * Mapa de ícones. A navegação chega do servidor como dados puros (o NOME do
 * ícone), porque componente não atravessa a fronteira RSC — a resolução é aqui.
 */
const ICONS: Record<NavIcon, typeof LayoutDashboard> = {
	LayoutDashboard,
	Newspaper,
	Image: ImageIcon,
	Tags,
	Users,
	Megaphone,
	Settings,
	ScrollText,
	Radio,
	ChartLine,
	Vote,
	PenLine,
};

export function AppSidebar({
	groups,
	user,
}: {
	groups: NavGroup[];
	user: AdminUser;
}) {
	const pathname = usePathname();

	return (
		<Sidebar collapsible="icon" variant="inset">
			<SidebarHeader>
				<SidebarMenu>
					<SidebarMenuItem>
						<SidebarMenuButton
							size="lg"
							tooltip={siteConfig.name}
							render={<Link href="/dashboard" />}
						>
							<div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-brand-red text-white">
								<Radio className="size-4" />
							</div>
							<div className="grid flex-1 text-left leading-tight">
								<span className="truncate font-semibold text-sm">
									{siteConfig.shortName}
								</span>
								<span className="truncate text-muted-foreground text-xs">
									Painel da redação
								</span>
							</div>
						</SidebarMenuButton>
					</SidebarMenuItem>
				</SidebarMenu>
			</SidebarHeader>

			<SidebarContent>
				{groups.map((group) => (
					<SidebarGroup key={group.label}>
						<SidebarGroupLabel>{group.label}</SidebarGroupLabel>
						<SidebarGroupContent>
							<SidebarMenu>
								{group.items.map((item) => {
									const Icon = ICONS[item.icon];
									const isActive = item.exact
										? pathname === item.href
										: pathname.startsWith(item.href);

									return (
										<SidebarMenuItem key={item.href}>
											<SidebarMenuButton
												isActive={isActive}
												tooltip={item.label}
												render={<Link href={item.href as Route} />}
											>
												<Icon />
												<span>{item.label}</span>
											</SidebarMenuButton>
										</SidebarMenuItem>
									);
								})}
							</SidebarMenu>
						</SidebarGroupContent>
					</SidebarGroup>
				))}
			</SidebarContent>

			<SidebarFooter>
				<AdminUserMenu user={user} />
			</SidebarFooter>

			<SidebarRail />
		</Sidebar>
	);
}
