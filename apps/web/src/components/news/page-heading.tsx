/**
 * Masthead for a listing page.
 *
 * Mobile turns it into a full-bleed dark band, matching how section pages open
 * on a phone; desktop keeps it on the page canvas under a dark rule.
 */
export function PageHeading({
	eyebrow,
	title,
	description,
	action,
}: {
	eyebrow: string;
	title: string;
	description?: string;
	action?: React.ReactNode;
}) {
	return (
		<div className="-mx-4 mb-4 bg-brand-deep px-4 py-4.5 md:mx-0 md:mb-5 md:flex md:flex-wrap md:items-end md:justify-between md:gap-4 md:border-brand-deep md:border-b-[3px] md:bg-transparent md:px-0 md:pt-0 md:pb-3.5">
			<div>
				<p className="mb-1.5 font-mono text-[9px] text-on-brand-muted uppercase tracking-[0.16em] md:text-[10px] md:text-meta">
					{eyebrow}
				</p>

				<h1 className="font-extrabold text-[30px] text-white leading-none tracking-[-0.03em] md:text-[46px] md:text-brand-ink md:tracking-[-0.04em]">
					{title}
				</h1>

				{description ? (
					<p className="mt-2 max-w-[70ch] font-serif text-[13.5px] text-on-brand-soft md:mt-3 md:text-ink-muted md:text-lg">
						{description}
					</p>
				) : null}
			</div>

			{action ? <div className="mt-3 md:mt-0">{action}</div> : null}
		</div>
	);
}
