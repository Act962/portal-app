import { can } from "@portal-app/identity";

import { requireStaff } from "@/lib/require-staff";

import { TemplateEditorLoader } from "./editor-loader";

/**
 * O editor de um padrão de arte (spec 10, F3–F4).
 *
 * Quem escolhe padrão (`social:publish`) abre para ver; só quem desenha
 * (`social:manage`) edita — resolvido aqui porque `StaffMember` não serializa
 * para o cliente, e desce só o booleano. A barreira que vale é a do router.
 */
export default async function TemplateEditorPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { staff } = await requireStaff("social:publish");
	const { id } = await params;
	return (
		<TemplateEditorLoader id={id} canDesign={can(staff, "social:manage")} />
	);
}
