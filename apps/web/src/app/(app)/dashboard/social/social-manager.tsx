"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@portal-app/ui/components/tabs";
import { useQuery } from "@tanstack/react-query";
import { Inbox, Link2 } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/admin/page-header";
import { trpc } from "@/utils/trpc";

import { AccountsPanel } from "./accounts-panel";
import { SocialQueue } from "./social-queue";

/**
 * A tela de redes sociais, em duas abas.
 *
 * A FILA vem primeiro porque é o trabalho de todo dia; contas se configuram uma
 * vez e só voltam a ser olhadas quando algo falha. O número de pendentes fica
 * na própria aba, para quem abre a tela saber na hora se há o que aprovar.
 */
export function SocialManager({ canManage }: { canManage: boolean }) {
	const [tab, setTab] = useState("fila");
	const pending = useQuery(trpc.social.pendingCount.queryOptions());

	return (
		<>
			<PageHeader
				title="Redes sociais"
				description="Cada matéria publicada chega aqui com legenda e imagem montadas. Revise, aprove, e ela vai para o Instagram e o Facebook."
			/>

			<Tabs value={tab} onValueChange={(value) => setTab(value ?? "fila")}>
				<TabsList>
					<TabsTrigger value="fila">
						<Inbox className="size-4" />
						Fila
						{pending.data ? (
							<span className="ml-1 rounded-full bg-primary px-1.5 text-primary-foreground text-xs tabular-nums">
								{pending.data}
							</span>
						) : null}
					</TabsTrigger>
					<TabsTrigger value="contas">
						<Link2 className="size-4" />
						Contas
					</TabsTrigger>
				</TabsList>

				<TabsContent value="fila" className="mt-4">
					<SocialQueue />
				</TabsContent>

				<TabsContent value="contas" className="mt-4">
					<AccountsPanel canManage={canManage} />
				</TabsContent>
			</Tabs>
		</>
	);
}
