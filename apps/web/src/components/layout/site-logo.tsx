import { cn } from "@portal-app/ui/lib/utils";
import Image from "next/image";

/**
 * A marca do portal: o lockup horizontal oficial — símbolo do "7" e a
 * assinatura "Portal Cidades" —, usada no cabeçalho e no rodapé.
 *
 * **Agora é um arquivo só.** Este componente já compôs a assinatura em
 * Montserrat ao lado do símbolo, porque a pasta do cliente só tinha o lockup
 * EMPILHADO (símbolo em cima, texto embaixo, num quadrado) — que num cabeçalho
 * de 80px deixaria a assinatura com ~10px de altura. A arte horizontal chegou em
 * 14/08/2026 e substituiu a composição, como estava previsto: uma marca
 * desenhada não se remonta com a fonte mais parecida que o projeto tem à mão.
 *
 * **Sem filtro de cor.** O símbolo antigo era pintado de branco com
 * `brightness-0 invert`. Esta arte não passa por isso: ela já vem na versão de
 * fundo escuro (o marrom trocado por branco, o vermelho preservado), e o filtro
 * achataria tudo num borrão branco — apagando justamente o vermelho que
 * distingue "Portal" de "Cidades". A versão colorida, para fundo claro, fica
 * como arte-mestre em `design/marca/logo_7_cidades_hor.png` e não é servida:
 * hoje os dois lugares onde a marca aparece são marrons.
 *
 * **Por que NÃO usa o logo das Configurações.** Aquele campo (D8) alimenta
 * schema.org, RSS, Open Graph e manifest — lugares onde o pedido é uma arte
 * QUADRADA. Aqui a exigência é a oposta: horizontal e legível numa altura fixa.
 * Atender as duas com o mesmo arquivo foi o que produziu o estado antigo, um
 * quadrado de 150×150 espremido em 48px com a assinatura ilegível dentro dele.
 */

const LOGO = "/brand/logo-horizontal.png";

export function SiteLogo({
	className,
	// Ligado por padrão porque o uso principal é o cabeçalho, acima da dobra. O
	// rodapé desliga: preload de uma imagem que só aparece depois de rolar a
	// página inteira disputa banda com o que o leitor está vendo agora.
	priority = true,
	// Vazio por padrão: no cabeçalho a marca vive dentro do link para a home, que
	// já carrega o nome acessível. Onde ela aparece SOZINHA — o rodapé — o texto
	// entra por aqui, senão a palavra "Cidades" existiria só como pixel.
	alt = "",
}: {
	className?: string;
	priority?: boolean;
	alt?: string;
}) {
	return (
		<Image
			src={LOGO}
			alt={alt}
			width={640}
			height={235}
			priority={priority}
			// A marca nunca passa de 153px de largura (56px de altura na proporção
			// 2,73:1). Sem esta dica o Next monta o srcset pelos `deviceSizes` e pede
			// `w=1920` num aparelho 3x — três vezes o tamanho do próprio arquivo de
			// origem, transformado à toa.
			sizes="160px"
			// Um pouco maior que o símbolo sozinho (era 36/48): a mesma altura agora
			// carrega o símbolo E a assinatura, e é ela que decide se "Cidades" é
			// legível. Continua folgada dentro do cabeçalho, de 56px no celular e
			// 80px no desktop.
			className={cn("block h-10 w-auto md:h-14", className)}
		/>
	);
}
