import { can } from "@portal-app/identity";
import { cookies } from "next/headers";

import { AdminShell } from "@/components/admin/admin-shell";
import { ADMIN_NAV } from "@/lib/admin-nav";
import { requireStaff } from "@/lib/require-staff";

/**
 * Casca do painel.
 *
 * Vive aqui, e não em `(app)/layout.tsx`, porque `/login` também mora no grupo
 * `(app)` — e uma tela de login com sidebar não faria sentido.
 *
 * A navegação é filtrada NO SERVIDOR: `can()` é uma função pura, mas
 * `StaffMember` é uma classe e não serializa para o cliente. O que desce é uma
 * lista simples de itens já autorizados.
 */
export default async function DashboardLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	const { staff, user } = await requireStaff();

	const groups = ADMIN_NAV.map((group) => ({
		...group,
		items: group.items.filter((item) => !item.action || can(staff, item.action)),
	})).filter((group) => group.items.length > 0);

	// O estado da sidebar persiste em cookie, lido no servidor para a primeira
	// pintura já sair com a largura certa (sem "pulo" na hidratação).
	const defaultOpen = (await cookies()).get("sidebar_state")?.value !== "false";

	return (
		<AdminShell
			groups={groups}
			user={{
				name: user.name,
				email: user.email,
				role: staff.role,
				initials: initialsOf(user.name || user.email),
			}}
			defaultOpen={defaultOpen}
		>
			{children}
		</AdminShell>
	);
}

function initialsOf(value: string): string {
	const parts = value.trim().split(/\s+/).filter(Boolean);
	if (parts.length === 0) {
		return "?";
	}
	const first = parts[0]?.[0] ?? "";
	const last = parts.length > 1 ? (parts.at(-1)?.[0] ?? "") : "";
	return (first + last).toUpperCase();
}
