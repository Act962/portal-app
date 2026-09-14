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
import { AlertTriangle, Info, LogIn, Stethoscope, Unplug } from "lucide-react";
import type { Route } from "next";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

import {
	ACCOUNT_STATE_LABELS,
	accountTone,
	DIAGNOSIS_LABELS,
	diagnosisTone,
	metaFlagMessage,
	quotaSummary,
} from "./social-labels";

const TONE_CLASSES = {
	ok: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200",
	atencao: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
	erro: "bg-red-100 text-red-900 dark:bg-red-950 dark:text-red-200",
} as const;

/** A rota que começa o login da Meta. É rota de API, não página, então vai num
 * `<a>` comum — navegação de verdade, que o redirecionamento exige. */
const CONNECT_HREF = "/api/social/meta/connect";

/**
 * As contas conectadas, uma por rede (spec 08, D5), e o login da Meta.
 *
 * O login só aparece quando o ambiente tem o App configurado. Sem ele, a tela
 * diz o que falta em vez de oferecer um botão que terminaria em erro (D17).
 *
 * Quem aprova post também enxerga esta aba (`social:publish`): entender por que
 * um envio falhou passa por saber se a conta está no ar. Conectar e
 * desconectar, porém, são credencial, e só aparecem com `social:manage`.
 */
export function AccountsPanel({
	canManage,
	metaFlag,
}: {
	canManage: boolean;
	metaFlag: string | null;
}) {
	const queryClient = useQueryClient();
	const [disconnecting, setDisconnecting] = useState<SocialPlatform | null>(
		null,
	);

	const accounts = useQuery(trpc.social.accounts.queryOptions());
	const meta = useQuery(trpc.social.metaStatus.queryOptions());

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
	const configured = meta.data?.configured ?? false;
	const flag = metaFlagMessage(metaFlag);

	return (
		<div className="flex flex-col gap-4">
			{flag ? (
				<div
					className={cn(
						"flex gap-3 rounded-md border p-3 text-sm",
						flag.tone === "erro"
							? "border-destructive/40 bg-destructive/5 text-destructive"
							: "bg-muted/40 text-muted-foreground",
					)}
				>
					<AlertTriangle className="mt-0.5 size-4 shrink-0" />
					<p>{flag.message}</p>
				</div>
			) : null}

			{canManage && configured && metaFlag === "escolher" ? (
				<PageChooser />
			) : null}

			<div className="flex flex-wrap items-center justify-between gap-3 rounded-md border bg-muted/40 p-3 text-sm">
				<div className="flex min-w-0 flex-1 gap-3">
					<Info className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
					<p className="text-muted-foreground">
						{configured
							? "A conexão é feita com o login do Facebook de quem administra a Página. Um login conecta a Página e o Instagram vinculado a ela."
							: "O login da Meta não está configurado neste ambiente. Cadastre META_APP_ID e META_APP_SECRET — o passo a passo está na documentação do módulo."}
					</p>
				</div>
				{canManage && configured ? (
					<Button render={<a href={CONNECT_HREF} />}>
						<LogIn className="size-4" />
						{byPlatform.size > 0
							? "Reconectar com a Meta"
							: "Conectar com a Meta"}
					</Button>
				) : null}
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

			<DiagnosisPanel />

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

/**
 * "Verificar conexão": pergunta à Meta se cada rede consegue publicar agora,
 * sem publicar nada (spec 08, §14).
 *
 * Só roda no clique (`enabled: false`): cada verificação consulta a Meta, e
 * abrir a aba não deveria gastar chamada. É o primeiro passo do roteiro do
 * go-live — descobrir aqui que faltou uma permissão custa um clique;
 * descobrir pela fila custa uma notícia que não saiu.
 */
function DiagnosisPanel() {
	const diagnose = useQuery({
		...trpc.social.diagnose.queryOptions(),
		enabled: false,
		retry: false,
	});

	return (
		<section className="flex flex-col gap-3 rounded-lg border bg-card p-4">
			<div className="flex flex-wrap items-center justify-between gap-3">
				<div className="min-w-0 flex-1">
					<h2 className="font-semibold">Verificar conexão</h2>
					<p className="text-muted-foreground text-sm">
						Pergunta à Meta se cada rede consegue publicar agora — sem publicar
						nada.
					</p>
				</div>
				<Button
					variant="outline"
					disabled={diagnose.isFetching}
					onClick={() => diagnose.refetch()}
				>
					<Stethoscope className="size-4" />
					{diagnose.isFetching
						? "Verificando…"
						: diagnose.data
							? "Verificar de novo"
							: "Verificar agora"}
				</Button>
			</div>

			{diagnose.isError ? (
				<p className="text-destructive text-sm">{diagnose.error.message}</p>
			) : null}

			{diagnose.data ? (
				<ul className="grid gap-3 md:grid-cols-2">
					{diagnose.data.map((item) => (
						<li
							key={item.platform}
							className="flex flex-col gap-2 rounded-md border p-3"
						>
							<div className="flex items-center justify-between gap-2">
								<span className="font-medium text-sm">
									{PLATFORM_LABEL[item.platform]}
								</span>
								<Badge
									variant="secondary"
									className={cn(TONE_CLASSES[diagnosisTone(item.verdict)])}
								>
									{DIAGNOSIS_LABELS[item.verdict]}
								</Badge>
							</div>
							{item.problems.length + item.warnings.length > 0 ? (
								<ul className="flex flex-col gap-1 text-sm">
									{item.problems.map((problem) => (
										<li key={problem} className="text-destructive">
											{problem}
										</li>
									))}
									{item.warnings.map((warning) => (
										<li
											key={warning}
											className="text-amber-700 dark:text-amber-300"
										>
											{warning}
										</li>
									))}
								</ul>
							) : (
								<p className="text-muted-foreground text-sm">
									Token válido, permissões completas e imagens alcançáveis.
								</p>
							)}
							{item.quota ? (
								<p className="text-muted-foreground text-xs">
									{quotaSummary(item.quota)}
								</p>
							) : null}
						</li>
					))}
				</ul>
			) : null}
		</section>
	);
}

/**
 * A escolha da Página, depois do login.
 *
 * Existe porque quem conecta costuma administrar mais de uma Página — agência,
 * rede de lojas, a página pessoal. Conectar a primeira da lista sem perguntar
 * publicaria as notícias do portal na Página errada.
 */
function PageChooser() {
	const queryClient = useQueryClient();
	const router = useRouter();
	const pages = useQuery({
		...trpc.social.metaPages.queryOptions(),
		// Login vencido não melhora tentando de novo; a mensagem já diz o que fazer.
		retry: false,
	});

	const connect = useMutation(
		trpc.social.connectMetaPage.mutationOptions({
			onSuccess: async (result) => {
				if (result.instagramLinked) {
					toast.success("Página e Instagram conectados.");
				} else {
					toast.warning(
						"Página conectada. Ela não tem Instagram profissional vinculado — o Instagram continua desconectado.",
					);
				}
				await queryClient.invalidateQueries({
					queryKey: trpc.social.accounts.queryKey(),
				});
				// Tira o `?meta=escolher` da URL: recarregar a tela não pode reabrir
				// a escolha de um login que já foi usado.
				router.replace("/dashboard/social?aba=contas" as Route);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<section className="flex flex-col gap-3 rounded-lg border border-primary/40 bg-card p-4">
			<div>
				<h2 className="font-semibold">Escolha a Página do portal</h2>
				<p className="text-muted-foreground text-sm">
					As notícias vão para a Página escolhida e para o Instagram vinculado a
					ela.
				</p>
			</div>

			{pages.isPending ? (
				<Skeleton className="h-24" />
			) : pages.isError ? (
				<p className="text-destructive text-sm">{pages.error.message}</p>
			) : pages.data.length === 0 ? (
				<p className="text-muted-foreground text-sm">
					Nenhuma Página foi encontrada. Confira se a conta usada no login
					administra a Página do veículo e se todas as permissões foram aceitas.
				</p>
			) : (
				<ul className="flex flex-col gap-2">
					{pages.data.map((page) => (
						<li
							key={page.id}
							className="flex flex-wrap items-center gap-3 rounded-md border p-3"
						>
							{page.pictureUrl ? (
								<img
									src={page.pictureUrl}
									alt=""
									className="size-10 rounded-full"
								/>
							) : null}
							<div className="min-w-0 flex-1">
								<p className="truncate font-medium text-sm">{page.name}</p>
								<p className="text-muted-foreground text-xs">
									{page.instagram
										? `Instagram: @${page.instagram.username}`
										: "Sem Instagram profissional vinculado"}
								</p>
							</div>
							<Button
								size="sm"
								disabled={connect.isPending}
								onClick={() => connect.mutate({ pageId: page.id })}
							>
								Usar esta Página
							</Button>
						</li>
					))}
				</ul>
			)}
		</section>
	);
}
