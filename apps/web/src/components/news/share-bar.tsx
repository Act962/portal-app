"use client";

import { useState } from "react";

const CHIP =
	"rounded-control border border-hairline-strong px-2.5 py-1.5 font-mono text-[10px] text-ink-muted transition-colors hover:border-brand-red hover:text-brand-red";

type ShareBarProps = {
	url: string;
	title: string;
};

export function ShareBar({ url, title }: ShareBarProps) {
	const [copied, setCopied] = useState(false);

	const targets = [
		{
			name: "WHATSAPP",
			href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
		},
		{
			name: "FACEBOOK",
			href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
		},
		{
			name: "X",
			href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
		},
	];

	async function copyLink() {
		try {
			await navigator.clipboard.writeText(url);
			setCopied(true);
			setTimeout(() => setCopied(false), 2000);
		} catch {
			// Clipboard can be blocked by permissions; leave the label unchanged
			// rather than claiming a copy that did not happen.
		}
	}

	return (
		<div className="flex flex-wrap gap-2">
			{targets.map((target) => (
				<a
					key={target.name}
					href={target.href}
					target="_blank"
					rel="noreferrer"
					className={CHIP}
				>
					{target.name}
				</a>
			))}

			<button type="button" onClick={copyLink} className={CHIP}>
				{copied ? "LINK COPIADO" : "COPIAR LINK"}
			</button>
			<span aria-live="polite" className="sr-only">
				{copied ? "Link copiado para a área de transferência" : ""}
			</span>
		</div>
	);
}
