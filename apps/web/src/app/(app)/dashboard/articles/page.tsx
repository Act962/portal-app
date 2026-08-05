import { resolveStaff } from "@portal-app/api/staff";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ArticlesList } from "./articles-list";

export default async function ArticlesPage() {
	const { staff } = await resolveStaff(await headers());

	if (!staff || !staff.isActive()) {
		redirect("/dashboard");
	}

	return (
		<div className="mx-auto max-w-4xl p-6">
			<h1 className="mb-6 font-bold text-2xl">Matérias</h1>
			<ArticlesList />
		</div>
	);
}
