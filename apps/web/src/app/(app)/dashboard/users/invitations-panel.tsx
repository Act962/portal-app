"use client";

import { Badge } from "@portal-app/ui/components/badge";
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
import { Trash2, UserPlus } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

const ROLES = ["ADMIN", "EDITOR", "REDATOR"] as const;
type Role = (typeof ROLES)[number];

const ROLE_LABELS: Record<Role, string> = {
	ADMIN: "Administrador",
	EDITOR: "Editor",
	REDATOR: "Redator",
};

export function InvitationsPanel() {
	const queryClient = useQueryClient();
	const emailId = useId();
	const [email, setEmail] = useState("");
	const [role, setRole] = useState<Role>("REDATOR");

	const invitations = useQuery(trpc.identity.invitations.list.queryOptions());

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.identity.invitations.list.queryKey(),
		});

	const create = useMutation(
		trpc.identity.invitations.create.mutationOptions({
			onSuccess: (invitation) => {
				setEmail("");
				invalidate();
				toast.success(
					`Convite criado para ${invitation.email}. Avise a pessoa para se cadastrar com ESTE e-mail.`,
				);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const revoke = useMutation(
		trpc.identity.invitations.revoke.mutationOptions({
			onSuccess: invalidate,
			onError: (error) => toast.error(error.message),
		}),
	);

	const list = invitations.data ?? [];

	return (
		<div className="flex flex-col gap-4">
			<Card>
				<CardHeader>
					<CardTitle>Convidar alguém</CardTitle>
					<CardDescription>
						O cadastro no painel é <strong>fechado</strong>: só quem tem convite
						consegue criar conta. A pessoa se cadastra em{" "}
						<code className="rounded bg-muted px-1">/login</code> usando
						exatamente o e-mail convidado — não há link secreto para enviar.
					</CardDescription>
				</CardHeader>
				<CardContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							create.mutate({ email, role });
						}}
						className="flex flex-col gap-3 sm:flex-row sm:items-end"
					>
						<div className="flex flex-1 flex-col gap-1.5">
							<Label htmlFor={emailId}>E-mail</Label>
							<Input
								id={emailId}
								type="email"
								required
								placeholder="jornalista@fm7cidades.com"
								value={email}
								onChange={(event) => setEmail(event.target.value)}
							/>
						</div>

						<div className="flex flex-col gap-1.5 sm:w-52">
							<Label>Papel</Label>
							<Select
								value={role}
								onValueChange={(value) => value && setRole(value as Role)}
							>
								<SelectTrigger>
									<SelectValue />
								</SelectTrigger>
								<SelectContent>
									{ROLES.map((item) => (
										<SelectItem key={item} value={item}>
											{ROLE_LABELS[item]}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
						</div>

						<Button type="submit" disabled={create.isPending}>
							<UserPlus className="size-4" />
							{create.isPending ? "Convidando…" : "Convidar"}
						</Button>
					</form>
				</CardContent>
			</Card>

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead>E-mail convidado</TableHead>
							<TableHead className="w-40">Papel</TableHead>
							<TableHead className="w-36">Situação</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{invitations.isLoading ? (
							<TableRow>
								<TableCell colSpan={4}>
									<Skeleton className="h-8 w-full" />
								</TableCell>
							</TableRow>
						) : list.length === 0 ? (
							<TableRow>
								<TableCell colSpan={4} className="py-10 text-center">
									<p className="font-medium">Nenhum convite ainda.</p>
									<p className="mt-1 text-muted-foreground text-sm">
										Ninguém consegue criar conta até ser convidado.
									</p>
								</TableCell>
							</TableRow>
						) : (
							list.map((invitation) => (
								<TableRow key={invitation.id}>
									<TableCell className="font-medium">
										{invitation.email}
									</TableCell>
									<TableCell>{ROLE_LABELS[invitation.role as Role]}</TableCell>
									<TableCell>
										{invitation.acceptedAt ? (
											<Badge variant="secondary">Já entrou</Badge>
										) : invitation.open ? (
											<Badge
												variant="secondary"
												className="bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200"
											>
												Aguardando
											</Badge>
										) : (
											<Badge variant="secondary">Vencido</Badge>
										)}
									</TableCell>
									<TableCell>
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Revogar convite de ${invitation.email}`}
											onClick={() => revoke.mutate({ id: invitation.id })}
										>
											<Trash2 className="size-4 text-destructive" />
										</Button>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>
		</div>
	);
}
