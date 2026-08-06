// Interface publicada do contexto de identidade. Outros contextos e a camada de
// interface (apps/web) importam daqui — nunca de caminhos internos.
export * from "./application/manage-invitations";
export * from "./application/manage-staff";
export * from "./application/provision-staff-for-new-user";
export * from "./domain/action";
export * from "./domain/author-profile";
export * from "./domain/authorization";
export * from "./domain/errors";
export * from "./domain/invitation";
export * from "./domain/ports/invitation-repository";
export * from "./domain/ports/staff-repository";
export * from "./domain/role";
export * from "./domain/staff-member";
