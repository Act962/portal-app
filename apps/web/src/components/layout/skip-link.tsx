/**
 * First focusable element on the page (WCAG 2.4.1). Visually hidden until it
 * receives focus, so keyboard users can jump past the masthead and the nav.
 */
export function SkipLink() {
	return (
		<a
			href="#conteudo"
			className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-control focus:bg-brand-navy focus:px-4 focus:py-3 focus:font-bold focus:text-sm focus:text-white"
		>
			Pular para o conteúdo
		</a>
	);
}
