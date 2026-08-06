import { Container } from "@portal-app/ui/components/container";

import { siteConfig } from "@/config/site";
import { formatLongDate } from "@/lib/format";

/** Placeholder until a weather provider is wired up. */
const CURRENT_TEMPERATURE = "32°C";

export function TopBar() {
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
		// Date, weather and social links are desktop furniture — on a phone they
		// would push the first headline below the fold for no benefit.
		<div className="hidden bg-brand-navy font-mono text-[11px] text-on-navy-muted tracking-[0.04em] md:block">
			<Container className="flex flex-wrap items-center gap-x-4 gap-y-1 py-2">
				<time dateTime={today.toISOString()}>{formatLongDate(today)}</time>

				<span aria-hidden className="text-on-navy-rule">
					|
				</span>

				<span>
					{siteConfig.city.toUpperCase()} — {siteConfig.state} ·{" "}
					{CURRENT_TEMPERATURE}
				</span>

				<div className="flex-1" />

				<nav aria-label="Institucional" className="flex items-center gap-4">
					<a href="#anuncie" className="text-on-navy-muted hover:text-white">
						ANUNCIE
					</a>
					<a href="#redacao" className="text-on-navy-muted hover:text-white">
						FALE COM A REDAÇÃO
					</a>
				</nav>

				<span aria-hidden className="text-on-navy-rule">
					|
				</span>

				<nav aria-label="Redes sociais" className="flex gap-2">
					{siteConfig.social.map((network) => (
						<a
							key={network.name}
							href={network.href}
							rel="noreferrer"
							target="_blank"
							className="text-on-navy-muted hover:text-white"
						>
							{network.name.toUpperCase()}
						</a>
					))}
				</nav>
			</Container>
		</div>
	);
}
