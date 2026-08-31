"use client";

import { AD_SLOT_LABELS, AD_SLOTS } from "@portal-app/advertising";
import {
	Alert,
	AlertDescription,
	AlertTitle,
} from "@portal-app/ui/components/alert";
import { Button } from "@portal-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@portal-app/ui/components/card";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { Switch } from "@portal-app/ui/components/switch";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, ShieldAlert } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

/**
 * Configuração do Google AdSense.
 *
 * O que esta tela mostra que a documentação do Google não deixa óbvio: as três
 * condições precisam valer JUNTAS para uma posição servir anúncio — a chave
 * geral ligada, o ID do editor e o ID daquela unidade. Faltando qualquer uma, o
 * espaço fica com a campanha da casa ou vazio, e nunca com uma caixa quebrada.
 */
export function AdSenseForm() {
	const queryClient = useQueryClient();
	const publisherId = useId();
	const enabledId = useId();
	const npaId = useId();
	const settings = useQuery(trpc.advertising.adsense.get.queryOptions());

	const [form, setForm] = useState({
		publisherId: "",
		enabled: false,
		nonPersonalized: true,
		slotIds: {} as Record<string, string>,
	});

	useEffect(() => {
		if (settings.data) {
			setForm({
				publisherId: settings.data.publisherId ?? "",
				enabled: settings.data.enabled,
				nonPersonalized: settings.data.nonPersonalized,
				slotIds: { ...(settings.data.slotIds as Record<string, string>) },
			});
		}
	}, [settings.data]);

	const save = useMutation(
		trpc.advertising.adsense.update.mutationOptions({
			onSuccess: async () => {
				toast.success("Configuração do AdSense salva.");
				await queryClient.invalidateQueries({
					queryKey: trpc.advertising.adsense.get.queryKey(),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (settings.isLoading) {
		return <Skeleton className="h-96 w-full" />;
	}

	return (
		<div className="flex max-w-3xl flex-col gap-4">
			{/* O aviso fica ANTES dos campos, e não no rodapé: é uma decisão que
			    precisa ser tomada antes de ligar a chave, não descoberta depois. */}
			<Alert>
				<ShieldAlert className="size-4" />
				<AlertTitle>Antes de ligar, leia</AlertTitle>
				<AlertDescription>
					O AdSense coloca cookies do Google no navegador de quem lê o portal. A
					página de Privacidade já descreve isso, mas o texto legal{" "}
					<strong>não foi revisado por advogado</strong> e o portal ainda não
					tem banner de consentimento. Por isso o padrão é pedir anúncios{" "}
					<strong>não personalizados</strong>: rende menos e é o que se sustenta
					sem consentimento explícito. Para tráfego da Europa, o Google exige um
					CMP certificado — que ainda não existe aqui.
				</AlertDescription>
			</Alert>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Conta</CardTitle>
					<CardDescription>
						O ID do editor aparece no painel do AdSense, em Conta → Informações
						da conta.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-4">
					<div>
						<Label htmlFor={publisherId}>ID do editor</Label>
						<Input
							id={publisherId}
							value={form.publisherId}
							onChange={(event) =>
								setForm({ ...form, publisherId: event.target.value })
							}
							placeholder="ca-pub-0000000000000000"
							className="mt-1.5 font-mono"
						/>
						<p className="mt-1 text-muted-foreground text-xs">
							Também é o que vai para o <code>/ads.txt</code> — sem ele no ar, o
							Google trata nosso inventário como não autorizado e a receita
							despenca.
						</p>
					</div>

					<div className="flex items-start gap-3">
						<Switch
							id={enabledId}
							checked={form.enabled}
							onCheckedChange={(checked) =>
								setForm({ ...form, enabled: checked === true })
							}
						/>
						<Label htmlFor={enabledId} className="block font-normal text-sm">
							<span className="font-medium">Servir anúncios do Google</span>
							<span className="block text-muted-foreground text-xs">
								Desligado, nenhum script do Google carrega em página nenhuma — é
								o corte de emergência, sem depender de deploy.
							</span>
						</Label>
					</div>

					<div className="flex items-start gap-3">
						<Switch
							id={npaId}
							checked={form.nonPersonalized}
							onCheckedChange={(checked) =>
								setForm({ ...form, nonPersonalized: checked === true })
							}
						/>
						<Label htmlFor={npaId} className="block font-normal text-sm">
							<span className="font-medium">
								Pedir anúncios não personalizados
							</span>
							<span className="block text-muted-foreground text-xs">
								Recomendado enquanto não houver banner de consentimento.
								Desligar isto sem base legal expõe o portal na LGPD.
							</span>
						</Label>
					</div>
				</CardContent>
			</Card>

			<Card>
				<CardHeader>
					<CardTitle className="text-base">Unidades por posição</CardTitle>
					<CardDescription>
						Crie uma unidade de anúncio no painel do AdSense para cada posição e
						cole aqui o número dela. Posição em branco não serve AdSense.
					</CardDescription>
				</CardHeader>
				<CardContent className="flex flex-col gap-3">
					{AD_SLOTS.map((slot) => (
						<div key={slot} className="grid items-center gap-2 sm:grid-cols-2">
							<Label htmlFor={`slot-${slot}`}>{AD_SLOT_LABELS[slot]}</Label>
							<Input
								id={`slot-${slot}`}
								value={form.slotIds[slot] ?? ""}
								onChange={(event) =>
									setForm({
										...form,
										slotIds: { ...form.slotIds, [slot]: event.target.value },
									})
								}
								placeholder="1234567890"
								className="font-mono"
							/>
						</div>
					))}

					<p className="flex items-start gap-2 text-muted-foreground text-xs">
						<Info className="mt-0.5 size-3.5 shrink-0" />
						Campanha própria SEMPRE ganha do AdSense na mesma posição. O Google
						só preenche o espaço quando não há campanha da casa no ar ali.
					</p>
				</CardContent>
			</Card>

			<div className="flex justify-end">
				<Button
					disabled={save.isPending}
					onClick={() =>
						save.mutate({
							publisherId: form.publisherId.trim() || null,
							enabled: form.enabled,
							nonPersonalized: form.nonPersonalized,
							slotIds: form.slotIds,
						})
					}
				>
					{save.isPending ? "Salvando…" : "Salvar"}
				</Button>
			</div>
		</div>
	);
}
