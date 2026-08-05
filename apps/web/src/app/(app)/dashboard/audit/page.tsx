import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/require-staff";

import { AuditLog } from "./audit-log";

export default async function AuditPage() {
	// Auditoria é de quem tem a visão (audit:view) — ADMIN pela matriz.
	await requireStaff("audit:view");

	return (
		<>
			<PageHeader
				title="Auditoria"
				description="Tudo o que aconteceu com as matérias, na ordem em que aconteceu. O registro é derivado dos eventos e não pode ser editado."
			/>
			<AuditLog />
		</>
	);
}
