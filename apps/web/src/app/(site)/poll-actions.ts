"use server";

import { randomUUID } from "node:crypto";
import { pollDeps } from "@portal-app/api/polls";
import { vote } from "@portal-app/polls";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";

import { ONE_YEAR_SECONDS, VOTER_COOKIE } from "@/data/polls";

/**
 * Registrar o voto do leitor (P39/Bloco 5).
 *
 * É um SERVER ACTION, e não uma chamada tRPC, porque o grupo `(site)` é 100%
 * RSC: ele não carrega o `QueryClientProvider` nem o cliente tRPC (regra do
 * CLAUDE.md — o devtools vazando no portal já foi bug uma vez). O botão de
 * votar é um client component minúsculo que só chama esta função.
 *
 * O `voterToken` é criado AQUI, no servidor, e vai num cookie httpOnly: assim
 * o cliente não consegue forjá-lo para votar de novo. Ele é opaco e não
 * identifica pessoa (LGPD/N09) — a garantia contra voto duplo é a chave única
 * `pollId + voterToken` no banco.
 */
export async function submitVote(
	pollId: string,
	optionId: string,
): Promise<{ ok: boolean; message?: string }> {
	const jar = await cookies();
	let token = jar.get(VOTER_COOKIE)?.value;

	if (!token) {
		token = randomUUID();
		jar.set(VOTER_COOKIE, token, {
			httpOnly: true,
			sameSite: "lax",
			// `secure` só em produção: em dev o portal roda em http://localhost e
			// o cookie seria descartado pelo browser.
			secure: process.env.NODE_ENV === "production",
			path: "/",
			maxAge: ONE_YEAR_SECONDS,
		});
	}

	const result = await vote({ pollId, optionId, voterToken: token }, pollDeps);

	if (result.isErr()) {
		return { ok: false, message: result.unwrapErr().message };
	}

	// Revalida a home para o resultado aparecer no lugar do formulário — quem
	// mostra os números é o servidor, que só os envia depois do voto.
	revalidatePath("/");
	return { ok: true };
}
