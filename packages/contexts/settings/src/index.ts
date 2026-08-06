// Interface publicada do contexto de configurações. Outros contextos e a camada
// de interface (apps/web) importam daqui — nunca de caminhos internos.
export * from "./application/manage-settings";
export * from "./domain/errors";
export * from "./domain/events";
export * from "./domain/ports/site-settings-repository";
export * from "./domain/site-settings";
