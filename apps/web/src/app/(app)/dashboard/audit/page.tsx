import { resolveStaff } from "@portal-app/api/staff";
import { can } from "@portal-app/identity";
import { headers } from "next/headers";
import { redirect } from "next/navigation";

import { AuditLog } from "./audit-log";

export default async function AuditPage() {
	const { staff } = await resolveStaff(await headers());

	// Auditoria é de quem tem a visão (audit:view) — ADMIN pela matriz.
	if (!staff || !staff.isActive() || !can(staff, "audit:view")) {
		redirect("/dashboard");
	}

	return (
		<div className="mx-auto max-w-4xl p-6">
			<h1 className="mb-2 font-bold text-2xl">Auditoria</h1>
			<p className="mb-6 text-ink-muted text-sm">
				Registro imutável derivado dos eventos de domínio (outbox → consumidor de auditoria).
			</p>
			<AuditLog />
		</div>
	);
}
