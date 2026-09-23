"use client";

import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import dynamic from "next/dynamic";

/**
 * O editor de vídeo dentro de um diálogo grande (spec 12, F5).
 *
 * A montagem de vídeo tem a MESMA página em tela cheia
 * (`/dashboard/social/videos/[id]`) — ela continua de pé. Este diálogo é o
 * atalho para quem está ESCREVENDO a matéria: monta o Reels/Stories sem largar
 * a página da matéria, e ao fechar volta exatamente para onde estava. O editor
 * é o mesmo componente, só sem o cabeçalho de página (`embedded`), porque o
 * diálogo já dá título e o "x".
 *
 * O Konva só existe no navegador e não deve pesar nas outras telas do painel,
 * então o editor entra por `dynamic`/`ssr:false` — o mesmo arranjo do
 * `editor-loader` da página em tela cheia. E só monta quando o diálogo abre:
 * fechado, nem a consulta nem o pacote do Konva são carregados.
 */
const VideoEditor = dynamic(
	() => import("./video-editor").then((module) => module.VideoEditor),
	{
		ssr: false,
		loading: () => <Skeleton className="h-full w-full" />,
	},
);

export function VideoEditorDialog({
	postId,
	canDesign,
	open,
	onOpenChange,
}: {
	/** O post a montar. `null` enquanto o gatilho ainda está criando o rascunho. */
	postId: string | null;
	canDesign: boolean;
	open: boolean;
	onOpenChange: (open: boolean) => void;
}) {
	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			{/*
			  ~80% da tela, como pediram: largura e altura em `vw`/`vh`, coluna
			  flex com o cabeçalho fixo e o corpo rolando por dentro. `p-0` porque
			  o cabeçalho e o corpo trazem o próprio espaçamento — sem isso o corpo
			  rolante ficaria com o padding do diálogo duplicando a borda.
			*/}
			<DialogContent className="flex h-[85vh] max-h-[85vh] w-[80vw] max-w-[80vw] flex-col gap-0 overflow-hidden p-0 sm:max-w-[80vw]">
				<DialogHeader className="border-b p-4 pr-12">
					<DialogTitle>Editor de vídeo</DialogTitle>
					<DialogDescription>
						Monte o Reels ou os Stories desta matéria sem sair da página.
					</DialogDescription>
				</DialogHeader>
				<div className="min-h-0 flex-1 overflow-y-auto p-4">
					{open && postId ? (
						<VideoEditor id={postId} canDesign={canDesign} embedded />
					) : (
						<Skeleton className="h-full w-full" />
					)}
				</div>
			</DialogContent>
		</Dialog>
	);
}
