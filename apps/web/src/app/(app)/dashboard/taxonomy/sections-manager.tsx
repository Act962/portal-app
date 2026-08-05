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
import { Badge } from "@portal-app/ui/components/badge";
import { Button } from "@portal-app/ui/components/button";
import { Input } from "@portal-app/ui/components/input";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { Switch } from "@portal-app/ui/components/switch";
import {
	Table,
	TableBody,
	TableCell,
	TableHead,
	TableHeader,
	TableRow,
} from "@portal-app/ui/components/table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

export function SectionsManager() {
	const queryClient = useQueryClient();
	const sections = useQuery(trpc.taxonomy.sections.list.queryOptions());

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.taxonomy.sections.list.queryKey(),
		});
	const onError = (error: { message: string }) => toast.error(error.message);

	const create = useMutation(
		trpc.taxonomy.sections.create.mutationOptions({
			onSuccess: invalidate,
			onError,
		}),
	);
	const setActive = useMutation(
		trpc.taxonomy.sections.setActive.mutationOptions({
			onSuccess: invalidate,
			onError,
		}),
	);
	const remove = useMutation(
		trpc.taxonomy.sections.delete.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Editoria excluída.");
			},
			// O domínio recusa apagar editoria em uso — a mensagem explica, e o
			// diálogo oferece desativar como saída.
			onError,
		}),
	);
	const reorder = useMutation(
		trpc.taxonomy.sections.reorder.mutationOptions({
			onSuccess: invalidate,
			onError,
		}),
	);

	const [name, setName] = useState("");
	const [color, setColor] = useState("#2563eb");
	const [confirming, setConfirming] = useState<string | null>(null);

	const list = sections.data ?? [];
	const target = list.find((s) => s.id === confirming);

	/** Sobe/desce trocando a posição e persistindo a ordem completa. */
	const move = (index: number, direction: -1 | 1) => {
		const to = index + direction;
		if (to < 0 || to >= list.length) {
			return;
		}
		const next = [...list];
		const [moved] = next.splice(index, 1);
		if (moved) {
			next.splice(to, 0, moved);
		}
		reorder.mutate({
			orders: next.map((section, order) => ({ id: section.id, order })),
		});
	};

	return (
		<div className="flex flex-col gap-4">
			<form
				className="flex flex-wrap items-center gap-2"
				onSubmit={(event) => {
					event.preventDefault();
					if (name.trim()) {
						create.mutate({ name: name.trim(), color });
						setName("");
					}
				}}
			>
				<Input
					value={name}
					onChange={(event) => setName(event.target.value)}
					placeholder="Nome da nova editoria"
					className="max-w-xs"
				/>
				<input
					type="color"
					value={color}
					onChange={(event) => setColor(event.target.value)}
					aria-label="Cor da editoria"
					className="h-9 w-12 cursor-pointer rounded-md border bg-transparent"
				/>
				<Button type="submit" disabled={!name.trim() || create.isPending}>
					<Plus className="size-4" />
					Adicionar
				</Button>
			</form>

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-24">Ordem</TableHead>
							<TableHead>Nome</TableHead>
							<TableHead>Endereço</TableHead>
							<TableHead className="w-28">Ativa</TableHead>
							<TableHead className="w-12" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{sections.isLoading ? (
							["a", "b", "c"].map((k) => (
								<TableRow key={k}>
									<TableCell colSpan={5}>
										<Skeleton className="h-6 w-full" />
									</TableCell>
								</TableRow>
							))
						) : list.length === 0 ? (
							<TableRow>
								<TableCell colSpan={5} className="py-12 text-center">
									<p className="font-medium">Nenhuma editoria ainda.</p>
									<p className="mt-1 text-muted-foreground text-sm">
										As editorias organizam o portal e são exigidas para
										publicar.
									</p>
								</TableCell>
							</TableRow>
						) : (
							list.map((section, index) => (
								<TableRow key={section.id}>
									<TableCell>
										<div className="flex">
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Subir ${section.name}`}
												disabled={index === 0}
												onClick={() => move(index, -1)}
											>
												<ArrowUp className="size-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Descer ${section.name}`}
												disabled={index === list.length - 1}
												onClick={() => move(index, 1)}
											>
												<ArrowDown className="size-4" />
											</Button>
										</div>
									</TableCell>
									<TableCell>
										<span className="flex items-center gap-2 font-medium">
											<span
												aria-hidden
												className="inline-block size-3 rounded-full border"
												style={{
													backgroundColor: section.color ?? "transparent",
												}}
											/>
											{section.name}
										</span>
									</TableCell>
									<TableCell className="text-muted-foreground">
										/{section.slug}
									</TableCell>
									<TableCell>
										<div className="flex items-center gap-2">
											<Switch
												checked={section.active}
												onCheckedChange={(checked) =>
													setActive.mutate({
														id: section.id,
														active: Boolean(checked),
													})
												}
												aria-label={`Ativar ${section.name}`}
											/>
											{!section.active ? (
												<Badge variant="secondary">oculta</Badge>
											) : null}
										</div>
									</TableCell>
									<TableCell>
										<Button
											variant="ghost"
											size="icon"
											aria-label={`Excluir ${section.name}`}
											onClick={() => setConfirming(section.id)}
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

			<AlertDialog
				open={confirming !== null}
				onOpenChange={(open) => !open && setConfirming(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Excluir a editoria “{target?.name}”?
						</AlertDialogTitle>
						<AlertDialogDescription>
							A exclusão é recusada se houver matéria usando esta editoria.
							Nesse caso, prefira desativá-la: ela some do portal sem afetar o
							que já foi publicado.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						{target?.active ? (
							<Button
								variant="outline"
								onClick={() => {
									setActive.mutate({ id: target.id, active: false });
									setConfirming(null);
								}}
							>
								Só desativar
							</Button>
						) : null}
						<AlertDialogAction
							onClick={() => {
								if (target) {
									remove.mutate({ id: target.id });
								}
								setConfirming(null);
							}}
						>
							Excluir
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
