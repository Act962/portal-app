import { Container } from "@portal-app/ui/components/container";

import { QuotesStrip } from "@/components/finance/quotes-strip";
import { SocialLinkList } from "@/components/social/social-link-list";
import { loadSiteSettings } from "@/data/queries";
import { loadQuotes } from "@/data/quotes";
import { loadWeather } from "@/data/weather";
import { formatLongDate } from "@/lib/format";
import { formatTemperature } from "@/lib/weather";

export async function TopBar() {
	// A temperatura era `"32°C"` ESCRITO NO CÓDIGO (D12) — um valor que parecia
	// dado ao vivo e mentia todo dia, inclusive quando chovia. Agora vem da
	// Open-Meteo, para a cidade das Configurações. Quando não há leitura, o
	// trecho some: cidade e estado seguem sozinhos, e é melhor não dizer nada
	// sobre o tempo do que dizer um número inventado.
	const [site, weather, quotes] = await Promise.all([
		loadSiteSettings(),
		// Em paralelo, não em série: são dois terceiros na rede, e o cabeçalho
		// está em TODA página do portal. Nenhum dos dois é uma requisição por
		// visita — `data/weather.ts` e `data/quotes.ts` envolvem o fetch em
		// `unstable_cache`, que guarda inclusive a FALHA (a cicatriz do 429 da
		// AwesomeAPI, registrada em `docs/pendencias.md`).
		loadWeather(),
		loadQuotes(),
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

	return (
		// Data, clima, cotações e redes são mobiliário de desktop — num celular
		// empurrariam a manchete para fora da dobra sem nada em troca.
		<div className="hidden border-hairline border-b bg-surface text-ink md:block">
			<Container className="flex items-center gap-x-4 py-2 font-mono text-[11px] tracking-[0.04em]">
				<time dateTime={today.toISOString()}>{formatLongDate(today)}</time>

				<span aria-hidden className="text-meta-soft">
					|
				</span>

				<span>
					{site.city.toUpperCase()} — {site.state}
					{weather ? (
						<>
							{" · "}
							{/* A condição fica no `title` e no texto invisível, não na
							    barra: ela é estreita, e "Predominantemente claro" ao lado
							    da data empurraria as cotações para a segunda linha. Quem
							    usa leitor de tela recebe a frase inteira. */}
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

				{/*
				  Os dois atalhos institucionais que ficavam aqui saíram: o espaço
				  passou a ser das cotações, e eles continuam no `/menu` e no rodapé,
				  onde já apareciam. Repetir o mesmo link em três lugares não é
				  navegação — é ruído numa barra de 11px.
				*/}
				<QuotesStrip quotes={quotes} />

				<span aria-hidden className="text-meta-soft">
					|
				</span>

				<SocialLinkList
					links={site.social}
					siteName={site.name}
					className="flex items-center gap-2"
					linkClassName="flex size-7 items-center justify-center rounded-full border border-hairline-strong text-brand-deep transition-colors hover:border-brand-deep hover:bg-brand-deep hover:text-white"
					iconClassName="size-3.5"
				/>
			</Container>
		</div>
	);
}
