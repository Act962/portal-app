"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

import { LIVE_SHOW } from "@/data/radio";

type LivePlayerContextValue = {
	isPlaying: boolean;
	/** Programme currently on air, shown next to the transport controls. */
	showName: string;
	/** Falso quando não há stream configurado — os controles se desabilitam em
	 * vez de fingir que tocam. */
	canPlay: boolean;
	toggle: () => void;
};

const LivePlayerContext = createContext<LivePlayerContextValue | null>(null);

/**
 * Owns the single `<audio>` element for the whole site.
 *
 * It lives above the layout on purpose: mounting the player inside a page
 * would tear the audio down on every navigation, cutting the broadcast off
 * mid-sentence. This is the behaviour the design system calls out for
 * `<LivePlayer>`.
 */
export function LivePlayerProvider({
	children,
	streamUrl,
}: {
	children: React.ReactNode;
	/**
	 * Vem do servidor (spec 05b, D11). É prop, e não leitura direta, porque este
	 * é o único componente cliente da moldura do portal — e configuração do
	 * veículo mora no banco, que o cliente não alcança.
	 */
	streamUrl: string | null;
}) {
	const [isPlaying, setIsPlaying] = useState(false);
	const audioRef = useRef<HTMLAudioElement>(null);

	useEffect(() => {
		const audio = audioRef.current;

		if (!audio) {
			return;
		}

		if (isPlaying) {
			// Autoplay policies can reject this; fall back to the paused state
			// rather than showing a "playing" control that produces no sound.
			audio.play().catch(() => setIsPlaying(false));
		} else {
			audio.pause();
		}
	}, [isPlaying]);

	const value: LivePlayerContextValue = {
		isPlaying,
		showName: LIVE_SHOW.name,
		canPlay: Boolean(streamUrl),
		// Sem stream, o clique não muda nada: melhor um controle inerte do que um
		// que troca para "tocando" e não emite som.
		toggle: () => setIsPlaying((playing) => (streamUrl ? !playing : false)),
	};

	return (
		<LivePlayerContext.Provider value={value}>
			{children}
			{streamUrl ? (
				<audio ref={audioRef} src={streamUrl} preload="none">
					<track kind="captions" />
				</audio>
			) : null}
		</LivePlayerContext.Provider>
	);
}

export function useLivePlayer(): LivePlayerContextValue {
	const context = useContext(LivePlayerContext);

	if (!context) {
		throw new Error(
			"useLivePlayer precisa estar dentro de <LivePlayerProvider>",
		);
	}

	return context;
}
