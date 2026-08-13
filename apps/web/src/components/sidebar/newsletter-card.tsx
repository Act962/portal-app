"use client";

import { CtaButton } from "@portal-app/ui/components/cta-button";
import { useState } from "react";

/**
 * Newsletter sign-up. The field is real and validated by the browser, but
 * there is no endpoint behind it yet — delivery lands with Distribution in
 * Phase 5, so the form states what it can and cannot do instead of faking
 * a confirmation.
 *
 * Full-bleed dark band on mobile, bordered card in the desktop rail.
 */
export function NewsletterCard() {
	const [submitted, setSubmitted] = useState(false);

	return (
		<section className="-mx-4 bg-brand-deep px-4 py-5.5 md:mx-0 md:rounded-card md:border md:border-hairline md:bg-surface md:p-4.5">
			<h2 className="mb-2 font-mono text-[9px] text-brand-red-soft tracking-[0.14em] md:text-brand-red">
				NEWSLETTER
			</h2>

			<p className="mb-3 font-bold text-lg text-white leading-tight md:text-brand-deep">
				Um resumo do Piauí todas as manhãs, às 7h
			</p>

			<form
				onSubmit={(event) => {
					event.preventDefault();
					setSubmitted(true);
				}}
				className="flex flex-col gap-2 md:flex-col"
			>
				<label htmlFor="newsletter-email" className="sr-only">
					Seu e-mail
				</label>
				<div className="flex gap-2 md:flex-col">
					<input
						id="newsletter-email"
						type="email"
						required
						placeholder="seu@email.com"
						className="min-h-11 flex-1 rounded-control border border-white/20 bg-white/10 px-3 text-[13px] text-white placeholder:text-on-brand-muted focus-visible:border-white focus-visible:outline-none md:border-hairline-strong md:bg-transparent md:text-ink md:focus-visible:border-brand-deep md:placeholder:text-meta"
					/>
					<CtaButton type="submit" className="w-auto shrink-0 md:w-full">
						Assinar
					</CtaButton>
				</div>
			</form>

			<p
				aria-live="polite"
				className="mt-2 font-mono text-[9.5px] text-on-brand-muted md:text-meta"
			>
				{submitted ? "Envio ainda não conectado (Fase 5)." : ""}
			</p>
		</section>
	);
}
