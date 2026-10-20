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
import { Checkbox } from "@portal-app/ui/components/checkbox";
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
	const [sectionIds, setSectionIds] = useState<string[]>([]);

	const invitations = useQuery(trpc.identity.invitations.list.queryOptions());
	const sections = useQuery(trpc.taxonomy.sections.list.queryOptions());

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.identity.invitations.list.queryKey(),
		});

	const create = useMutation(
		trpc.identity.invitations.create.mutationOptions({
			onSuccess: (invitation) => {
				setEmail("");
				setSectionIds([]);
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
	const activeSections = (sections.data ?? []).filter(
		(section) => section.active,
	);
	const editorWithoutSection = role === "EDITOR" && sectionIds.length === 0;
	const toggleSection = (sectionId: string) => {
		setSectionIds((current) =>
			current.includes(sectionId)
				? current.filter((id) => id !== sectionId)
				: [...current, sectionId],
		);
	};

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
							create.mutate({
								email,
								role,
								sectionIds: role === "EDITOR" ? sectionIds : [],
							});
						}}
						className="flex flex-col gap-4"
					>
						<div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_13rem_auto] sm:items-end">
							<div className="flex flex-col gap-1.5">
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

							<div className="flex flex-col gap-1.5">
								<Label>Papel</Label>
								<Select
									items={ROLES.map((item) => ({
										value: item,
										label: ROLE_LABELS[item],
									}))}
									value={role}
									onValueChange={(value) => {
										if (value) {
											setRole(value as Role);
											if (value !== "EDITOR") {
												setSectionIds([]);
											}
										}
									}}
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

							<Button
								type="submit"
								disabled={create.isPending || editorWithoutSection}
							>
								<UserPlus className="size-4" />
								{create.isPending ? "Convidando…" : "Convidar"}
							</Button>
						</div>

						{role === "EDITOR" ? (
							<div>
								<Label>Editorias do editor</Label>
								<p className="mt-1 mb-2 text-muted-foreground text-xs">
									Ele poderá revisar e publicar somente nas editorias marcadas.
								</p>
								<div className="flex flex-wrap gap-3 rounded-md border p-3">
									{activeSections.map((section) => (
										<div key={section.id} className="flex items-center gap-2">
											<Checkbox
												id={`convite-editoria-${section.id}`}
												checked={sectionIds.includes(section.id)}
												onCheckedChange={() => toggleSection(section.id)}
											/>
											<Label
												htmlFor={`convite-editoria-${section.id}`}
												className="cursor-pointer font-normal"
											>
												{section.name}
											</Label>
										</div>
									))}
									{!sections.isLoading && activeSections.length === 0 ? (
										<p className="text-muted-foreground text-sm">
											Crie uma editoria ativa antes de convidar um editor.
										</p>
									) : null}
								</div>
								{editorWithoutSection ? (
									<p className="mt-1.5 text-destructive text-xs">
										Selecione ao menos uma editoria.
									</p>
								) : null}
							</div>
						) : null}
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
