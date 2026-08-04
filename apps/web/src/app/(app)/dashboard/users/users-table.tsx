"use client";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import { trpc } from "@/utils/trpc";

const ROLES = ["ADMIN", "EDITOR", "REDATOR"] as const;
type Role = (typeof ROLES)[number];

export function UsersTable() {
	const queryClient = useQueryClient();
	const users = useQuery(trpc.identity.users.list.queryOptions());

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.identity.users.list.queryKey(),
		});

	const setRole = useMutation(
		trpc.identity.users.setRole.mutationOptions({ onSuccess: invalidate }),
	);
	const deactivate = useMutation(
		trpc.identity.users.deactivate.mutationOptions({ onSuccess: invalidate }),
	);

	if (users.isLoading) {
		return <p>Carregando…</p>;
	}

	return (
		<table className="w-full border-collapse text-sm">
			<thead>
				<tr className="border-b text-left">
					<th className="py-2">E-mail</th>
					<th className="py-2">Papel</th>
					<th className="py-2">Status</th>
					<th className="py-2">Ações</th>
				</tr>
			</thead>
			<tbody>
				{users.data?.map((user) => (
					<tr key={user.id} className="border-b">
						<td className="py-2">{user.email}</td>
						<td className="py-2">
							<select
								value={user.role}
								disabled={!user.active}
								onChange={(event) =>
									setRole.mutate({
										staffId: user.id,
										role: event.target.value as Role,
									})
								}
							>
								{ROLES.map((role) => (
									<option key={role} value={role}>
										{role}
									</option>
								))}
							</select>
						</td>
						<td className="py-2">{user.active ? "ativo" : "inativo"}</td>
						<td className="py-2">
							{user.active ? (
								<button
									type="button"
									className="text-brand-red underline"
									onClick={() => deactivate.mutate({ staffId: user.id })}
								>
									Desativar
								</button>
							) : (
								<span className="text-ink-muted">—</span>
							)}
						</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
