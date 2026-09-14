"use client";

import { Skeleton } from "@portal-app/ui/components/skeleton";
import dynamic from "next/dynamic";

/**
 * O editor só existe no navegador: o palco Konva mede a tela e desenha em
 * canvas, e não há o que o servidor renderize antes. Carregado à parte, o
 * Konva também não pesa nas outras telas do painel.
 */
const TemplateEditor = dynamic(
	() =>
		import("../editor/template-editor").then((module) => module.TemplateEditor),
	{
		ssr: false,
		loading: () => <Skeleton className="h-[calc(100dvh-8rem)] w-full" />,
	},
);

export function TemplateEditorLoader(props: {
	id: string;
	canDesign: boolean;
}) {
	return <TemplateEditor {...props} />;
}
