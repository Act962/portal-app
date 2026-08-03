/**
 * Ad inventory, keyed by placement. Height is declared here rather than by the
 * caller because the box must be reserved *before* any creative loads —
 * that reservation is what keeps CLS at zero.
 */
const AD_FORMATS = {
	"header-desktop": {
		height: 60,
		maxWidth: 468,
		caption: "banner 468×60 — cabeçalho",
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
