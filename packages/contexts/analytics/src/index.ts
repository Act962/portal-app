// Interface publicada do contexto de analytics. Outros contextos e a camada
// de interface (apps/web) importam daqui — nunca de caminhos internos.
export * from "./domain/aggregation";
export * from "./domain/ports/page-view-log";
export * from "./domain/ports/view-counter";
export * from "./domain/traffic-source";
