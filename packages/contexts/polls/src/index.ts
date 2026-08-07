// Interface publicada do contexto de enquetes. Outros contextos e a camada de
// interface (apps/web) importam daqui — nunca de caminhos internos.
export * from "./application/manage-polls";
export * from "./domain/errors";
export * from "./domain/poll";
export * from "./domain/ports/poll-repository";
