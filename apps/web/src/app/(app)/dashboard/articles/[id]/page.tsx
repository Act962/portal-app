import { requireStaff } from "@/lib/require-staff";

import { ArticleEditor } from "./article-editor";

export default async function ArticleEditorPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	await requireStaff();
	const { id } = await params;
	return <ArticleEditor id={id} />;
}
