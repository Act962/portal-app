import { IBM_Plex_Mono, Lora, Montserrat, Nunito_Sans } from "next/font/google";

/**
 * As famílias do design system, auto-hospedadas pelo `next/font` — sem requisição
 * bloqueante ao Google e sem deslocamento de layout na primeira pintura.
 *
 * Nunito Sans e Montserrat vieram do preset do shadcn (Fase 5) e substituíram a
 * Archivo em todo o produto — portal e painel. Nunito Sans é a família de
 * interface e de manchete; Montserrat fica disponível como `font-heading` para
 * as superfícies do painel. Lora segue no corpo da matéria (leitura longa) e a
 * IBM Plex Mono nos metadados (horários, chapéus, rótulos).
 *
 * Nunito Sans, Montserrat e Lora são variáveis — declarar sem `weight` entrega o
 * eixo inteiro num arquivo só, mais leve que os cortes estáticos que usamos.
 */

export const nunitoSans = Nunito_Sans({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-nunito",
});

export const montserrat = Montserrat({
	subsets: ["latin"],
	display: "swap",
	variable: "--font-montserrat",
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
	nunitoSans.variable,
	montserrat.variable,
	lora.variable,
	plexMono.variable,
].join(" ");
