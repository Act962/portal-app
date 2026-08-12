import { Container } from "@portal-app/ui/components/container";

import { SiteLink } from "@/components/layout/site-link";
import { SocialLinkList } from "@/components/social/social-link-list";
import { loadSiteSettings } from "@/data/queries";
import { loadWeather } from "@/data/weather";
import { formatLongDate } from "@/lib/format";
import { formatTemperature } from "@/lib/weather";

export async function TopBar() {
	// A temperatura era `"32°C"` ESCRITO NO CÓDIGO (D12) — um valor que parecia
	// dado ao vivo e mentia todo dia, inclusive quando chovia. Agora vem da
	// Open-Meteo, para a cidade das Configurações. Quando não há leitura, o
	// trecho some: cidade e estado seguem sozinhos, e é melhor não dizer nada
	// sobre o tempo do que dizer um número inventado.
	const [site, weather] = await Promise.all([
		loadSiteSettings(),
		// Em paralelo, não em série: é rede a um terceiro, e o cabeçalho está em
		// TODA página do portal.
		loadWeather(),
	]);
	// A data de HOJE, não a de um instante herdado das fixtures — que deixava o
	// cabeçalho parado em 3 de agosto de 2026 em todas as páginas. É o mesmo
	// defeito que fazia toda matéria aparecer como "há 1 min".
	//
	// Server component: o valor é calculado no servidor e não hidrata, então não
	// há divergência cliente/servidor. O `revalidate = 60` do layout renova o
	// HTML em cache, então a virada de dia aparece com no máximo um minuto de
	// atraso. `formatLongDate` já formata no fuso da redação, e não no do
	// servidor — a data não pula quando a Vercel roda em UTC.
	const today = new Date();

	// Só os dois primeiros que têm destino: a barra é estreita e o rodapé já
	// lista todos.
	const shortcuts = site.institutional.filter((link) => link.href).slice(0, 2);

	return (
		// Date, weather and social links are desktop furniture — on a phone they
		// would push the first headline below the fold for no benefit.
		<div className="hidden bg-brand-navy font-mono text-[11px] text-on-navy-muted tracking-[0.04em] md:block">
			<Container className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
				<time dateTime={today.toISOString()}>{formatLongDate(today)}</time>

				<span aria-hidden className="text-on-navy-rule">
					|
				</span>

				<span>
					{site.city.toUpperCase()} — {site.state}
					{weather ? (
						<>
							{" · "}
							{/* A condição fica no `title` e no texto invisível, não na
							    barra: ela é estreita, e "Predominantemente claro" ao lado
							    da data empurraria as redes para a segunda linha. Quem usa
							    leitor de tela recebe a frase inteira. */}
							<span title={weather.condition ?? undefined}>
								{formatTemperature(weather.temperature)}
							</span>
							{weather.condition ? (
								<span className="sr-only">, {weather.condition}</span>
							) : null}
						</>
					) : null}
				</span>

				<div className="flex-1" />

				{/* Atalho para os institucionais que JÁ TÊM destino. Antes eram dois
				    links fixos (`#anuncie`, `#redacao`) apontando para âncoras
				    inexistentes; agora saem das configurações e, enquanto ninguém
				    preenche o endereço, a barra simplesmente não os mostra (D9). */}
				{shortcuts.length > 0 ? (
					<>
						<nav aria-label="Institucional" className="flex items-center gap-4">
							{shortcuts.map((link) => (
								<SiteLink
									key={link.label}
									link={link}
									className="text-on-navy-muted uppercase hover:text-white"
								/>
							))}
						</nav>

						<span aria-hidden className="text-on-navy-rule">
							|
						</span>
					</>
				) : null}

				<SocialLinkList
					links={site.social}
					siteName={site.name}
					className="flex items-center gap-3"
					linkClassName="text-on-navy-muted transition-colors hover:text-white"
				/>
			</Container>
		</div>
	);
}
