"use client";

import { Container } from "@portal-app/ui/components/container";
import { X } from "lucide-react";
import { useState } from "react";

/**
 * Sticky 320×50 anchor unit, mobile only.
 *
 * Dismissible by design: an anchor that cannot be closed eats the bottom of
 * every screen and is the kind of thing that gets a site penalised for
 * intrusive interstitials.
 */
export function AnchorAd() {
	const [dismissed, setDismissed] = useState(false);

	if (dismissed) {
		return null;
	}

	return (
		<aside
			aria-label="Publicidade"
			className="fixed inset-x-0 bottom-0 z-30 border-[#e0ddd6] border-t bg-surface-alt md:hidden"
		>
			<Container className="flex items-center gap-2.5 py-1.5">
				<div className="hatch-muted flex h-[50px] flex-1 items-center justify-center rounded-card border border-[#cfcac1] border-dashed font-mono text-[#9c968c] text-[9.5px]">
					âncora mobile 320×50
				</div>
				<button
					type="button"
					onClick={() => setDismissed(true)}
					aria-label="Fechar publicidade"
					className="flex size-11 shrink-0 items-center justify-center text-meta-soft"
				>
					<X size={16} aria-hidden />
				</button>
			</Container>
		</aside>
	);
}
