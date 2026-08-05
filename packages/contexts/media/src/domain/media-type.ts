/**
 * Tipos de mídia que o agregado modela. No MVP (D5) só IMAGE tem pipeline
 * completo de upload/metadados; os demais existem no modelo para o back-office
 * evoluir sem migração de tipo.
 */
export const MEDIA_TYPES = ["IMAGE", "VIDEO", "AUDIO", "DOCUMENT"] as const;

export type MediaType = (typeof MEDIA_TYPES)[number];
