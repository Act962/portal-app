// Interface publicada do contexto de publicidade. O app e a raiz de composição
// importam DAQUI — nunca de caminhos internos (regra `contextos-isolados`).
export * from "./application/manage-campaigns";
export * from "./domain/ad-slot";
export * from "./domain/adsense-settings";
export * from "./domain/campaign";
export * from "./domain/destination";
export * from "./domain/errors";
export * from "./domain/flight";
export * from "./domain/ports/campaign-repository";
export * from "./domain/select-ad";
