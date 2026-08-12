import type { IconType } from "react-icons";
import {
	FaEnvelope,
	FaFacebook,
	FaGlobe,
	FaInstagram,
	FaLinkedin,
	FaTelegram,
	FaThreads,
	FaTiktok,
	FaWhatsapp,
	FaXTwitter,
	FaYoutube,
} from "react-icons/fa6";

import type { Network } from "@/lib/social-networks";

/**
 * Uma família só (Font Awesome 6). Misturar famílias é o defeito clássico deste
 * tipo de barra: cada logo vem com peso e caixa próprios, e o alinhamento
 * óptico entre eles nunca fecha. O Simple Icons não serviria de qualquer forma
 * — não tem LinkedIn.
 */
const ICONS: Record<Network, IconType> = {
	instagram: FaInstagram,
	facebook: FaFacebook,
	youtube: FaYoutube,
	twitter: FaXTwitter,
	linkedin: FaLinkedin,
	tiktok: FaTiktok,
	whatsapp: FaWhatsapp,
	telegram: FaTelegram,
	threads: FaThreads,
	website: FaGlobe,
	email: FaEnvelope,
};

/**
 * O ícone e nada mais — sem nome acessível próprio.
 *
 * É `aria-hidden` de propósito, e o `react-icons` NÃO faz isso sozinho — o
 * `IconBase` dele só repassa as props. Quem sabe o que este link é é o elemento
 * que o envolve, e é lá que o `aria-label` tem de estar ("Rádio 7 Cidades no
 * Instagram"). Sem isso, trocar o rótulo pelo ícone deixaria o link sem nome
 * nenhum para quem usa leitor de tela — que é o modo mais fácil de transformar
 * "usar ícones" numa regressão de acessibilidade.
 */
export function SocialIcon({
	network,
	className,
}: {
	network: Network;
	className?: string;
}) {
	const Icon = ICONS[network];
	return <Icon aria-hidden className={className} focusable={false} />;
}
