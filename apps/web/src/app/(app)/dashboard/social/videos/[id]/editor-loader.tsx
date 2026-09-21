"use client";

import { Skeleton } from "@portal-app/ui/components/skeleton";
import dynamic from "next/dynamic";

/**
 * O editor só existe no navegador: a prévia mede a tela, desenha a cena em
 * canvas e toca um `<video>`. Carregado à parte, o Konva não pesa nas outras
 * telas do painel — o mesmo arranjo do editor de padrões.
 */
const VideoEditor = dynamic(
	() => import("../video-editor").then((module) => module.VideoEditor),
	{
		ssr: false,
		loading: () => <Skeleton className="h-[calc(100dvh-8rem)] w-full" />,
	},
);

export function VideoEditorLoader(props: { id: string; canDesign: boolean }) {
	return <VideoEditor {...props} />;
}
