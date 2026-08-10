"use client";

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
import { Avatar, AvatarFallback } from "@portal-app/ui/components/avatar";
import { Badge } from "@portal-app/ui/components/badge";
import { Button } from "@portal-app/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@portal-app/ui/components/select";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@portal-app/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Copy, KeyRound, UserCheck, UserMinus } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

const ROLES = ["ADMIN", "EDITOR", "REDATOR"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
	ADMIN: "Administrador",
	EDITOR: "Editor",
	REDATOR: "Redator",
};

const ROLE_HINTS: Record<Role, string> = {
	ADMIN: "Faz tudo, inclusive gerir equipe e configurações.",
	EDITOR: "Aprova e publica nas editorias a que está vinculado.",
	REDATOR: "Escreve e envia para revisão as próprias matérias.",
};

export function UsersTable() {
	const queryClient = useQueryClient();
	const users = useQuery(trpc.identity.users.list.queryOptions());
	const [confirming, setConfirming] = useState<string | null>(null);
	const [resetLink, setResetLink] = useState<{
		email: string;
		url: string;
	} | null>(null);

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.identity.users.list.queryKey(),
		});
	const onError = (error: { message: string }) => toast.error(error.message);

	const setRole = useMutation(
		trpc.identity.users.setRole.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Papel atualizado.");
			},
			onError,
		}),
	);
	const deactivate = useMutation(
		trpc.identity.users.deactivate.mutationOptions({
			onSuccess: invalidate,
			onError,
		}),
	);
	const activate = useMutation(
		trpc.identity.users.activate.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Membro reativado.");
			},
			onError,
		}),
	);
	const resetPassword = useMutation(
		trpc.identity.users.resetPassword.mutationOptions({
			onSuccess: (data, variables) => {
				const email = list.find((u) => u.id === variables.staffId)?.email;
				setResetLink({ email: email ?? "", url: data.url });
			},
			onError,
		}),
	);

	const list = users.data ?? [];
	const target = list.find((u) => u.id === confirming);

	return (
		<>
			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>Pessoa</TableHead>
							<TableHead className="w-56">Papel</TableHead>
							<TableHead className="w-28">Situação</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{users.isLoading ? (
							["a", "b", "c"].map((k) => (
								<TableRow key={k}>
									<TableCell colSpan={4}>
										<Skeleton className="h-8 w-full" />
									</TableCell>
								</TableRow>
							))
						) : list.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="py-12 text-center">
									<p className="font-medium">Ninguém na equipe ainda.</p>
								</TableCell>
							</TableRow>
						) : (
							list.map((user) => (
								<TableRow key={user.id}>
									<TableCell>
										<div className="flex items-center gap-3">
											<Avatar className="size-8">
												<AvatarFallback className="text-xs">
													{user.email.slice(0, 2).toUpperCase()}
												</AvatarFallback>
											</Avatar>
											<div className="min-w-0">
												<p className="truncate font-medium">{user.email}</p>
												{user.authorProfile?.title ? (
													<p className="truncate text-muted-foreground text-xs">
														{user.authorProfile.title}
													</p>
												) : null}
											</div>
										</div>
									</TableCell>
									<TableCell>
										<Select
											items={ROLES.map((r) => ({
												value: r,
												label: ROLE_LABELS[r],
											}))}
											value={user.role}
											disabled={!user.active}
											onValueChange={(value) =>
												value &&
												setRole.mutate({
													staffId: user.id,
													role: value as Role,
												})
											}
										>
											<SelectTrigger className="w-full">
												<SelectValue />
											</SelectTrigger>
											<SelectContent>
												{ROLES.map((role) => (
													<SelectItem key={role} value={role}>
														<span className="flex flex-col">
															<span>{ROLE_LABELS[role]}</span>
															<span className="text-muted-foreground text-xs">
																{ROLE_HINTS[role]}
															</span>
														</span>
													</SelectItem>
												))}
											</SelectContent>
										</Select>
									</TableCell>
									<TableCell>
										{user.active ? (
											<Badge
												variant="secondary"
												className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
											>
												Ativo
											</Badge>
										) : (
											<Badge variant="secondary">Inativo</Badge>
										)}
									</TableCell>
									<TableCell>
										<div className="flex justify-end">
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Gerar link de redefinição de senha para ${user.email}`}
												disabled={resetPassword.isPending}
												onClick={() =>
													resetPassword.mutate({ staffId: user.id })
												}
											>
												<KeyRound className="size-4" />
											</Button>
											{user.active ? (
												<Button
													variant="ghost"
													size="icon"
													aria-label={`Desativar ${user.email}`}
													onClick={() => setConfirming(user.id)}
												>
													<UserMinus className="size-4 text-destructive" />
												</Button>
											) : (
												<Button
													variant="ghost"
													size="icon"
													aria-label={`Reativar ${user.email}`}
													disabled={activate.isPending}
													onClick={() => activate.mutate({ staffId: user.id })}
												>
													<UserCheck className="size-4" />
												</Button>
											)}
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			<AlertDialog
				open={confirming !== null}
				onOpenChange={(open) => !open && setConfirming(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Desativar {target?.email}?</AlertDialogTitle>
						<AlertDialogDescription>
							A pessoa perde o acesso ao painel imediatamente. As matérias que
							ela assinou continuam publicadas e com a assinatura dela — é por
							isso que desativamos em vez de excluir.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								if (target) {
									deactivate.mutate({ staffId: target.id });
								}
								setConfirming(null);
							}}
						>
							Desativar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>

			<Dialog
				open={resetLink !== null}
				onOpenChange={(open) => !open && setResetLink(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>
							Link de redefinição para {resetLink?.email}
						</DialogTitle>
						<DialogDescription>
							Copie e entregue este link pelo canal que preferir (não é enviado
							por e-mail automaticamente). Ele expira em 1 hora e só funciona
							uma vez.
						</DialogDescription>
					</DialogHeader>
					<div className="flex items-center gap-2">
						<Input
							readOnly
							aria-label="Link de redefinição"
							value={resetLink?.url ?? ""}
							className="text-xs"
						/>
						<Button
							type="button"
							variant="outline"
							size="icon"
							aria-label="Copiar link"
							onClick={() => {
								if (resetLink) {
									navigator.clipboard.writeText(resetLink.url);
									toast.success("Link copiado.");
								}
							}}
						>
							<Copy className="size-4" />
						</Button>
					</div>
					<DialogFooter>
						<Button variant="outline" onClick={() => setResetLink(null)}>
							Fechar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
