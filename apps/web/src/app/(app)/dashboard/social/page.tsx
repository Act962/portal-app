import { can } from "@portal-app/identity";

import { requireStaff } from "@/lib/require-staff";

import { SocialManager } from "./social-manager";

export default async function SocialPage({
	searchParams,
}: {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
	// Aprovar post é decisão editorial (`social:publish`, o editor tem). A
	// barreira que vale é a do router; esta evita renderizar a tela para quem
	// não pode usá-la.
	const { staff } = await requireStaff("social:publish");
	const params = await searchParams;

	// A volta do login da Meta chega com `?aba=contas&meta=<resultado>`. Lido
	// aqui, no servidor, e passado como prop — em vez de `useSearchParams` no
	// cliente, que exigiria um Suspense só para isso.
	const tab = params.aba === "contas" ? "contas" : "fila";
	const metaFlag = typeof params.meta === "string" ? params.meta : null;

	// Desconectar e conectar conta é credencial (`social:manage`, só ADMIN).
	// Resolvido aqui porque `StaffMember` não serializa para o cliente — desce
	// só o booleano.
	return (
		<SocialManager
			canManage={can(staff, "social:manage")}
			initialTab={tab}
			metaFlag={metaFlag}
		/>
	);
}
