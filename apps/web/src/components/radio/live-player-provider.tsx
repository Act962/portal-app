"use client";

import { createContext, useContext, useEffect, useRef, useState } from "react";

import { siteConfig } from "@/config/site";
import { LIVE_SHOW } from "@/data/radio";

type LivePlayerContextValue = {
	isPlaying: boolean;
	/** Programme currently on air, shown next to the transport controls. */
	showName: string;
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
}: {
	children: React.ReactNode;
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
		toggle: () => setIsPlaying((playing) => !playing),
	};

	return (
		<LivePlayerContext.Provider value={value}>
			{children}
			{siteConfig.radio.streamUrl ? (
				<audio ref={audioRef} src={siteConfig.radio.streamUrl} preload="none">
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
