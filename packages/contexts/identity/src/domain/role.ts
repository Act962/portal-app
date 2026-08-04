/**
 * Papel de um membro da redação. É um objeto de valor: um dos três papéis do
 * MVP, sem identidade própria. A matriz de permissões (features.md §3.4) é
 * resolvida em `authorization.ts`, não aqui — este arquivo só nomeia os papéis.
 */
export const ROLES = ["ADMIN", "EDITOR", "REDATOR"] as const;

export type Role = (typeof ROLES)[number];
