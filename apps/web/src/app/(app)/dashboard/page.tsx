import { resolveStaff } from "@portal-app/api/staff";
import { can } from "@portal-app/identity";
import { headers } from "next/headers";
import Link from "next/link";
import { redirect } from "next/navigation";

import Dashboard from "./dashboard";

export default async function DashboardPage() {
	const { session, staff } = await resolveStaff(await headers());

	// Proteção de rota por identidade: só entra quem tem um StaffMember ativo.
	if (!session?.user || !staff || !staff.isActive()) {
		redirect("/login");
	}

	return (
		<div className="p-6">
			<h1 className="font-bold text-2xl">Dashboard</h1>
			<p>
				{session.user.name} — papel: {staff.role}
			</p>
			{can(staff, "user:manage") ? (
				<Link href="/dashboard/users" className="text-brand-red underline">
					Gerenciar usuários
				</Link>
			) : null}
			<Dashboard />
		</div>
	);
}
