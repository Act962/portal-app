// Matriz de permissões (A27) — reflexo de features.md §3.4. Informativa, sem
// estado. ✅¹ = permitido, restrito às editorias vinculadas ao editor.
const ROWS: Array<{
	action: string;
	redator: boolean;
	editor: boolean | "cond";
	admin: boolean;
}> = [
	{ action: "Criar rascunho", redator: true, editor: true, admin: true },
	{
		action: "Editar rascunho próprio",
		redator: true,
		editor: true,
		admin: true,
	},
	{
		action: "Editar matéria de outro",
		redator: false,
		editor: "cond",
		admin: true,
	},
	{ action: "Submeter para revisão", redator: true, editor: true, admin: true },
	{ action: "Aprovar / devolver", redator: false, editor: "cond", admin: true },
	{ action: "Publicar / agendar", redator: false, editor: "cond", admin: true },
	{
		action: "Despublicar / arquivar",
		redator: false,
		editor: "cond",
		admin: true,
	},
	{
		action: "Gerenciar editorias e tags",
		redator: false,
		editor: false,
		admin: true,
	},
	{
		action: "Gerenciar programação da rádio",
		redator: false,
		editor: false,
		admin: true,
	},
	{
		action: "Gerenciar usuários e papéis",
		redator: false,
		editor: false,
		admin: true,
	},
	{
		action: "Configurações do site",
		redator: false,
		editor: false,
		admin: true,
	},
	{ action: "Ver auditoria", redator: false, editor: false, admin: true },
	// Analytics editorial é insumo de pauta — por isso o editor vê, ao
	// contrário da auditoria logo acima, que é governança.
	{ action: "Ver insights", redator: false, editor: true, admin: true },
	{ action: "Gerenciar enquetes", redator: false, editor: false, admin: true },
];

function cell(value: boolean | "cond"): string {
	if (value === "cond") {
		return "✅¹";
	}
	return value ? "✅" : "❌";
}

export function PermissionMatrix() {
	return (
		<>
			<table className="w-full border-collapse text-sm">
				<thead>
					<tr className="border-b text-left">
						<th className="py-2">Ação</th>
						<th className="py-2 text-center">Redator</th>
						<th className="py-2 text-center">Editor</th>
						<th className="py-2 text-center">Admin</th>
					</tr>
				</thead>
				<tbody>
					{ROWS.map((row) => (
						<tr key={row.action} className="border-b">
							<td className="py-2">{row.action}</td>
							<td className="py-2 text-center">{cell(row.redator)}</td>
							<td className="py-2 text-center">{cell(row.editor)}</td>
							<td className="py-2 text-center">{cell(row.admin)}</td>
						</tr>
					))}
				</tbody>
			</table>
			<p className="mt-2 text-ink-muted text-xs">
				¹ Restrito às editorias às quais o editor está vinculado.
			</p>
		</>
	);
}
