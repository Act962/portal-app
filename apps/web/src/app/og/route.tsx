import { ImageResponse } from "next/og";

import { loadSiteIdentity } from "@/lib/seo/load-site-identity";

/**
 * A imagem social do portal (spec 07, D4).
 *
 * `GET /og?title=…&eyebrow=…` devolve um PNG 1200×630 com a marca e o título da
 * página. É o que aparece quando alguém cola um link do portal no WhatsApp — o
 * formato que o leitor local mais vê, e que até aqui saía sem imagem nenhuma
 * fora das matérias com capa.
 *
 * Gerada, e não um `og-default.png` fixo: um cartão único para as 13 páginas
 * vira ruído indistinguível no feed. Assim cada página leva o próprio título,
 * sem nenhum asset binário no repositório.
 *
 * O texto vem da query, então é público e não confiável: truncado aqui também
 * (quem monta a URL já trunca, mas a rota é chamável direto) e nunca
 * interpretado como HTML — o Satori renderiza texto, não marcação.
 */
export const runtime = "nodejs";

const SIZE = { width: 1200, height: 630 } as const;

const DEEP = "#6b0206";
const RED = "#ed1b24";
const CANVAS = "#faf9f7";

const TITLE_MAX = 110;
const EYEBROW_MAX = 40;

function clamp(value: string | null, max: number): string {
	if (!value) {
		return "";
	}
	const clean = value.replace(/\s+/g, " ").trim();
	return clean.length <= max ? clean : `${clean.slice(0, max - 1)}…`;
}

export async function GET(request: Request) {
	const params = new URL(request.url).searchParams;
	const site = await loadSiteIdentity();

	const title = clamp(params.get("title"), TITLE_MAX) || site.name;
	const eyebrow = clamp(params.get("eyebrow"), EYEBROW_MAX) || site.shortName;

	// Título curto ganha corpo maior. Um tamanho único deixaria a manchete de
	// duas palavras perdida no meio do cartão ou a de vinte estourando a área.
	const fontSize = title.length > 70 ? 58 : title.length > 40 ? 70 : 84;

	return new ImageResponse(
		<div
			style={{
				width: "100%",
				height: "100%",
				display: "flex",
				flexDirection: "column",
				justifyContent: "space-between",
				backgroundColor: CANVAS,
				padding: "72px 80px",
				// A faixa vermelha no topo é o único elemento de marca que sobrevive
				// à miniatura de 200px do compartilhamento.
				borderTop: `20px solid ${RED}`,
			}}
		>
			<div style={{ display: "flex", flexDirection: "column" }}>
				<div
					style={{
						fontSize: 26,
						letterSpacing: 6,
						color: RED,
						textTransform: "uppercase",
						marginBottom: 28,
					}}
				>
					{eyebrow}
				</div>
				<div
					style={{
						fontSize,
						fontWeight: 700,
						color: DEEP,
						lineHeight: 1.1,
						letterSpacing: -1.5,
					}}
				>
					{title}
				</div>
			</div>

			<div
				style={{
					display: "flex",
					alignItems: "center",
					justifyContent: "space-between",
					borderTop: `4px solid ${DEEP}`,
					paddingTop: 24,
					fontSize: 30,
					color: DEEP,
				}}
			>
				<div style={{ display: "flex", fontWeight: 700 }}>{site.name}</div>
				<div style={{ display: "flex", fontSize: 24, opacity: 0.65 }}>
					{site.url.replace(/^https?:\/\//, "")}
				</div>
			</div>
		</div>,
		{
			...SIZE,
			headers: {
				// O cartão só muda quando o título muda, e o título está na URL:
				// pode ficar no CDN por um dia inteiro.
				"cache-control": "public, max-age=0, s-maxage=86400, immutable",
			},
		},
	);
}
