// Interface publicada do contexto de redes sociais. O app e a raiz de
// composição importam DAQUI — nunca de caminhos internos (regra
// `contextos-isolados`).
export * from "./application/draft-from-article";
export * from "./application/manage-accounts";
export * from "./application/manage-posts";
export * from "./application/publish-pending";
export * from "./domain/caption";
export * from "./domain/caption-template";
export * from "./domain/delivery";
export * from "./domain/errors";
export * from "./domain/events";
export * from "./domain/platform";
export * from "./domain/ports/social-account-repository";
export * from "./domain/ports/social-post-repository";
export * from "./domain/ports/social-publisher";
export * from "./domain/social-account";
export * from "./domain/social-post";
