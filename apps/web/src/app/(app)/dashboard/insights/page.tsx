import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/require-staff";

import { InsightsDashboard } from "./insights-dashboard";

export default async function InsightsPage() {
	// Analytics editorial é insumo de pauta: ADMIN e EDITOR (ver
	// `authorization.ts`). Auditoria, que é governança, segue só com o ADMIN.
	await requireStaff("analytics:view");

	return (
		<>
			<PageHeader
				title="Insights"
				description="O que o leitor está lendo, por quanto tempo e de onde ele veio."
			/>
			<InsightsDashboard />
		</>
	);
}
