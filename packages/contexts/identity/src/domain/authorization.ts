import type { Action } from "./action";
import type { StaffMember } from "./staff-member";

/**
 * Referência mínima ao recurso sobre o qual se decide a permissão. É declarada
 * AQUI, no contexto de identidade, e alimentada pelo Editorial (Fase 3) — assim
 * `identity` nunca importa `editorial` (regra `contextos-isolados`).
 */
export type ResourceRef = {
	authorId?: string;
	sectionId?: string;
};

/**
 * O coração da fase: decide se `staff` pode realizar `action` sobre `resource`.
 * Função pura, sem I/O — a mesma regra protege o caso de uso, o router tRPC e,
 * como segunda barreira, a UI. Reflete a matriz de features.md §3.4.
 */
export function can(
	staff: StaffMember,
	action: Action,
	resource?: ResourceRef,
): boolean {
	// Usuário inativo não pode nada — nem um Admin desativado.
	if (!staff.isActive()) {
		return false;
	}

	switch (staff.role) {
		case "ADMIN":
			return true;
		case "EDITOR":
			return canEditor(staff, action, resource);
		case "REDATOR":
			return canRedator(staff, action, resource);
		/* v8 ignore next 2 -- inalcançável: `role` é sempre um Role válido */
		default:
			return false;
	}
}

function canRedator(
	staff: StaffMember,
	action: Action,
	resource?: ResourceRef,
): boolean {
	switch (action) {
		case "article:create":
		case "article:submit":
			return true;
		case "article:edit-own":
			return ownsResource(staff, resource);
		default:
			return false;
	}
}

function canEditor(
	staff: StaffMember,
	action: Action,
	resource?: ResourceRef,
): boolean {
	switch (action) {
		case "article:create":
		case "article:submit":
			return true;
		// Analytics editorial (A38) serve para decidir PAUTA — e é o editor quem
		// decide pauta. Diferente da auditoria (`audit:view`, só ADMIN), que é
		// registro de governança, não insumo de redação. Sem recorte por
		// editoria: o painel mostra o desempenho do portal inteiro, e um editor
		// que só enxerga a própria editoria não consegue comparar.
		case "analytics:view":
			return true;
		case "article:edit-own":
			return ownsResource(staff, resource);
		case "article:edit-any":
		case "article:approve":
		case "article:publish":
		case "article:unpublish":
			// Restrito às editorias vinculadas ao editor.
			return (
				resource?.sectionId !== undefined &&
				staff.belongsToSection(resource.sectionId)
			);
		default:
			return false;
	}
}

function ownsResource(staff: StaffMember, resource?: ResourceRef): boolean {
	return resource?.authorId !== undefined && resource.authorId === staff.id;
}
