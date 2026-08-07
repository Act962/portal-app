import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/require-staff";

import { PollsManager } from "./polls-manager";

export default async function EnquetesPage() {
	// Enquetes são geridas por quem tem polls:manage (ADMIN).
	await requireStaff("polls:manage");

	return (
		<>
			<PageHeader
				title="Enquetes"
				description="Uma enquete no ar por vez. Publicar uma nova fecha a anterior."
			/>
			<PollsManager />
		</>
	);
}
