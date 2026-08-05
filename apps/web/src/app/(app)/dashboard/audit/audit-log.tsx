"use client";
import { useQuery } from "@tanstack/react-query";

import { trpc } from "@/utils/trpc";

export function AuditLog() {
	const audit = useQuery(trpc.editorial.audit.list.queryOptions());

	if (audit.isLoading) {
		return <p>Carregando…</p>;
	}
	if (!audit.data || audit.data.length === 0) {
		return <p className="text-ink-muted">Nenhum evento registrado ainda.</p>;
	}

	return (
		<table className="w-full border-collapse text-sm">
			<thead>
				<tr className="border-b text-left">
					<th className="py-2">Quando</th>
					<th className="py-2">Ação</th>
					<th className="py-2">Matéria</th>
				</tr>
			</thead>
			<tbody>
				{audit.data.map((entry) => (
					<tr key={entry.id} className="border-b">
						<td className="py-2 text-ink-muted">
							{new Date(entry.createdAt).toLocaleString("pt-BR")}
						</td>
						<td className="py-2 font-medium">{entry.action}</td>
						<td className="py-2 text-ink-muted">{entry.aggregateId}</td>
					</tr>
				))}
			</tbody>
		</table>
	);
}
