import { requireStaff } from "@/lib/require-staff";

import { CampaignsManager } from "./campaigns-manager";

export default async function CampaignsPage() {
	// Publicidade é receita, não redação: só quem tem `ads:manage` (ADMIN).
	// Segunda barreira, não a única — quem manda é a checagem no router.
	await requireStaff("ads:manage");

	return <CampaignsManager />;
}
