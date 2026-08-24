import { expect, type Page, test } from "@playwright/test";

/**
 * Fluxos que dependem de uma conta ADMIN, contra o Postgres de verdade. Roda
 * no CI contra o Postgres de *service* container (banco dedicado), não contra
 * o dev local.
 *
 * Por que TUDO que precisa de admin mora neste arquivo: só o PRIMEIRO usuário
 * do banco nasce ADMIN sem convite (Fase 1, D2) — é um recurso de uma vez só
 * por banco. T09 reivindica essa vaga (é literalmente o que ela testa); as
 * demais reusam essa MESMA conta (entrando, não cadastrando de novo). Um
 * arquivo separado não conseguiria se cadastrar: encontraria
 * `staff.count() > 0` e cairia no bloqueio de "cadastro só por convite".
 * `serial` garante a ordem e para o arquivo se T09 falhar, já que nada roda
 * sem a conta que ela cria.
 */
test.describe
	.serial("autenticação", () => {
		let adminEmail: string;
		let adminPassword: string;

		/**
		 * Na Fase 1 (Identidade & Acesso) o fluxo cadastro → sessão → dashboard
		 * passou a existir de verdade: ao criar a conta, um `StaffMember` é
		 * provisionado (o primeiro do sistema nasce ADMIN), e o `/dashboard` é
		 * guardado por staff ativo.
		 *
		 * Na Fase 5 a tela ganhou o painel novo e foi traduzida — e o padrão do
		 * `/login` passou a ser ENTRAR (antes abria no formulário de cadastro),
		 * então o caminho do cadastro começa clicando em "Criar conta".
		 */
		test("T09: cria conta, sai e entra novamente", async ({ page }) => {
			adminEmail = `e2e-${Date.now()}@example.com`;
			adminPassword = "senha-de-teste-123";
			const name = "Repórter de Teste";

			// Cadastro — a tela abre em "Entrar", então troca para o cadastro primeiro.
			await page.goto("/login");
			await page.getByRole("button", { name: "Criar conta" }).click();
			await page.getByLabel("Nome").fill(name);
			await page.getByLabel("E-mail").fill(adminEmail);
			await page.getByLabel("Senha").fill(adminPassword);
			await page
				.locator("form")
				.getByRole("button", { name: "Criar conta" })
				.click();

			await expect(page).toHaveURL(/\/dashboard/);

			// O menu do usuário vive no rodapé da sidebar e mostra nome + papel.
			const userMenu = page.getByRole("button", { name: new RegExp(name) });
			await expect(userMenu).toBeVisible();

			// Sair
			await userMenu.click();
			await page.getByRole("menuitem", { name: "Sair" }).click();
			await expect(page).toHaveURL(/\/login/);

			// Entrar de novo com as mesmas credenciais (a tela já abre em "Entrar").
			await page.getByLabel("E-mail").fill(adminEmail);
			await page.getByLabel("Senha").fill(adminPassword);
			await page
				.locator("form")
				.getByRole("button", { name: "Entrar" })
				.click();

			await expect(page).toHaveURL(/\/dashboard/);
		});

		/**
		 * Bloco 1.2 (reativar membro). Entra como o ADMIN que T09 já criou e
		 * convida um segundo membro, numa aba isolada — o cadastro é fechado por
		 * convite (B1) desde a Fase 1.
		 */
		test("T10: admin desativa e reativa um membro", async ({
			page,
			browser,
		}) => {
			const memberEmail = `e2e-membro-${Date.now()}@example.com`;
			const memberPassword = "senha-de-teste-123";

			await login(page, { email: adminEmail, password: adminPassword });
			await invite(page, memberEmail);

			const memberContext = await browser.newContext();
			const memberPage = await memberContext.newPage();
			await signUp(memberPage, {
				name: "Membro de Teste",
				email: memberEmail,
				password: memberPassword,
			});
			await memberContext.close();

			await page.goto("/dashboard/users");
			const row = page.getByRole("row", { name: new RegExp(memberEmail) });
			await row
				.getByRole("button", { name: `Desativar ${memberEmail}` })
				.click();
			await page
				.getByRole("button", { name: "Desativar", exact: true })
				.click();
			await expect(row.getByText("Inativo", { exact: true })).toBeVisible();

			await row
				.getByRole("button", { name: `Reativar ${memberEmail}` })
				.click();
			// `exact` é obrigatório aqui: "Ativo" é SUBSTRING de "Inativo", e sem ele a
			// asserção passaria com o selo ainda dizendo "Inativo" — ou seja, o teste
			// aprovaria uma reativação que não aconteceu.
			await expect(row.getByText("Ativo", { exact: true })).toBeVisible();
		});

		/**
		 * B5 — recuperação de senha. O admin (o mesmo de T09) gera o link (sem
		 * Mailer configurado, é ele quem entrega), e o membro o usa para trocar a
		 * senha e entrar de novo.
		 */
		test("T11: admin gera link de redefinição e o membro entra com a senha nova", async ({
			page,
			browser,
		}) => {
			const memberEmail = `e2e-membro-reset-${Date.now()}@example.com`;
			const oldPassword = "senha-de-teste-123";
			const newPassword = "senha-nova-de-teste-456";

			await login(page, { email: adminEmail, password: adminPassword });
			await invite(page, memberEmail);

			const memberContext = await browser.newContext();
			const memberPage = await memberContext.newPage();
			await signUp(memberPage, {
				name: "Membro de Teste",
				email: memberEmail,
				password: oldPassword,
			});
			await memberContext.close();

			await page.goto("/dashboard/users");
			const row = page.getByRole("row", { name: new RegExp(memberEmail) });
			await row
				.getByRole("button", {
					name: `Gerar link de redefinição de senha para ${memberEmail}`,
				})
				.click();
			// exact: sem isso, "Link de redefinição" também bate por substring com
			// os botões "Gerar link de redefinição de senha para X".
			const resetUrl = await page
				.getByLabel("Link de redefinição", { exact: true })
				.inputValue();
			expect(resetUrl).toContain("/reset-password/");

			const resetContext = await browser.newContext();
			const resetPage = await resetContext.newPage();
			await resetPage.goto(resetUrl);
			await expect(resetPage).toHaveURL(/\/reset-password\?token=/);
			await resetPage.getByLabel("Nova senha").fill(newPassword);
			await resetPage
				.getByRole("button", { name: "Salvar nova senha" })
				.click();
			await expect(resetPage).toHaveURL(/\/login/);

			await resetPage.getByLabel("E-mail").fill(memberEmail);
			await resetPage.getByLabel("Senha").fill(newPassword);
			await resetPage
				.locator("form")
				.getByRole("button", { name: "Entrar" })
				.click();
			await expect(resetPage).toHaveURL(/\/dashboard/);

			await resetContext.close();
		});

		/**
		 * A38 — painel de insights. Mora nesta suíte, e não num arquivo próprio,
		 * porque o cadastro é fechado por convite: só a PRIMEIRA conta do banco
		 * nasce ADMIN, e ela é criada em T09. Um arquivo separado não teria como
		 * se cadastrar.
		 *
		 * Verifica que a tela carrega e renderiza com o banco vazio de
		 * visualizações — o caso de portal recém-instalado, que é justamente onde
		 * um gráfico costuma quebrar (divisão por zero, série sem pontos).
		 */
		test("T12: o painel de insights carrega, inclusive sem dado nenhum", async ({
			page,
		}) => {
			await login(page, { email: adminEmail, password: adminPassword });
			await page.goto("/dashboard/insights");

			await expect(
				page.getByRole("heading", { name: "Insights" }),
			).toBeVisible();

			// Os três números-manchete.
			await expect(
				page.getByText("Visualizações", { exact: true }),
			).toBeVisible();
			// `exact`: "Matérias publicadas" também é prefixo da descrição dos
			// cards de produção ("Matérias publicadas no período.").
			await expect(
				page.getByText("Tempo médio de leitura", { exact: true }),
			).toBeVisible();
			await expect(
				page.getByText("Matérias publicadas", { exact: true }),
			).toBeVisible();

			// Os quatro blocos. Asserção pela DESCRIÇÃO de cada card: o título
			// (`CardTitle`) não é um heading no design system, e o texto dele se
			// repete no `aria-label` do SVG — a descrição é única.
			const serie = page.getByText(
				"Cada visita à página de uma matéria, no fuso de Teresina.",
			);
			await expect(serie).toBeVisible();
			await expect(
				page.getByText("De onde vinha quem abriu uma matéria."),
			).toBeVisible();
			await expect(
				page.getByText("As 10 que mais prendem o leitor."),
			).toBeVisible();
			await expect(
				page.getByText("Matérias publicadas no período.").first(),
			).toBeVisible();

			// O gráfico em si desenhou (o SVG expõe o período no rótulo acessível).
			await expect(
				page.getByRole("img", { name: /Visualizações por dia/ }),
			).toBeVisible();

			// Trocar o período refaz a consulta sem quebrar a tela.
			await page.getByRole("button", { name: "30 dias" }).click();
			await expect(serie).toBeVisible();
		});

		/**
		 * P39 — enquete no portal. É o fluxo que só um E2E prova: o leitor ANÔNIMO
		 * vota, o cookie httpOnly registra que ele já votou, e o resultado aparece
		 * DEPOIS do voto (nunca antes — a decisão do cliente é aplicada no
		 * servidor, não escondendo números com CSS).
		 */
		test("T13: leitor anônimo vota uma vez e só então vê o resultado", async ({
			page,
			browser,
		}) => {
			const pergunta = `Você aprova a nova faixa de ônibus? (${Date.now()})`;

			// --- A redação publica a enquete -------------------------------------
			await login(page, { email: adminEmail, password: adminPassword });
			await page.goto("/dashboard/enquetes");

			await page.getByRole("button", { name: "Nova enquete" }).click();
			await page.getByLabel("Pergunta").fill(pergunta);
			await page.getByLabel("Opção 1").fill("Aprovo");
			await page.getByLabel("Opção 2").fill("Desaprovo");
			await page.getByRole("button", { name: "Criar rascunho" }).click();

			await expect(page.getByText(pergunta)).toBeVisible();
			await page.getByRole("button", { name: "Publicar" }).click();
			// `exact: true` NÃO é preciosismo. Sem ele, `getByText` casa por SUBSTRING
			// e sem diferenciar maiúsculas — e esta tela tem "Uma enquete no ar por
			// vez…" no cabeçalho desde o carregamento. A asserção passava
			// instantaneamente, sem nunca esperar a publicação terminar, e o leitor ia
			// para a home antes de existir enquete publicada. Local passava por sorte
			// de latência; no CI falhou. Com `exact`, só o selo da enquete casa — que é
			// o que de fato prova que o servidor gravou.
			await expect(page.getByText("No ar", { exact: true })).toBeVisible();

			// --- O leitor anônimo chega à home -----------------------------------
			const leitor = await browser.newContext();
			const leitorPage = await leitor.newPage();
			await leitorPage.goto("/");

			await expect(leitorPage.getByText(pergunta)).toBeVisible();

			// ANTES de votar: nenhum número — o traço é tudo que se vê.
			const aprovo = leitorPage.getByRole("button", { name: /Aprovo/ });
			await expect(aprovo).toContainText("—");
			await expect(
				leitorPage.getByText(/vote para ver o resultado/),
			).toBeVisible();

			// --- Vota -------------------------------------------------------------
			await aprovo.click();
			await expect(leitorPage.getByText(/Obrigado pelo voto/)).toBeVisible();
			await expect(
				leitorPage.getByRole("button", { name: /Aprovo/ }),
			).toContainText("100%");

			// --- O voto persiste: recarregar não devolve o formulário -------------
			await leitorPage.reload();
			await expect(leitorPage.getByText(/Obrigado pelo voto/)).toBeVisible();
			await expect(
				leitorPage.getByRole("button", { name: /Aprovo/ }),
			).toContainText("100%");

			// --- E não dá para votar de novo --------------------------------------
			await expect(
				leitorPage.getByRole("button", { name: /Desaprovo/ }),
			).toBeDisabled();

			// --- Outro leitor (outro cookie) soma ao total ------------------------
			// Contexto novo = cookie novo. É o que separa "um voto por pessoa" de
			// "um voto no total".
			const outro = await browser.newContext();
			const outroPage = await outro.newPage();
			await outroPage.goto("/");

			await expect(
				outroPage.getByRole("button", { name: /Desaprovo/ }),
			).toContainText("—");
			await outroPage.getByRole("button", { name: /Desaprovo/ }).click();

			await expect(outroPage.getByText(/2 votos/)).toBeVisible();
			await expect(
				outroPage.getByRole("button", { name: /Desaprovo/ }),
			).toContainText("50%");

			await leitor.close();
			await outro.close();
		});
	});

async function signUp(
	page: Page,
	props: { name: string; email: string; password: string },
) {
	await page.goto("/login");
	await page.getByRole("button", { name: "Criar conta" }).click();
	await page.getByLabel("Nome").fill(props.name);
	await page.getByLabel("E-mail").fill(props.email);
	await page.getByLabel("Senha").fill(props.password);
	await page
		.locator("form")
		.getByRole("button", { name: "Criar conta" })
		.click();
	await expect(page).toHaveURL(/\/dashboard/);
}

async function login(page: Page, props: { email: string; password: string }) {
	await page.goto("/login");
	await page.getByLabel("E-mail").fill(props.email);
	await page.getByLabel("Senha").fill(props.password);
	await page.locator("form").getByRole("button", { name: "Entrar" }).click();
	await expect(page).toHaveURL(/\/dashboard/);
}

async function invite(page: Page, email: string) {
	await page.goto("/dashboard/users");
	await page.getByRole("tab", { name: "Convites" }).click();
	await page.getByLabel("E-mail").fill(email);
	await page.getByRole("button", { name: "Convidar" }).click();
	// Não `getByText` puro: o toast de sucesso também mostra o e-mail, e bate
	// com a linha da tabela ao mesmo tempo (strict mode do Playwright rejeita
	// match duplo). A célula da tabela é o alvo real do teste.
	await expect(
		page.getByRole("cell", { name: email, exact: true }),
	).toBeVisible();
	await page.getByRole("tab", { name: "Pessoas" }).click();
}
