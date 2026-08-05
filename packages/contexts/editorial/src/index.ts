// Interface publicada do contexto editorial. Outros contextos e a camada de
// interface (apps/web) importam daqui — nunca de caminhos internos.
export * from "./application/manage-articles";
export * from "./domain/article";
export * from "./domain/body";
export * from "./domain/byline";
export * from "./domain/cover";
export * from "./domain/editorial-status";
export * from "./domain/errors";
export * from "./domain/events";
export * from "./domain/headline";
export * from "./domain/optional-text";
export * from "./domain/ports/article-repository";
export * from "./domain/publication-schedule";
export * from "./domain/slug";
