"use client";

import { Avatar, AvatarFallback } from "@portal-app/ui/components/avatar";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuGroup,
	DropdownMenuItem,
	DropdownMenuLabel,
	DropdownMenuSeparator,
	DropdownMenuTrigger,
} from "@portal-app/ui/components/dropdown-menu";
import {
	SidebarMenu,
	SidebarMenuButton,
	SidebarMenuItem,
	useSidebar,
} from "@portal-app/ui/components/sidebar";
import { ChevronsUpDown, ExternalLink, LogOut } from "lucide-react";
import { useRouter } from "next/navigation";

import { authClient } from "@/lib/auth-client";

export type AdminUser = {
	name: string;
	email: string;
	role: string;
	initials: string;
};

/** Rótulos dos papéis em português — `REDATOR` cru não é texto de interface. */
const ROLE_LABELS: Record<string, string> = {
	ADMIN: "Administrador",
	EDITOR: "Editor",
	REDATOR: "Redator",
};

export function AdminUserMenu({ user }: { user: AdminUser }) {
	const router = useRouter();
	const { isMobile } = useSidebar();

	return (
		<SidebarMenu>
			<SidebarMenuItem>
				<DropdownMenu>
					<DropdownMenuTrigger
						render={
							<SidebarMenuButton
								size="lg"
								className="data-[popup-open]:bg-sidebar-accent"
							/>
						}
					>
						<Avatar className="size-8 rounded-lg">
							<AvatarFallback className="rounded-lg bg-brand-accent text-on-accent text-xs">
								{user.initials}
							</AvatarFallback>
						</Avatar>
						<div className="grid flex-1 text-left leading-tight">
							<span className="truncate font-semibold text-sm">
								{user.name}
							</span>
							<span className="truncate text-muted-foreground text-xs">
								{ROLE_LABELS[user.role] ?? user.role}
							</span>
						</div>
						<ChevronsUpDown className="ml-auto size-4" />
					</DropdownMenuTrigger>

					<DropdownMenuContent
						className="min-w-56"
						side={isMobile ? "bottom" : "right"}
						align="end"
					>
						{/* O rótulo é um `GroupLabel` do Base UI: sem um Group em volta
						    ele lança "MenuGroupContext is missing". */}
						<DropdownMenuGroup>
							<DropdownMenuLabel className="font-normal">
								<div className="grid leading-tight">
									<span className="truncate font-semibold text-sm">
										{user.name}
									</span>
									<span className="truncate text-muted-foreground text-xs">
										{user.email}
									</span>
								</div>
							</DropdownMenuLabel>
						</DropdownMenuGroup>
						<DropdownMenuSeparator />
						{/* Âncora, não <Link>: a navegação client-side para o portal
						    carregaria o tema escuro do painel junto (o next-themes não
						    limpa a classe do <html> ao desmontar). */}
						<DropdownMenuItem
							render={
								// biome-ignore lint/a11y/useAnchorContent: conteúdo vem do item
								<a href="/" target="_blank" rel="noreferrer" />
							}
						>
							<ExternalLink />
							Ver o portal
						</DropdownMenuItem>
						<DropdownMenuSeparator />
						<DropdownMenuItem
							variant="destructive"
							onClick={() =>
								authClient.signOut({
									fetchOptions: { onSuccess: () => router.push("/login") },
								})
							}
						>
							<LogOut />
							Sair
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</SidebarMenuItem>
		</SidebarMenu>
	);
}
