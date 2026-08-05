import { resolveStaff } from "@portal-app/api/staff";
import { can } from "@portal-app/identity";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { SectionsManager } from "./sections-manager";
import { TagsManager } from "./tags-manager";

export default async function TaxonomyPage() {
	const { staff } = await resolveStaff(await headers());

	// Editorias e tags são geridas por quem tem taxonomy:manage (ADMIN, pela matriz).
	if (!staff || !staff.isActive() || !can(staff, "taxonomy:manage")) {
		redirect("/dashboard");
	}

	return (
		<div className="mx-auto max-w-4xl p-6">
			<h1 className="mb-6 font-bold text-2xl">Taxonomia</h1>

			<section className="mb-10">
				<h2 className="mb-3 font-bold text-xl">Editorias</h2>
				<SectionsManager />
			</section>

			<section>
				<h2 className="mb-3 font-bold text-xl">Tags</h2>
				<TagsManager />
			</section>
		</div>
	);
}
