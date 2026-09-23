import { can } from "@portal-app/identity";

import { requireStaff } from "@/lib/require-staff";

import { ArticleEditor } from "./article-editor";

export default async function ArticleEditorPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { staff } = await requireStaff();
	const { id } = await params;
	// O cartão "Redes sociais" (spec 09, F6) só aparece para quem pode publicar
	// nas redes. Resolvido aqui porque `StaffMember` não serializa para o
	// cliente — desce só o booleano. Sem isto, o redator abriria a matéria e
	// veria um erro de permissão a cada vez.
	//
	// `canDesignSocial` (`social:manage`) desce junto porque o editor de vídeo,
	// agora aberto em diálogo dentro da matéria, deixa criar PADRÃO — e essa
	// porta é de manage, não de publish.
	return (
		<ArticleEditor
			id={id}
			canPublishSocial={can(staff, "social:publish")}
			canDesignSocial={can(staff, "social:manage")}
			canPublishArticle={can(staff, "article:publish")}
		/>
	);
}
