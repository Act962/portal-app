import { resolveStaff } from "@portal-app/api/staff";
import { can } from "@portal-app/identity";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { PermissionMatrix } from "./permission-matrix";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
	const { staff } = await resolveStaff(await headers());

	// Só quem pode gerenciar usuários (ADMIN, pela matriz) entra aqui.
	if (!staff || !staff.isActive() || !can(staff, "user:manage")) {
		redirect("/dashboard");
	}

	return (
		<div className="mx-auto max-w-4xl p-6">
			<h1 className="mb-4 font-bold text-2xl">Usuários</h1>
			<UsersTable />

			<h2 className="mt-10 mb-3 font-bold text-xl">Matriz de permissões</h2>
			<PermissionMatrix />
		</div>
	);
}
