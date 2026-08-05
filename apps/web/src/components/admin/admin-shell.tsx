"use client";

import {
	SidebarInset,
	SidebarProvider,
} from "@portal-app/ui/components/sidebar";

import type { NavGroup } from "@/lib/admin-nav";

import { AdminTopbar } from "./admin-topbar";
import { type AdminUser, AdminUserMenu } from "./admin-user-menu";
import { AppSidebar } from "./app-sidebar";

export type { AdminUser };

/**
 * Casca do painel. A navegação já chega FILTRADA pelo servidor (o layout aplica
 * `can()`), porque `StaffMember` é uma classe e não atravessa a fronteira RSC —
 * e importar o contexto de identidade aqui arrastaria o pacote para o bundle.
 */
export function AdminShell({
	groups,
	user,
	defaultOpen,
	children,
}: {
	groups: NavGroup[];
	user: AdminUser;
	defaultOpen: boolean;
	children: React.ReactNode;
}) {
	return (
		<SidebarProvider defaultOpen={defaultOpen}>
			<AppSidebar groups={groups} user={user} />
			<SidebarInset>
				<AdminTopbar />
				<div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
			</SidebarInset>
		</SidebarProvider>
	);
}

/** Reexportado para o menu de usuário poder ser usado fora da sidebar. */
export { AdminUserMenu };
