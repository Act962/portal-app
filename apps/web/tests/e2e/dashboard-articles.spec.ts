import { test } from "@playwright/test";

/**
 * ESQUELETO — ver a regra dos testes no `CLAUDE.md`.
 *
 * O arquivamento pelo seletor da lista foi entregue sem E2E. A LÓGICA tem teste
 * de verdade: `apps/web/tests/unit/article-selection.test.ts` cobre quem pode
 * ser marcado, o que "marcar tudo" marca e o que a mensagem final diz, e
 * `packages/contexts/editorial/tests/unit/manage-articles.test.ts` cobre o lote
 * parcial e o sumiço das arquivadas da lista. O que falta é a FIAÇÃO — caixinha
 * → barra → diálogo → mutação → lista atualizada —, que nenhum teste unitário
 * alcança e que é justamente onde um `onCheckedChange` perdido num refactor
 * passaria com o CI verde.
 *
 * `test.fixme` e não um comentário: aparece no relatório do Playwright a cada
 * rodada, do mesmo jeito que o `it.todo` aparece no do vitest.
 *
 * O QUE FALTA ANTES DE PREENCHER: uma sessão de staff. Só o PRIMEIRO usuário do
 * banco nasce ADMIN sem convite, e `auth.spec.ts` reivindica essa vaga — é por
 * isso que ele concentra tudo que precisa de admin. Preencher aqui exige uma
 * das duas coisas: mover estes casos para dentro daquele `describe.serial`, ou
 * extrair um `storageState` de admin como fixture compartilhada. A segunda é a
 * que escala; a primeira é a que dá para fazer hoje.
 *
 * E precisa de matéria PUBLICADA no seed: o seletor só marca o que o domínio
 * arquiva (`PUBLICADA`/`ATUALIZADA`), então um seed só de rascunhos faria o
 * teste passar com a tabela toda desabilitada — verde sem ter exercitado nada.
 */
test.describe("painel — arquivar matérias", () => {
	test.fixme("a lista NÃO mostra matéria arquivada por padrão", async () => {});

	test.fixme("'Mostrar arquivadas' traz o arquivo de volta e o botão volta a ocultar", async () => {});

	test.fixme("a caixinha da linha só existe para matéria no ar (rascunho fica desabilitado)", async () => {});

	test.fixme("marcar duas linhas mostra a barra com a contagem certa", async () => {});

	test.fixme("a caixinha do cabeçalho marca só o que é arquivável da página", async () => {});

	test.fixme("arquivar em lote pede confirmação e some da lista ao confirmar", async () => {});

	test.fixme("cancelar a confirmação não arquiva nada", async () => {});

	test.fixme("o item 'Arquivar' das elipses arquiva UMA matéria, com confirmação", async () => {});

	test.fixme("virar a página descarta a seleção da página anterior", async () => {});
});

/**
 * ESQUELETO — apagar matéria.
 *
 * A parte que DECIDE tem teste de verdade, em três camadas: o agregado recusa
 * apagar o que está no ar (`article-workflow.test.ts`), o caso de uso exige a
 * permissão de despublicar para o que já esteve publicado e relata o lote
 * parcial (`manage-articles.test.ts`), e a tela sabe quem pode o quê e quando
 * cobrar a palavra digitada (`article-selection.test.ts`).
 *
 * O que falta aqui é o que só o navegador prova, e é a parte mais perigosa
 * desta entrega: que o botão destravado corresponde à palavra digitada, e que
 * a linha some da tela — não a linha vizinha. Um erro de mira no `onClick` de
 * um `DropdownMenuItem` apaga a matéria errada com todos os testes verdes.
 *
 * Herda o mesmo bloqueio dos casos acima: falta uma sessão de staff
 * compartilhada, porque `auth.spec.ts` reivindica a vaga do primeiro usuário
 * (que é o único que nasce ADMIN sem convite).
 */
test.describe("painel — apagar matérias", () => {
	test.fixme("matéria PUBLICADA não oferece 'Apagar' nas elipses", async () => {});

	test.fixme("apagar um rascunho que nunca foi ao ar confirma com um clique, sem digitar", async () => {});

	test.fixme("apagar matéria que já esteve publicada exige digitar APAGAR", async () => {});

	test.fixme("o botão de confirmar fica travado enquanto a palavra não confere", async () => {});

	test.fixme("reabrir o diálogo depois de confirmar volta com o campo vazio", async () => {});

	test.fixme("apagar em lote pega só o que pode e avisa do que ficou de fora", async () => {});

	test.fixme("a barra mostra a contagem de cada ação, não o total marcado", async () => {});

	test.fixme("apagar pela tela da matéria volta para a lista", async () => {});

	test.fixme("a matéria apagada continua aparecendo na auditoria, com o título", async () => {});
});

/**
 * ESQUELETO — as saídas do rascunho incompleto.
 *
 * O caso que originou a mudança: a matéria criada por engano, sem corpo e sem
 * editoria, cujo único botão era "Enviar para revisão". O que o navegador
 * precisa provar é que as duas saídas aparecem SEM as pendências resolvidas —
 * um `disabled` herdado do fluxo de publicação recriaria o beco sem saída, e
 * nenhum teste de unidade veria isso.
 */
test.describe("painel — arquivar e apagar o rascunho incompleto", () => {
	test.fixme("o rascunho sem corpo, editoria e capa oferece Arquivar e Apagar", async () => {});

	test.fixme("arquivar pela tela da matéria pede confirmação antes", async () => {});

	test.fixme("matéria arquivada não oferece mais 'Arquivar'", async () => {});
});

/**
 * ESQUELETO — o envio direto de imagem pelo diálogo de capa.
 *
 * Mesma situação: o fluxo de upload em si (`useDirectUpload`) fala com o
 * storage por URL pré-assinada, o que um E2E só exercita de verdade com o
 * MinIO de pé. Vale registrar mesmo assim, porque o defeito clássico aqui é
 * mudo: a imagem sobe, entra no acervo e NÃO vira a capa — e a tela não avisa.
 */
test.describe("painel — capa da matéria", () => {
	test.fixme("enviar do computador pelo diálogo de capa já define a capa e fecha o diálogo", async () => {});

	test.fixme("crédito e texto alternativo continuam obrigatórios no envio direto", async () => {});

	test.fixme("fechar o diálogo no meio do envio descarta o arquivo escolhido", async () => {});
});

/**
 * ESQUELETO — colunas congeladas e redimensionáveis.
 *
 * A ARITMÉTICA tem teste de verdade (`apps/web/tests/unit/table-columns.test.ts`,
 * 30 casos): limites, deslocamento das congeladas, o que se guarda e o que se
 * descarta ao ler o disco. O que falta aqui é o que só o NAVEGADOR sabe — se a
 * célula realmente gruda ao rolar, se o fundo dela é opaco o bastante para o
 * conteúdo não passar por baixo, e se o gesto de arrastar chega ao fim.
 *
 * Este último já mordeu uma vez: a primeira versão lia o estado do React dentro
 * dos handlers de ponteiro, e num arrasto RÁPIDO os três eventos caem no mesmo
 * tick — o `pointerup` via `dragging === false` e abortava antes de gravar. Foi
 * pego na verificação manual, não por teste. É exatamente o caso que o
 * `dragTo` do Playwright reproduz de graça.
 */
test.describe("painel — colunas da lista", () => {
	test.fixme("caixinha e título ficam parados enquanto o resto rola", async () => {});

	test.fixme("a célula congelada tem fundo opaco — nada passa por baixo ao rolar", async () => {});

	test.fixme("arrastar a alça do título muda a largura, inclusive num gesto rápido", async () => {});

	test.fixme("arrastar além do mínimo trava no mínimo", async () => {});

	test.fixme("a alça responde ao teclado (setas, Shift+seta e Home)", async () => {});

	test.fixme("a largura escolhida sobrevive ao recarregamento", async () => {});

	test.fixme("'Restaurar largura das colunas' devolve o padrão e some do menu", async () => {});
});
