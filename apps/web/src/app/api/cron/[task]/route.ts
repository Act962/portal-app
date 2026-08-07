import { timingSafeEqual } from "node:crypto";
import { scheduler } from "@portal-app/api/scheduler";
import { env } from "@portal-app/env/server";

/**
 * Driver HTTP do agendamento (ADR 0007).
 *
 * Um endpoint burro, autenticado por segredo no header, que resolve a tarefa
 * pelo nome no registro (`packages/api/src/scheduler.ts`) e a executa. Quem o
 * chama é irrelevante para o código: hoje é o cron da Vercel, amanhã pode ser
 * um `node-cron`, um `curl` no crontab do VPS ou uma função Inngest.
 *
 * O segmento é dinâmico de propósito: registrar uma tarefa nova passa a ser uma
 * linha na raiz de composição mais uma entrada no `vercel.json` — nenhuma rota
 * nova, nenhuma duplicação desta autenticação. Antes disto havia uma rota fixa
 * por tarefa, e a segunda tarefa teria copiado este arquivo inteiro.
 *
 * Dinâmica e sem cache: cada chamada consulta o banco.
 */
export const dynamic = "force-dynamic";

export async function GET(
	request: Request,
	{ params }: { params: Promise<{ task: string }> },
): Promise<Response> {
	const secret = env.CRON_SECRET;

	// Sem segredo configurado a rota NÃO abre — recusa. O contrário deixaria
	// qualquer um na internet disparando publicação no portal.
	if (!secret) {
		return Response.json(
			{ error: "CRON_SECRET não configurado — gatilho desabilitado." },
			{ status: 503 },
		);
	}

	const header = request.headers.get("authorization") ?? "";
	if (!matches(header, `Bearer ${secret}`)) {
		return Response.json({ error: "Não autorizado." }, { status: 401 });
	}

	// A autenticação vem ANTES de resolver o nome, de propósito: responder "essa
	// tarefa não existe" a quem não provou o segredo entregaria a lista de
	// tarefas por tentativa e erro.
	const { task } = await params;
	const result = await scheduler.run(task);

	if (result.isErr()) {
		return Response.json(
			{ error: `Tarefa "${task}" não existe.`, known: result.error.known },
			{ status: 404 },
		);
	}

	return Response.json(result.unwrap());
}

/** Comparação de tempo constante — o segredo é uma credencial, e comparar com
 * `===` vaza, pelo tempo de resposta, quantos caracteres bateram. */
function matches(received: string, expected: string): boolean {
	const a = Buffer.from(received);
	const b = Buffer.from(expected);
	// `timingSafeEqual` exige o mesmo tamanho; o próprio tamanho não é segredo.
	return a.length === b.length && timingSafeEqual(a, b);
}
