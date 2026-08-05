import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/require-staff";

import { DashboardOverview } from "./dashboard-overview";

export default async function DashboardPage() {
	const { staff, user } = await requireStaff();
	const firstName = (user.name || user.email).split(/\s+/)[0];

	return (
		<>
			<PageHeader
				title={`Olá, ${firstName}`}
				description="O panorama da redação: o que está no ar, o que espera revisão e o que está agendado."
			/>
			<DashboardOverview role={staff.role} />
		</>
	);
}
