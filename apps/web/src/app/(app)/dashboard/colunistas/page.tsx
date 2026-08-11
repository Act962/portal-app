import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/require-staff";

import { ColumnistsManager } from "./columnists-manager";

export default async function ColunistasPage() {
	// Quem aparece na home é curadoria editorial: columnists:manage (ADMIN).
	await requireStaff("columnists:manage");

	return (
		<>
			<PageHeader
				title="Colunistas"
				description="Quem aparece no bloco de colunistas da home. Não precisa ter conta no painel — basta assinar as matérias com o mesmo nome."
			/>
			<ColumnistsManager />
		</>
	);
}
