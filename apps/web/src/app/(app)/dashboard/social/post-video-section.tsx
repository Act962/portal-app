"use client";

import {
	formatSeconds,
	RENDER_MAX_SECONDS,
	sequenceDuration,
	type VideoSequence,
} from "@portal-app/social";
import { buttonVariants } from "@portal-app/ui/components/button";
import { Label } from "@portal-app/ui/components/label";
import { cn } from "@portal-app/ui/lib/utils";
import { Film, Scissors } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";

/** `typedRoutes` não deriva rota dinâmica de template literal — mesma cola do
 * `templates-panel`. */
const editorRoute = (id: string) => `/dashboard/social/videos/${id}` as Route;

/**
 * A seção "Vídeo" do post: um RESUMO e a porta de entrada do editor.
 *
 * Ela já teve a barra de corte dentro do diálogo, e não dava conta: com vários
 * trechos, a linha do tempo, a prévia e o painel do padrão não cabem num
 * diálogo de 600 px sem tudo virar uma tira de rolagem. Quem edita vai para o
 * editor em tela cheia; aqui fica só o que a revisão precisa saber — quantos
 * trechos, quanto tempo no ar.
 *
 * A seção aparece MESMO sem vídeo, e é de propósito: a primeira versão sumia
 * quando o post ainda não existia, e com ela sumia a única pista de que o
 * portal monta vídeo. Quem não acha, não usa.
 */
export function PostVideoSection({
	postId,
	editable,
	clips,
}: {
	postId: string | null;
	editable: boolean;
	clips: VideoSequence;
}) {
	const total = sequenceDuration(clips);

	return (
		<div className="flex flex-col gap-3 rounded-md border p-3">
			<div className="flex flex-wrap items-start justify-between gap-2">
				<div>
					<Label>Vídeo</Label>
					<p className="mt-1 text-muted-foreground text-xs">
						Com vídeo, o post sai no Reels e nos Stories — o padrão de arte
						entra por cima, e a montagem vai ao ar com até{" "}
						{formatSeconds(RENDER_MAX_SECONDS)}.
					</p>
				</div>
				{postId ? (
					<Link
						href={editorRoute(postId)}
						className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
					>
						{clips.length > 0 ? (
							<Scissors className="size-4" />
						) : (
							<Film className="size-4" />
						)}
						{clips.length > 0 ? "Editar vídeo" : "Montar vídeo"}
					</Link>
				) : null}
			</div>

			{!postId ? (
				<p className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
					Salve o rascunho para montar o vídeo.
				</p>
			) : clips.length === 0 ? (
				<p className="rounded-md border border-dashed p-4 text-center text-muted-foreground text-sm">
					Nenhum vídeo ainda — este post sai com imagens.
				</p>
			) : (
				<p className="text-sm">
					<strong>
						{clips.length} {clips.length === 1 ? "trecho" : "trechos"}
					</strong>{" "}
					· {formatSeconds(total)} no ar
					{clips.every((clip) => clip.muted) ? " · sem som" : ""}
					{editable ? "" : " · congelado (post aprovado)"}
				</p>
			)}
		</div>
	);
}
