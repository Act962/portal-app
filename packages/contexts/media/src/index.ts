// Interface publicada do contexto de mídia. Outros contextos e a camada de
// interface (apps/web) importam daqui — nunca de caminhos internos.
export * from "./application/manage-media";
export * from "./domain/alt-text";
export * from "./domain/caption";
export * from "./domain/credit";
export * from "./domain/dimensions";
export * from "./domain/errors";
export * from "./domain/focal-point";
export * from "./domain/folder";
export * from "./domain/media-asset";
export * from "./domain/media-type";
export * from "./domain/ports/folder-repository";
export * from "./domain/ports/media-repository";
export * from "./domain/ports/media-usage";
export * from "./domain/ports/media-storage";
