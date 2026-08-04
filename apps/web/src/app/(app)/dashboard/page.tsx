import { resolveStaff } from "@portal-app/api/staff";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import Dashboard from "./dashboard";

export default async function DashboardPage() {
	const { session, staff } = await resolveStaff(await headers());

	// Proteção de rota por identidade: só entra quem tem um StaffMember ativo.
	if (!session?.user || !staff || !staff.isActive()) {
		redirect("/login");
	}

	return (
		<div>
			<h1>Dashboard</h1>
			<p>
				{session.user.name} — papel: {staff.role}
			</p>
			<Dashboard />
		</div>
	);
}
