import { describe, it } from "vitest";

/**
 * ESQUELETO — ver a regra dos testes no `CLAUDE.md`.
 *
 * Cobre os dois defeitos de autorização já corrigidos no Bloco A. Ambos eram do
 * tipo que a interface esconde: a página redirecionava direito, mas a procedure
 * estava aberta a quem chamasse a API pela rede. Hoje nada impede a regressão
 * voltar — a correção vive só no código, sem uma linha que a defenda.
 *
 * ⚠️ ARQUITETURA — LEIA ANTES DE IMPLEMENTAR
 *
 * Estes casos ainda NÃO dão para escrever como unidade. `packages/api/src/staff.ts`
 * instancia `staffRepo` na carga do módulo:
 *
 *     export const staffRepo = new PrismaStaffRepository(createPrismaClient());
 *
 * Importar qualquer router arrasta o Prisma junto, então não há como injetar um
 * repositório falso e o teste vira integração (Testcontainers), muito mais caro
 * e lento do que o que se quer verificar: uma decisão de permissão, que é lógica
 * pura.
 *
 * O destravamento é tornar a raiz de composição injetável — uma factory
 * (`createAppRouter(deps)`) em vez de singletons de módulo, com a composição
 * real montada uma vez em `apps/web`. Vale o esforço: é o mesmo movimento que
 * deixa TODO router testável, não só estes dois casos. Enquanto não acontecer,
 * estes `it.todo` são o registro da lacuna.
 */
describe("autorização dos routers", () => {
	// --- taxonomy.sections.list ---------------------------------------------
	// Era `requirePermission("taxonomy:manage")`, o que impedia um REDATOR de
	// abrir o seletor de editoria ao escrever — ou seja, quebrava o fluxo básico.
	it.todo("sections.list responde a qualquer membro ativo");
	it.todo("sections.list nega quem não é membro");
	it.todo("sections.create continua exigindo taxonomy:manage");

	// --- audit.list ----------------------------------------------------------
	// Estava aberta a qualquer membro ativo: a página redirecionava, a API não.
	it.todo("audit.list exige audit:view");
	it.todo("audit.list nega EDITOR e REDATOR");
	it.todo("audit.list permite ADMIN");

	// --- o contrato geral ----------------------------------------------------
	it.todo("protectedProcedure responde UNAUTHORIZED sem sessão");
	it.todo("staffProcedure responde FORBIDDEN para membro desativado");
});
