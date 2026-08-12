"use client";

import { Check, Link2 } from "lucide-react";
import { useState } from "react";

import { SocialIcon } from "@/components/social/social-icon";

/**
 * Quadrado, não pílula: sem o rótulo dentro, um `px-2.5` deixava cada chip com
 * a largura do seu ícone e a fileira saía irregular.
 */
const CHIP =
	"flex size-9 items-center justify-center rounded-control border border-hairline-strong text-ink-muted transition-colors hover:border-brand-red hover:text-brand-red";

type ShareBarProps = {
	url: string;
	title: string;
};

export function ShareBar({ url, title }: ShareBarProps) {
	const [copied, setCopied] = useState(false);

	/**
	 * O `label` deixou de ser decoração e virou o NOME ACESSÍVEL do link — com o
	 * ícone no lugar do texto, é a única coisa que um leitor de tela tem para
	 * anunciar. Por isso ele diz a ação inteira ("Compartilhar no WhatsApp"), e
	 * não só a marca.
	 */
	const targets = [
		{
			network: "whatsapp",
			label: "Compartilhar no WhatsApp",
			href: `https://wa.me/?text=${encodeURIComponent(`${title} ${url}`)}`,
		},
		{
			network: "facebook",
			label: "Compartilhar no Facebook",
			href: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
		},
		{
			network: "twitter",
			label: "Compartilhar no X",
			href: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(title)}`,
		},
	] as const;

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
					key={target.network}
					href={target.href}
					target="_blank"
					rel="noreferrer"
					aria-label={target.label}
					className={CHIP}
				>
					<SocialIcon network={target.network} className="size-[15px]" />
				</a>
			))}

			{/*
			  O ícone muda para o "certo" no lugar do texto "LINK COPIADO", que era
			  a confirmação antes. A cor verde sozinha não serviria — ela é a
			  diferença que some para quem não distingue vermelho e verde —, então
			  quem confirma é a TROCA DE FORMA, e o `aria-label` acompanha.
			*/}
			<button
				type="button"
				onClick={copyLink}
				aria-label={copied ? "Link copiado" : "Copiar link da matéria"}
				className={CHIP}
			>
				{copied ? (
					<Check className="size-4 text-brand-red" />
				) : (
					<Link2 className="size-4" />
				)}
			</button>
			<span aria-live="polite" className="sr-only">
				{copied ? "Link copiado para a área de transferência" : ""}
			</span>
		</div>
	);
}
