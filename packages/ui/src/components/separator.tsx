"use client";

import { Separator as SeparatorPrimitive } from "@base-ui/react/separator";

import { cn } from "@portal-app/ui/lib/utils";

/**
 * O separador vertical CENTRALIZA, e não estica.
 *
 * `self-stretch` parece o padrão óbvio, mas quebra assim que quem chama dá uma
 * altura — e todos aqui dão (`h-4` no topbar, `h-6` na barra do editor). Pela
 * spec do flexbox, `align-self: stretch` só estica quando a medida transversal
 * é `auto`; com altura definida ele degrada para `flex-start`, e o traço vai
 * parar colado no topo da linha. Pior: como `align-self` é do filho, o
 * `items-center` do contêiner não corrige — foi assim que os cinco separadores
 * verticais do painel nasceram desalinhados sem ninguém notar.
 *
 * Consequência para quem chama: um separador vertical precisa de altura
 * (`h-4`, `h-full`, o que for). Sem ela, a altura é `auto` — ou seja, zero.
 */
function Separator({
	className,
	orientation = "horizontal",
	...props
}: SeparatorPrimitive.Props) {
	return (
		<SeparatorPrimitive
			data-slot="separator"
			orientation={orientation}
			className={cn(
				"shrink-0 bg-border data-horizontal:h-px data-horizontal:w-full data-vertical:w-px data-vertical:self-center",
				className,
			)}
			{...props}
		/>
	);
}

export { Separator };
