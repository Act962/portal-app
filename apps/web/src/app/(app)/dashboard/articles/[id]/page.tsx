import { resolveStaff } from "@portal-app/api/staff";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { ArticleEditor } from "./article-editor";

export default async function ArticleEditorPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { staff } = await resolveStaff(await headers());

	if (!staff || !staff.isActive()) {
		redirect("/dashboard");
	}

	const { id } = await params;
	return (
		<div className="mx-auto max-w-4xl p-6">
			<ArticleEditor id={id} />
		</div>
	);
}
