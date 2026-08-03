import { CtaButton } from "@portal-app/ui/components/cta-button";

export function WhatsappCard() {
	return (
		<section className="-mx-4 bg-brand-red px-4 py-5.5 md:mx-0 md:rounded-card md:p-4.5">
			<h2 className="mb-2 font-extrabold text-[19px] text-white leading-tight tracking-[-0.015em]">
				Notícias no seu WhatsApp
			</h2>

			<p className="mb-3.5 font-serif text-[13.5px] text-white/90 leading-normal">
				Entre no canal oficial e receba em primeira mão.
			</p>

			<CtaButton variant="on-brand">Entrar no canal</CtaButton>
		</section>
	);
}
