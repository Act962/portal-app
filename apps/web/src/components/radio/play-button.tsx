"use client";

import { cn } from "@portal-app/ui/lib/utils";
import { Pause, Play } from "lucide-react";

import { useLivePlayer } from "./live-player-provider";

const SIZES = {
	sm: { button: "size-[30px]", icon: 12 },
	lg: { button: "size-16", icon: 24 },
} as const;

type PlayButtonProps = {
	size?: keyof typeof SIZES;
	/** `on-red` sits inside the red header pill; `solid` is the standalone hero. */
	tone?: "on-red" | "solid";
	className?: string;
};

/** Transport control for the live stream. The only interactive part of the pill. */
export function PlayButton({
	size = "sm",
	tone = "on-red",
	className,
}: PlayButtonProps) {
	const { isPlaying, toggle, showName, canPlay } = useLivePlayer();
	const spec = SIZES[size];
	const Icon = isPlaying ? Pause : Play;

	return (
		<button
			type="button"
			onClick={toggle}
			// Sem stream configurado o controle se desabilita e diz por quê, em vez
			// de aceitar o clique e não emitir som (spec 05b, D11).
			disabled={!canPlay}
			title={canPlay ? undefined : "Transmissão ao vivo ainda não configurada"}
			aria-pressed={isPlaying}
			aria-label={
				canPlay
					? isPlaying
						? `Pausar transmissão de ${showName}`
						: `Ouvir ao vivo: ${showName}`
					: "Transmissão ao vivo ainda não configurada"
			}
			className={cn(
				"flex shrink-0 items-center justify-center rounded-full transition-transform focus-visible:outline-2 focus-visible:outline-white focus-visible:outline-offset-2 active:scale-95",
				tone === "on-red"
					? "bg-white text-brand-red"
					: "bg-brand-red text-white",
				!canPlay && "cursor-not-allowed opacity-50",
				spec.button,
				className,
			)}
		>
			<Icon
				size={spec.icon}
				fill="currentColor"
				strokeWidth={0}
				className={isPlaying ? "" : "ml-0.5"}
			/>
		</button>
	);
}
