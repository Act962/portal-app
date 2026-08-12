import { describe, it } from "vitest";

/**
 * ESQUELETO — ver a regra dos testes no `CLAUDE.md`.
 *
 * `apps/web/src/lib/media-upload.ts` saiu de dentro da tela da biblioteca para
 * ser usado também pelo `ImageField` (logo e foto do colunista). É o módulo que
 * fala com o navegador e com o storage, e a razão de ele existir separado é
 * exatamente esta: pode ser testado sem montar componente nenhum.
 *
 * `readPickedFile` precisa de `Image` e `URL.createObjectURL`; `putWithProgress`
 * precisa de `XMLHttpRequest`. Os dois pedem ambiente `jsdom` com dublês — o
 * projeto `unit` do vitest hoje roda sem ambiente (`environment: "node"`), então
 * implementar isto começa por decidir se vale um projeto novo ou um
 * `// @vitest-environment jsdom` neste arquivo.
 */
describe.todo("readPickedFile", () => {
	it.todo("lê largura e altura reais de uma imagem");

	it.todo("devolve previewUrl para imagem");

	it.todo("documento vem sem preview, sem largura e sem altura");

	it.todo("rejeita mime que o domínio não aceita, com a mensagem do domínio");

	it.todo("rejeita arquivo com extensão de imagem mas conteúdo inválido");
});

describe.todo("putWithProgress", () => {
	it.todo("reporta progresso crescente até 100");

	it.todo("resolve em HTTP 2xx");

	it.todo("rejeita com o status quando o storage recusa (403 de URL vencida)");

	it.todo("rejeita quando a rede cai no meio do envio");

	it.todo("manda o Content-Type do arquivo — o R2 assina a URL com ele");
});
