/**
 * Ad inventory, keyed by placement. Height is declared here rather than by the
 * caller because the box must be reserved *before* any creative loads —
 * that reservation is what keeps CLS at zero.
 */
const AD_FORMATS = {
	/**
	 * A faixa logo abaixo do cabeçalho, em toda página.
	 *
	 * Substituiu o `header-desktop` (468×60), que morava DENTRO do masthead: com
	 * a marca centralizada não sobrou lugar lateral para ele. Sair de lá foi
	 * ganho de inventário, não perda — 970×90 em largura cheia vale mais que um
	 * meio-banner espremido ao lado do logo.
	 */
	billboard: {
		height: 90,
		maxWidth: 970,
		caption: "banner 970×90 — topo",
	},
	"in-content": { height: 90, caption: "banner 728×90 — meio do conteúdo" },
	sidebar: { height: 250, caption: "banner 300×250" },
	"sidebar-tall": { height: 600, caption: "banner 300×600 — lateral" },
	"mobile-top": { height: 70, caption: "banner 320×70" },
} as const satisfies Record<
	string,
	{ height: number; maxWidth?: number; caption: string }
>;

type AdFormat = keyof typeof AD_FORMATS;

type AdSlotProps = {
	format: AdFormat;
	className?: string;
};

function AdSlot({ format, className }: AdSlotProps) {
	const spec = AD_FORMATS[format];
	const maxWidth = "maxWidth" in spec ? spec.maxWidth : undefined;

	return (
		<aside aria-label="Publicidade" className={className}>
			<p className="mb-1.5 font-mono text-[8.5px] text-meta-soft tracking-[0.16em]">
				PUBLICIDADE
			</p>
			<div
				className="hatch-muted flex w-full items-center justify-center rounded-card border border-[#cfcac1] border-dashed font-mono text-[#9c968c] text-[10px]"
				style={{ height: spec.height, maxWidth }}
			>
				{spec.caption}
			</div>
		</aside>
	);
}

export type { AdFormat };
export { AD_FORMATS, AdSlot };
