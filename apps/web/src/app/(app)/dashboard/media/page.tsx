import { requireStaff } from "@/lib/require-staff";

import { MediaManager } from "./media-manager";

export default async function MediaPage() {
	// Gerir mídia exige apenas um membro ativo da redação.
	await requireStaff();
	return <MediaManager />;
}
