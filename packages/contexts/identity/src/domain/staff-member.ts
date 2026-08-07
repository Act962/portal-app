import { AggregateRoot } from "@portal-app/shared-kernel";

import { AuthorProfile } from "./author-profile";
import type { Role } from "./role";

export type StaffStatus = "ATIVO" | "INATIVO";

type StaffMemberState = {
	email: string;
	role: Role;
	status: StaffStatus;
	sectionIds: readonly string[];
	authorProfile: AuthorProfile;
};

/**
 * Membro da redação — o agregado raiz do contexto de identidade. O `id` é o
 * MESMO id do `user` do Better-Auth (relação 1:1): a biblioteca cuida da
 * autenticação, este agregado cuida de papel, status e perfil.
 *
 * Nesta etapa o agregado é imutável após criado (só leitura + consultas de
 * autorização). As mutações com evento (mudar papel, desativar) entram na
 * Etapa 4, junto dos casos de uso que as disparam.
 */
export class StaffMember extends AggregateRoot<string> {
	private state: StaffMemberState;

	private constructor(id: string, state: StaffMemberState) {
		super(id);
		this.state = state;
	}

	/** Cria um novo membro (ativo, perfil vazio). Usado no provisionamento. */
	static create(props: {
		id: string;
		email: string;
		role: Role;
		sectionIds?: readonly string[];
	}): StaffMember {
		return new StaffMember(props.id, {
			email: props.email,
			role: props.role,
			status: "ATIVO",
			sectionIds: props.sectionIds ? [...props.sectionIds] : [],
			authorProfile: AuthorProfile.create({}),
		});
	}

	/** Reidrata um membro a partir da persistência (ou de um teste). */
	static restore(props: {
		id: string;
		email: string;
		role: Role;
		status: StaffStatus;
		sectionIds: readonly string[];
		authorProfile?: AuthorProfile | null;
	}): StaffMember {
		return new StaffMember(props.id, {
			email: props.email,
			role: props.role,
			status: props.status,
			sectionIds: [...props.sectionIds],
			authorProfile: props.authorProfile ?? AuthorProfile.create({}),
		});
	}

	get email(): string {
		return this.state.email;
	}

	get role(): Role {
		return this.state.role;
	}

	get status(): StaffStatus {
		return this.state.status;
	}

	get sectionIds(): readonly string[] {
		return this.state.sectionIds;
	}

	get authorProfile(): AuthorProfile {
		return this.state.authorProfile;
	}

	isActive(): boolean {
		return this.state.status === "ATIVO";
	}

	/** O editor age apenas nas editorias às quais está vinculado. */
	belongsToSection(sectionId: string): boolean {
		return this.state.sectionIds.includes(sectionId);
	}

	// Mutações. Eventos de domínio (RoleChanged, StaffDeactivated) entram na
	// Fase 3, junto do outbox que os publica (ADR 0005) — sem consumidor agora,
	// emiti-los seria código morto.

	changeRole(role: Role): void {
		this.state = { ...this.state, role };
	}

	deactivate(): void {
		this.state = { ...this.state, status: "INATIVO" };
	}

	/** Reativa um membro desativado, devolvendo o acesso ao painel. */
	activate(): void {
		this.state = { ...this.state, status: "ATIVO" };
	}

	bindSections(sectionIds: readonly string[]): void {
		this.state = { ...this.state, sectionIds: [...sectionIds] };
	}

	updateProfile(authorProfile: AuthorProfile): void {
		this.state = { ...this.state, authorProfile };
	}
}
