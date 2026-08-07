import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/require-staff";

import { ScheduleManager } from "./schedule-manager";

export default async function ProgramacaoPage() {
	// Grade da rádio é gerida por quem tem broadcast:manage (ADMIN).
	await requireStaff("broadcast:manage");

	return (
		<>
			<PageHeader
				title="Programação"
				description="A grade semanal da rádio — mesmos programas, toda semana, no mesmo horário."
			/>
			<ScheduleManager />
		</>
	);
}
