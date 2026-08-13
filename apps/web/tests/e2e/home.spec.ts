import { expect, type Page, test } from "@playwright/test";

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
 * O menu lateral é O caminho para as editorias.
 *
 * Com a trilha de editorias fora do layout (13/08), chegar a qualquer editoria
 * passou a depender de um painel que só existe DEPOIS da hidratação. Sem estes
 * testes, um erro de hidratação, uma mudança do Base UI ou um `onClick` perdido
 * num refactor deixariam o portal sem navegação com o CI verde — o teste acima
 * continuaria passando, porque a manchete não depende do menu.
 *
 * Nada aqui escreve no banco: é navegação e leitura.
 */
test.describe("menu lateral", () => {
	const ABRIR = "button[aria-label='Abrir o menu']";
	const PAINEL = "[data-slot='sheet-content']";

	const abrirMenu = async (page: Page) => {
		await page.locator(ABRIR).click();
		await expect(page.locator(PAINEL)).toBeVisible();
	};

	/**
	 * A primeira editoria que o painel lista, seja ela qual for.
	 *
	 * Os testes NÃO fixam um nome ("Política" era o do banco de desenvolvimento,
	 * e o seed do E2E tem só "Cidades"): amarrar asserção a conteúdo de seed
	 * produz falha vermelha quando o dado muda, que é ruído, não defeito.
	 */
	const primeiraEditoria = (page: Page) =>
		page
			.locator(PAINEL)
			.getByRole("navigation", { name: "Editorias" })
			.getByRole("link")
			.first();

	test("o botão MENU abre o painel", async ({ page }) => {
		await page.goto("/");

		await expect(page.locator(PAINEL)).toHaveCount(0);
		await abrirMenu(page);

		// Diálogo de verdade, com nome acessível — é o que faz um leitor de tela
		// anunciar "Navegação" em vez de despejar a lista de links solta.
		await expect(page.getByRole("dialog")).toBeVisible();
		await expect(page.locator(ABRIR)).toHaveAttribute("aria-expanded", "true");
	});

	test("o painel lista as editorias ativas", async ({ page }) => {
		await page.goto("/");
		await abrirMenu(page);

		const editorias = page
			.locator(PAINEL)
			.getByRole("navigation", { name: "Editorias" });

		await expect(editorias).toBeVisible();
		// Que a lista não venha VAZIA é exatamente como uma falha de prop
		// apareceria — `sections` deixando de chegar do `SiteHeader`.
		await expect(editorias.getByRole("link")).not.toHaveCount(0);
		await expect(primeiraEditoria(page)).toHaveAttribute("href", /^\/[a-z-]+$/);
	});

	test("clicar numa editoria navega e FECHA o painel", async ({ page }) => {
		await page.goto("/");
		await abrirMenu(page);

		const editoria = primeiraEditoria(page);
		const href = await editoria.getAttribute("href");
		await editoria.click();

		await expect(page).toHaveURL(new RegExp(`${href}$`));
		// A parte que se perde num refactor: navegar sem fechar deixa o painel
		// cobrindo a página que o leitor acabou de pedir.
		await expect(page.locator(PAINEL)).toHaveCount(0);
	});

	test("clicar no link da página em que já se está também fecha", async ({
		page,
	}) => {
		// O caso que um efeito observando a rota NÃO cobriria: a URL não muda,
		// então não há transição para reagir. É por isso que o fechamento é um
		// `onClick` explícito, e é isto que garante que continue sendo.
		await page.goto("/");
		await abrirMenu(page);
		const href = await primeiraEditoria(page).getAttribute("href");

		await page.goto(href ?? "/");
		await abrirMenu(page);
		await primeiraEditoria(page).click();

		await expect(page.locator(PAINEL)).toHaveCount(0);
		await expect(page).toHaveURL(new RegExp(`${href}$`));
	});

	test("Esc fecha e devolve o foco ao botão MENU", async ({ page }) => {
		await page.goto("/");
		await abrirMenu(page);

		await page.keyboard.press("Escape");

		await expect(page.locator(PAINEL)).toHaveCount(0);
		// Foco que não volta deixa quem navega por teclado no início do
		// documento, tendo de reatravessar o cabeçalho inteiro (WCAG 2.4.3).
		await expect(page.locator(ABRIR)).toBeFocused();
	});

	test("o rodapé mantém as editorias no HTML sem abrir o painel", async ({
		page,
	}) => {
		// A regressão de SEO que a remoção da trilha criou: conteúdo de painel
		// fechado não existe no documento, então o rastreador não o vê. Quem
		// mantém cada editoria a um link de distância é o rodapé — e é isso, e
		// não o menu, que este teste protege.
		const resposta = await page.goto("/");
		const html = (await resposta?.text()) ?? "";

		expect(html).toContain('aria-label="Editorias no rodapé"');

		const rodape = page.getByRole("navigation", {
			name: "Editorias no rodapé",
		});
		await expect(rodape.getByRole("link")).not.toHaveCount(0);

		// E tudo isso sem nenhuma interação: o painel não está no documento.
		await expect(page.locator(PAINEL)).toHaveCount(0);
	});
});
