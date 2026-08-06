import { timingSafeEqual } from "node:crypto";
import {
	articleDeps,
	dispatchEditorialEvents,
} from "@portal-app/api/editorial";
import { publishDueScheduled } from "@portal-app/editorial";
import { env } from "@portal-app/env/server";

/**
 * Publica as matérias agendadas cujo horário já venceu (A13).
 *
 * O caso de uso existia desde a Fase 3, mas o único gatilho era um clique no
 * menu da lista de matérias — ou seja, uma matéria agendada para as 6h ficava
 * parada até alguém abrir o painel. Agendamento que depende de um humano
 * lembrar não é agendamento. Esta rota é o gatilho automático.
 *
 * É de propósito um endpoint HTTP burro, autenticado por um segredo no header:
 * qualquer agendador o dirige — o cron da Vercel, um `node-cron`, um cron de
 * sistema com `curl`, um serviço externo. Trocar de agendador não toca em
 * código, o que mantém a infra sem amarras (§5.1).
 *
 * A rota é dinâmica e não guarda cache: cada chamada consulta o banco.
 */
export const dynamic = "force-dynamic";

export async function GET(request: Request): Promise<Response> {
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

	const published = await publishDueScheduled(articleDeps);
	// O mesmo despacho que roda depois de cada mutação editorial: sem ele, os
	// eventos das matérias publicadas aqui ficariam parados no outbox e a
	// auditoria não registraria a publicação.
	await dispatchEditorialEvents();

	return Response.json({
		published: published.length,
		ids: published.map((article) => article.id),
	});
}

/** Comparação de tempo constante — o segredo é uma credencial, e comparar com
 * `===` vaza, pelo tempo de resposta, quantos caracteres bateram. */
function matches(received: string, expected: string): boolean {
	const a = Buffer.from(received);
	const b = Buffer.from(expected);
	// `timingSafeEqual` exige o mesmo tamanho; o próprio tamanho não é segredo.
	return a.length === b.length && timingSafeEqual(a, b);
}
