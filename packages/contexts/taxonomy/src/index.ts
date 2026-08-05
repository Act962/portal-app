// Interface publicada do contexto de taxonomia. Outros contextos e a camada de
// interface (apps/web) importam daqui — nunca de caminhos internos.
export * from "./application/manage-sections";
export * from "./application/manage-tags";
export * from "./domain/errors";
export * from "./domain/ports/content-usage";
export * from "./domain/ports/section-repository";
export * from "./domain/ports/tag-repository";
export * from "./domain/section";
export * from "./domain/slug";
export * from "./domain/tag";
