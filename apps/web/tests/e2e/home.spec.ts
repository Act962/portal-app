import { expect, test } from "@playwright/test";

test("T08: a home renderiza a manchete", async ({ page }) => {
	await page.goto("/");

	// A manchete é o h1 da home (HeroStory com headingLevel "h1").
	const headline = page.getByRole("heading", {
		level: 1,
		name: /pacote de obras para o norte do Piauí/i,
	});

	await expect(headline).toBeVisible();
});

/*
 * Esqueleto aberto (regra 2 do CLAUDE.md), e o mais urgente da entrega de
 * 13/08: com a trilha de editorias fora do layout, TODA a navegação do portal
 * passou a depender de um painel que só existe depois da hidratação. Se ele
 * quebrar — erro de hidratação, mudança do Base UI, um `onClick` perdido —, o
 * leitor fica sem caminho para editoria nenhuma e nada no CI reclama: o teste
 * acima continua verde, porque a manchete não depende do menu.
 *
 * `test.fixme` e não comentário: aparece no relatório do Playwright a cada
 * rodada, como o `it.todo` faz no vitest.
 */
test.describe("menu lateral", () => {
	test.fixme("o botão MENU abre o painel", async () => {});
	test.fixme("o painel lista as editorias ativas", async () => {});
	test.fixme("clicar numa editoria navega e FECHA o painel", async () => {});
	test.fixme("clicar no link da página em que já se está também fecha", async () => {});
	test.fixme("Esc fecha e devolve o foco ao botão MENU", async () => {});
	test.fixme("o rodapé mantém as editorias no HTML sem abrir o painel", () => {});
});
