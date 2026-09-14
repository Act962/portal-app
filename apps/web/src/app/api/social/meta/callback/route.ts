import { timingSafeEqual } from "node:crypto";
import {
	META_COOKIE_MAX_AGE_SECONDS,
	META_PENDING_COOKIE,
	META_STATE_COOKIE,
	metaOAuth,
	sealPendingToken,
} from "@portal-app/api/social";
import { resolveStaff } from "@portal-app/api/staff";
import { env } from "@portal-app/env/server";
import { can } from "@portal-app/identity";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Volta do login da Meta. Confere o `state`, troca o código por um token de
 * usuário longo e o guarda — cifrado, por dez minutos — até a pessoa escolher a
 * Página na tela.
 *
 * NADA é conectado aqui. A escolha da Página é da pessoa, e quem administra
 * várias Páginas não pode ter a primeira da lista conectada por acaso.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
	const base = env.BETTER_AUTH_URL;
	const url = new URL(request.url);
	const secure = base.startsWith("https://");

	const back = (flag: string) => {
		const response = NextResponse.redirect(
			new URL(`/dashboard/social?aba=contas&meta=${flag}`, base),
		);
		// O `state` é de uso único: sai na primeira volta, tenha dado certo ou não.
		response.cookies.set(META_STATE_COOKIE, "", {
			path: "/api/social/meta",
			maxAge: 0,
		});
		return response;
	};

	const { staff } = await resolveStaff(request.headers);
	if (!staff || !can(staff, "social:manage")) {
		return NextResponse.redirect(new URL("/dashboard", base));
	}

	// A pessoa cancelou ou recusou as permissões no diálogo da Meta.
	if (url.searchParams.get("error")) {
		return back("cancelado");
	}
	if (!metaOAuth) {
		return back("nao-configurado");
	}

	const state = url.searchParams.get("state") ?? "";
	const expected = request.cookies.get(META_STATE_COOKIE)?.value ?? "";
	const code = url.searchParams.get("code");
	if (!code || !state || !expected || !sameValue(state, expected)) {
		return back("erro");
	}

	const token = await metaOAuth.exchangeCode(code);
	if (token.isErr()) {
		// A mensagem da Meta, e não o objeto inteiro: o erro não contém token,
		// mas a URL da chamada contém o segredo do App.
		console.error(
			"[social] falha ao trocar o código da Meta:",
			token.unwrapErr().message,
		);
		return back("erro");
	}

	const response = back("escolher");
	response.cookies.set(
		META_PENDING_COOKIE,
		sealPendingToken(token.unwrap(), new Date()),
		{
			httpOnly: true,
			secure,
			sameSite: "lax",
			// Só o tRPC precisa dele: é lá que a lista de Páginas é lida e a
			// escolhida é conectada. Nenhuma página do site o recebe.
			path: "/api/trpc",
			maxAge: META_COOKIE_MAX_AGE_SECONDS,
		},
	);
	return response;
}

/** Comparação de tempo constante — o `state` é o que barra o CSRF. */
function sameValue(a: string, b: string): boolean {
	const left = Buffer.from(a);
	const right = Buffer.from(b);
	return left.length === right.length && timingSafeEqual(left, right);
}
