"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@portal-app/ui/components/tabs";
import { Megaphone, Wallet } from "lucide-react";
import { useState } from "react";

import { PageHeader } from "@/components/admin/page-header";

import { AdSenseForm } from "./adsense-form";
import { CampaignsList } from "./campaigns-list";

/**
 * A tela de publicidade, em duas abas.
 *
 * As duas coisas dividem a tela porque respondem à mesma pergunta ("o que
 * aparece nos espaços do portal?"), mas são operações diferentes: campanha se
 * cadastra uma a uma e tem prazo; AdSense se configura uma vez e fica. Separar
 * em duas páginas faria a segunda ser esquecida.
 *
 * A ORDEM importa: campanhas primeiro porque é o que rende mais e o que se
 * mexe toda semana. O AdSense é o que preenche o que sobra.
 */
export function CampaignsManager() {
	const [tab, setTab] = useState("campanhas");

	return (
		<>
			<PageHeader
				title="Anúncios"
				description="Campanhas vendidas diretamente e o preenchimento automático do Google."
			/>

			<Tabs value={tab} onValueChange={(value) => setTab(value ?? "campanhas")}>
				<TabsList>
					<TabsTrigger value="campanhas">
						<Megaphone className="size-4" />
						Campanhas
					</TabsTrigger>
					<TabsTrigger value="adsense">
						<Wallet className="size-4" />
						Google AdSense
					</TabsTrigger>
				</TabsList>

				<TabsContent value="campanhas" className="mt-4">
					<CampaignsList />
				</TabsContent>

				<TabsContent value="adsense" className="mt-4">
					<AdSenseForm />
				</TabsContent>
			</Tabs>
		</>
	);
}
