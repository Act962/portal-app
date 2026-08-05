import { requireStaff } from "@/lib/require-staff";

import { ArticlesList } from "./articles-list";

export default async function ArticlesPage() {
	await requireStaff();
	return <ArticlesList />;
}
