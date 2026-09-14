"use client";

// As famílias dos padrões de arte (spec 10, D4), só o subconjunto latino — o
// que o português usa. São os MESMOS arquivos `@fontsource` que o servidor
// registra no skia: a medida do texto no editor e na arte publicada é a mesma.
import "@fontsource/montserrat/latin-400.css";
import "@fontsource/montserrat/latin-400-italic.css";
import "@fontsource/montserrat/latin-500.css";
import "@fontsource/montserrat/latin-500-italic.css";
import "@fontsource/montserrat/latin-600.css";
import "@fontsource/montserrat/latin-600-italic.css";
import "@fontsource/montserrat/latin-700.css";
import "@fontsource/montserrat/latin-700-italic.css";
import "@fontsource/montserrat/latin-800.css";
import "@fontsource/montserrat/latin-800-italic.css";
import "@fontsource/montserrat/latin-900.css";
import "@fontsource/montserrat/latin-900-italic.css";
import "@fontsource/poppins/latin-400.css";
import "@fontsource/poppins/latin-400-italic.css";
import "@fontsource/poppins/latin-500.css";
import "@fontsource/poppins/latin-500-italic.css";
import "@fontsource/poppins/latin-600.css";
import "@fontsource/poppins/latin-600-italic.css";
import "@fontsource/poppins/latin-700.css";
import "@fontsource/poppins/latin-700-italic.css";
import "@fontsource/poppins/latin-800.css";
import "@fontsource/poppins/latin-800-italic.css";
import "@fontsource/poppins/latin-900.css";
import "@fontsource/poppins/latin-900-italic.css";
import "@fontsource/nunito-sans/latin-400.css";
import "@fontsource/nunito-sans/latin-400-italic.css";
import "@fontsource/nunito-sans/latin-500.css";
import "@fontsource/nunito-sans/latin-500-italic.css";
import "@fontsource/nunito-sans/latin-600.css";
import "@fontsource/nunito-sans/latin-600-italic.css";
import "@fontsource/nunito-sans/latin-700.css";
import "@fontsource/nunito-sans/latin-700-italic.css";
import "@fontsource/nunito-sans/latin-800.css";
import "@fontsource/nunito-sans/latin-800-italic.css";
import "@fontsource/nunito-sans/latin-900.css";
import "@fontsource/nunito-sans/latin-900-italic.css";
import "@fontsource/oswald/latin-400.css";
import "@fontsource/oswald/latin-500.css";
import "@fontsource/oswald/latin-600.css";
import "@fontsource/oswald/latin-700.css";
import "@fontsource/lora/latin-400.css";
import "@fontsource/lora/latin-400-italic.css";
import "@fontsource/lora/latin-500.css";
import "@fontsource/lora/latin-500-italic.css";
import "@fontsource/lora/latin-600.css";
import "@fontsource/lora/latin-600-italic.css";
import "@fontsource/lora/latin-700.css";
import "@fontsource/lora/latin-700-italic.css";

import { cssFontOf, fontCutsOf } from "@portal-app/art-scene";
import type { ArtDesign } from "@portal-app/social";
import { useEffect, useState } from "react";

/**
 * Espera o navegador carregar os cortes que o desenho usa.
 *
 * O `@font-face` só baixa o arquivo quando alguém usa a fonte — e o canvas não
 * dispara isso: sem esperar, o Konva mediria com a fonte de reserva, e o texto
 * quebraria diferente da arte publicada até o próximo redesenho.
 */
export async function ensureArtFonts(design: ArtDesign): Promise<void> {
	if (typeof document === "undefined" || !("fonts" in document)) {
		return;
	}
	await Promise.all(
		fontCutsOf(design).map((cut) =>
			document.fonts
				.load(cssFontOf(cut), "ÁÉÍÓÚÇÃÕ áéíóúçãõ AZ az 09")
				.catch(() => []),
		),
	);
}

/** `true` quando as fontes do desenho estão prontas — e de novo a cada corte novo. */
export function useArtFontsReady(design: ArtDesign): boolean {
	const key = JSON.stringify(fontCutsOf(design));
	const [ready, setReady] = useState<string | null>(null);
	// biome-ignore lint/correctness/useExhaustiveDependencies: carrega pela chave dos cortes, não a cada desenho
	useEffect(() => {
		let active = true;
		ensureArtFonts(design).then(() => {
			if (active) {
				setReady(key);
			}
		});
		return () => {
			active = false;
		};
	}, [key]);
	return ready === key;
}
