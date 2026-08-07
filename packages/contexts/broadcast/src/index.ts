// Interface publicada do contexto de programação. Outros contextos e a camada
// de interface (apps/web) importam daqui — nunca de caminhos internos.
export * from "./application/manage-programs";
export * from "./domain/errors";
export * from "./domain/ports/program-repository";
export * from "./domain/program";
export * from "./domain/time-of-day";
