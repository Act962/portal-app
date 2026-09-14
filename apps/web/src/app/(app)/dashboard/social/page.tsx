import { can } from "@portal-app/identity";

import { requireStaff } from "@/lib/require-staff";

import { SocialManager } from "./social-manager";

export default async function SocialPage() {
	// Aprovar post é decisão editorial (`social:publish`, o editor tem). A
	// barreira que vale é a do router; esta evita renderizar a tela para quem
	// não pode usá-la.
	const { staff } = await requireStaff("social:publish");

	// Desconectar conta é credencial (`social:manage`, só ADMIN). Resolvido aqui
	// no servidor porque `StaffMember` não serializa para o cliente — desce só o
	// booleano.
	return <SocialManager canManage={can(staff, "social:manage")} />;
}
