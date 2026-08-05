import { resolveStaff } from "@portal-app/api/staff";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { MediaManager } from "./media-manager";

export default async function MediaPage() {
	const { staff } = await resolveStaff(await headers());

	// Gerir mídia exige apenas um membro ativo da redação.
	if (!staff || !staff.isActive()) {
		redirect("/dashboard");
	}

	return (
		<div className="mx-auto max-w-5xl p-6">
			<h1 className="mb-6 font-bold text-2xl">Biblioteca de mídia</h1>
			<MediaManager />
		</div>
	);
}
