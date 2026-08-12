import { describe, it } from "vitest";

/**
 * ESQUELETO — ver a regra dos testes no `CLAUDE.md`.
 *
 * Cobre o defeito do alt-text da capa, corrigido em `routers/editorial.ts` com
 * o `resolveCover`.
 *
 * O defeito: a `Cover` guarda uma CÓPIA do alt-text (o editorial precisa
 * verificar "capa com alt-text" sem consultar o contexto de mídia), e quem
 * preenchia essa cópia era a tela. O autosave do editor dispara um segundo
 * depois do clique — antes de a mídia recém-escolhida chegar ao cliente —, então
 * gravava `""`. A matéria ficava com a pendência "a imagem de capa precisa de
 * texto alternativo" para sempre, apesar de a imagem TER alt-text, e nada
 * mandava salvar de novo para desfazer.
 *
 * A correção move a resolução para o servidor: quem sabe o alt-text de um
 * arquivo é o arquivo.
 *
 * ⚠️ ARQUITETURA — LEIA ANTES DE IMPLEMENTAR
 *
 * Vale aqui o mesmo impedimento do `authorization.test.ts`: `packages/api/src/media.ts`
 * instancia `mediaDeps` na carga do módulo, com `createPrismaClient()` dentro.
 * Importar o router arrasta o Prisma, e não há onde injetar um repositório
 * falso.
 *
 * O caminho barato é extrair `resolveCover` para um módulo próprio que receba
 * `deps` por parâmetro (como fazem os casos de uso dos contextos). Aí estes
 * casos viram unidade de verdade, com um `InMemoryMediaRepository`. Enquanto
 * isso não acontece, só dá para cobrir por integração — que é caro demais para
 * o que se quer verificar: de onde vem uma string.
 */
describe.todo("resolveCover — o alt-text da capa vem do arquivo", () => {
	it.todo(
		"usa o alt-text do MediaAsset, ignorando o que o cliente mandou como cópia",
	);

	it.todo(
		"cliente mandando altText vazio não zera a capa quando o arquivo tem alt-text",
	);

	it.todo(
		"corrigir o alt-text na biblioteca sincroniza a cópia no salvamento seguinte",
	);

	it.todo("mediaId de arquivo inexistente cai no que veio do cliente");

	it.todo("cover null continua removendo a capa");

	it.todo("cover ausente (undefined) não mexe na capa que já está lá");
});
