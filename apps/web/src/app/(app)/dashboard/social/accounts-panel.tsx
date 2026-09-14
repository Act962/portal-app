"use client";

import {
	PLATFORM_LABEL,
	SOCIAL_PLATFORMS,
	type SocialPlatform,
} from "@portal-app/social";
import {
	AlertDialog,
	AlertDialogAction,
	AlertDialogCancel,
	AlertDialogContent,
	AlertDialogDescription,
	AlertDialogFooter,
	AlertDialogHeader,
	AlertDialogTitle,
} from "@portal-app/ui/components/alert-dialog";
import { Badge } from "@portal-app/ui/components/badge";
import { Button } from "@portal-app/ui/components/button";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { cn } from "@portal-app/ui/lib/utils";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Info, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

import { ACCOUNT_STATE_LABELS, accountTone } from "./social-labels";

const TONE_CLASSES = {
	ok: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
	atencao: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
	erro: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
} as const;

/**
 * As contas conectadas, uma por rede (spec 08, D5).
 *
 * **Não há botão "Conectar" funcionando, e a tela diz isso.** O login da Meta
 * chega na F4, junto com o App aprovado; até lá, um botão que abrisse um fluxo
 * inexistente seria pior do que um aviso honesto — é a mesma regra que fez o
 * publisher provisório recusar em vez de fingir (D17).
 *
 * Quem aprova post também enxerga esta aba (`social:publish`): entender por que
 * um envio falhou passa por saber se a conta está no ar. Desconectar, porém, é
 * credencial, e só aparece para quem tem `social:manage`.
 */
export function AccountsPanel({ canManage }: { canManage: boolean }) {
	const queryClient = useQueryClient();
	const [disconnecting, setDisconnecting] = useState<SocialPlatform | null>(
		null,
	);

	const accounts = useQuery(trpc.social.accounts.queryOptions());

	const disconnect = useMutation(
		trpc.social.disconnect.mutationOptions({
			onSuccess: async (account) => {
				toast.success(
					`Conta do ${PLATFORM_LABEL[account.platform]} desconectada.`,
				);
				setDisconnecting(null);
				await queryClient.invalidateQueries({
					queryKey: trpc.social.accounts.queryKey(),
				});
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	if (accounts.isPending) {
		return (
			<div className="grid gap-4 md:grid-cols-2">
				<Skeleton className="h-40" />
				<Skeleton className="h-40" />
			</div>
		);
	}

	const byPlatform = new Map(
		(accounts.data ?? []).map((account) => [account.platform, account]),
	);

	return (
		<div className="flex flex-col gap-4">
			<div className="flex gap-3 rounded-md border bg-muted/40 p-3 text-sm">
				<Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
				<p className="text-muted-foreground">
					A conexão com a Meta é feita por um login do Facebook de quem
					administra a Página. Ela fica disponível quando o aplicativo do portal
					for aprovado pela Meta — o passo a passo está na documentação do
					módulo.
				</p>
			</div>

			<div className="grid gap-4 md:grid-cols-2">
				{SOCIAL_PLATFORMS.map((platform) => {
					const account = byPlatform.get(platform);
					return (
						<section
							key={platform}
							className="flex flex-col gap-3 rounded-lg border bg-card p-4"
						>
							<div className="flex items-center justify-between gap-2">
								<h2 className="font-semibold">{PLATFORM_LABEL[platform]}</h2>
								{account ? (
									<Badge
										variant="secondary"
										className={cn(TONE_CLASSES[accountTone(account.state)])}
									>
										{ACCOUNT_STATE_LABELS[account.state] ?? account.state}
									</Badge>
								) : (
									<Badge variant="outline">Não conectada</Badge>
								)}
							</div>

							{account ? (
								<>
									<div className="flex items-center gap-3">
										{account.avatarUrl ? (
											<img
												src={account.avatarUrl}
												alt=""
												className="size-10 rounded-full"
											/>
										) : null}
										<div className="min-w-0">
											<p className="truncate font-medium text-sm">
												{account.displayName}
											</p>
											<p className="text-muted-foreground text-xs">
												Conectada em{" "}
												{new Date(account.connectedAt).toLocaleDateString(
													"pt-BR",
												)}
											</p>
										</div>
									</div>
									{account.tokenExpiresAt ? (
										<p className="text-muted-foreground text-xs">
											Autorização válida até{" "}
											{new Date(account.tokenExpiresAt).toLocaleDateString(
												"pt-BR",
											)}
										</p>
									) : null}
									{account.unusableReason ? (
										<p className="text-destructive text-sm">
											Não publica: {account.unusableReason}.
										</p>
									) : account.state === "EXPIRANDO" ? (
										<p className="text-amber-700 text-sm dark:text-amber-300">
											A autorização vence em breve. Refaça o login da Meta para
											a fila não parar.
										</p>
									) : null}
									{canManage && account.state !== "DESCONECTADA" ? (
										<div className="mt-auto">
											<Button
												variant="outline"
												size="sm"
												onClick={() => setDisconnecting(platform)}
											>
												<Unplug className="size-4" />
												Desconectar
											</Button>
										</div>
									) : null}
								</>
							) : (
								<p className="text-muted-foreground text-sm">
									Sem conta conectada, as publicações para o{" "}
									{PLATFORM_LABEL[platform]} falham com esse aviso na fila.
								</p>
							)}
						</section>
					);
				})}
			</div>

			<AlertDialog
				open={disconnecting !== null}
				onOpenChange={(open) => !open && setDisconnecting(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							{`Desconectar o ${disconnecting ? PLATFORM_LABEL[disconnecting] : ""}?`}
						</AlertDialogTitle>
						<AlertDialogDescription>
							As próximas publicações para esta rede vão falhar até alguém
							conectar a conta de novo. O histórico do que já foi publicado
							continua aqui.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Manter conectada</AlertDialogCancel>
						<AlertDialogAction
							onClick={() =>
								disconnecting && disconnect.mutate({ platform: disconnecting })
							}
						>
							Desconectar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
