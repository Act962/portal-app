import { can } from "@portal-app/identity";

import { requireStaff } from "@/lib/require-staff";

import { VideoEditorLoader } from "./editor-loader";

/**
 * O editor de vídeo de um post (spec 12, F1–F3), em tela cheia.
 *
 * Quem publica (`social:publish`) monta o vídeo; criar PADRÃO exige
 * `social:manage`, e é por isso que o booleano desce daqui — `StaffMember` não
 * serializa para o cliente, e a barreira que vale é a do router.
 */
export default async function VideoEditorPage({
	params,
}: {
	params: Promise<{ id: string }>;
}) {
	const { staff } = await requireStaff("social:publish");
	const { id } = await params;
	return <VideoEditorLoader id={id} canDesign={can(staff, "social:manage")} />;
}
