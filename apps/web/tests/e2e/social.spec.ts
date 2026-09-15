import { test } from "@playwright/test";

/**
 * ESQUELETO — a fila de redes sociais no painel (spec 08, F3).
 *
 * A tela foi entregue com typecheck, lint e testes da lógica pura
 * (`tests/unit/social-labels.test.ts`), mas sem navegador autenticado. Cada caso
 * abaixo é o que ficou por provar; `test.fixme` aparece no relatório a cada
 * rodada, que é o que um TODO em comentário nunca faz.
 */
test.describe("redes sociais — fila de aprovação", () => {
	test.fixme("matéria publicada aparece na fila com legenda e capa montadas", async () => {});

	test.fixme("o REDATOR não vê o item Redes sociais no menu", async () => {});

	test.fixme("o EDITOR aprova e o cartão passa a Enviando", async () => {});

	test.fixme("o botão Aprovar fica desabilitado enquanto há impedimento, com o motivo acima dele", async () => {});

	test.fixme("o contador da legenda fica vermelho acima de 2200 caracteres no Instagram", async () => {});

	test.fixme("correção feita no editor antes de aprovar é a que vai para a fila", async () => {});

	test.fixme("post que falhou mostra o erro e oferece Tentar de novo", async () => {});

	test.fixme("a aba Contas mostra 'Não conectada' e só o ADMIN vê Desconectar", async () => {});
});
