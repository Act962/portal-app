import { Archivo, IBM_Plex_Mono, Lora } from "next/font/google";

/**
 * The three families of the design system, self-hosted by `next/font` so there
 * is no render-blocking request to Google and no layout shift on first paint.
 *
 * Archivo and Lora are variable fonts — declaring no `weight` ships the whole
 * axis in one file, which is lighter than the five static cuts we use.
 */

export const archivo = Archivo({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-archivo",
});

export const lora = Lora({
	subsets: ["latin"],
	display: "swap",
	style: ["normal", "italic"],
	variable: "--font-lora",
});

export const plexMono = IBM_Plex_Mono({
	subsets: ["latin"],
	display: "swap",
	weight: ["400", "500"],
	variable: "--font-plex-mono",
});

export const fontVariables = [
	archivo.variable,
	lora.variable,
	plexMono.variable,
].join(" ");
