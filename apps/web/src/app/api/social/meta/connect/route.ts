import { randomBytes } from "node:crypto";
import {
	META_COOKIE_MAX_AGE_SECONDS,
	META_STATE_COOKIE,
	metaAuthorizeUrl,
} from "@portal-app/api/social";
import { resolveStaff } from "@portal-app/api/staff";
import { env } from "@portal-app/env/server";
import { can } from "@portal-app/identity";
import { type NextRequest, NextResponse } from "next/server";

/**
 * Início do login da Meta (spec 08, §6.4). Gera o `state`, guarda num cookie e
 * manda a pessoa para o diálogo da Meta.
 *
 * Só quem tem `social:manage`: conectar é entregar à aplicação um token que fala
 * em nome do veículo. A checagem é AQUI, e não só na volta, para ninguém sem
 * permissão ser levado a autorizar um App à toa.
 */
export const dynamic = "force-dynamic";

export async function GET(request: NextRequest): Promise<Response> {
	const base = env.BETTER_AUTH_URL;
	const { staff } = await resolveStaff(request.headers);

	if (!staff || !can(staff, "social:manage")) {
		return NextResponse.redirect(new URL("/dashboard", base));
	}
	const state = randomBytes(24).toString("base64url");
	const authorizeUrl = metaAuthorizeUrl(state);
	if (!authorizeUrl) {
		return NextResponse.redirect(
			new URL("/dashboard/social?aba=contas&meta=nao-configurado", base),
		);
	}

	const response = NextResponse.redirect(authorizeUrl);
	response.cookies.set(META_STATE_COOKIE, state, {
		httpOnly: true,
		secure: base.startsWith("https://"),
		// `lax` e não `strict`: a volta do login é uma navegação vinda de
		// facebook.com, e com `strict` o navegador não mandaria o cookie nela.
		sameSite: "lax",
		path: "/api/social/meta",
		maxAge: META_COOKIE_MAX_AGE_SECONDS,
	});
	return response;
}
