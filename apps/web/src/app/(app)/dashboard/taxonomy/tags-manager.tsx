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
import { Button } from "@portal-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@portal-app/ui/components/card";
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
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

export function TagsManager() {
	const queryClient = useQueryClient();
	const tags = useQuery(trpc.taxonomy.tags.list.queryOptions());

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.taxonomy.tags.list.queryKey(),
		});
	const onError = (error: { message: string }) => toast.error(error.message);

	const create = useMutation(
		trpc.taxonomy.tags.create.mutationOptions({
			onSuccess: invalidate,
			onError,
		}),
	);
	const rename = useMutation(
		trpc.taxonomy.tags.rename.mutationOptions({
			onSuccess: invalidate,
			onError,
		}),
	);
	const remove = useMutation(
		trpc.taxonomy.tags.delete.mutationOptions({
			onSuccess: invalidate,
			onError,
		}),
	);
	const merge = useMutation(
		trpc.taxonomy.tags.merge.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Assuntos mesclados.");
			},
			onError,
		}),
	);

	const [name, setName] = useState("");
	const [editingId, setEditingId] = useState<string | null>(null);
	const [draft, setDraft] = useState("");
	const [sourceId, setSourceId] = useState("");
	const [targetId, setTargetId] = useState("");
	const [confirming, setConfirming] = useState<string | null>(null);
	const [confirmMerge, setConfirmMerge] = useState(false);

	const list = tags.data ?? [];
	const target = list.find((t) => t.id === confirming);
	const nameOf = (id: string) => list.find((t) => t.id === id)?.name ?? "";

	return (
		<div className="flex flex-col gap-6">
			<div className="flex flex-col gap-4">
				<form
					className="flex flex-wrap items-center gap-2"
					onSubmit={(event) => {
						event.preventDefault();
						if (name.trim()) {
							create.mutate({ name: name.trim() });
							setName("");
						}
					}}
				>
					<Input
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="Nome do novo assunto"
						className="max-w-xs"
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
								<TableHead>Assunto</TableHead>
								<TableHead>Endereço</TableHead>
								<TableHead className="w-24" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{tags.isLoading ? (
								["a", "b", "c"].map((k) => (
									<TableRow key={k}>
										<TableCell colSpan={3}>
											<Skeleton className="h-6 w-full" />
										</TableCell>
									</TableRow>
								))
							) : list.length === 0 ? (
								<TableRow>
									<TableCell colSpan={3} className="py-12 text-center">
										<p className="font-medium">Nenhum assunto ainda.</p>
										<p className="mt-1 text-muted-foreground text-sm">
											Assuntos agrupam matérias por tema e viram páginas no
											portal.
										</p>
									</TableCell>
								</TableRow>
							) : (
								list.map((tag) => (
									<TableRow key={tag.id}>
										<TableCell>
											{editingId === tag.id ? (
												<Input
													value={draft}
													onChange={(event) => setDraft(event.target.value)}
													className="max-w-xs"
												/>
											) : (
												<span className="font-medium">{tag.name}</span>
											)}
										</TableCell>
										<TableCell className="text-muted-foreground">
											/tag/{tag.slug}
										</TableCell>
										<TableCell>
											<div className="flex justify-end">
												{editingId === tag.id ? (
													<>
														<Button
															variant="ghost"
															size="icon"
															aria-label="Salvar"
															disabled={!draft.trim()}
															onClick={() => {
																rename.mutate({
																	id: tag.id,
																	name: draft.trim(),
																});
																setEditingId(null);
															}}
														>
															<Check className="size-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															aria-label="Cancelar"
															onClick={() => setEditingId(null)}
														>
															<X className="size-4" />
														</Button>
													</>
												) : (
													<>
														<Button
															variant="ghost"
															size="icon"
															aria-label={`Renomear ${tag.name}`}
															onClick={() => {
																setEditingId(tag.id);
																setDraft(tag.name);
															}}
														>
															<Pencil className="size-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															aria-label={`Excluir ${tag.name}`}
															onClick={() => setConfirming(tag.id)}
														>
															<Trash2 className="size-4 text-destructive" />
														</Button>
													</>
												)}
											</div>
										</TableCell>
									</TableRow>
								))
							)}
						</TableBody>
					</Table>
				</div>
			</div>

			{list.length > 1 ? (
				<Card>
					<CardHeader>
						<CardTitle className="text-base">Mesclar duplicados</CardTitle>
						<CardDescription>
							Junta dois assuntos que dizem a mesma coisa. As matérias do
							primeiro passam para o segundo, e o primeiro deixa de existir.
						</CardDescription>
					</CardHeader>
					<CardContent className="flex flex-wrap items-end gap-2">
						<Select
							value={sourceId}
							onValueChange={(value) => setSourceId(value ?? "")}
						>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Assunto a absorver" />
							</SelectTrigger>
							<SelectContent>
								{list.map((tag) => (
									<SelectItem key={tag.id} value={tag.id}>
										{tag.name}
									</SelectItem>
								))}
							</SelectContent>
						</Select>

						<span className="pb-2 text-muted-foreground text-sm">vira</span>

						<Select
							value={targetId}
							onValueChange={(value) => setTargetId(value ?? "")}
						>
							<SelectTrigger className="w-48">
								<SelectValue placeholder="Assunto que fica" />
							</SelectTrigger>
							<SelectContent>
								{list
									.filter((tag) => tag.id !== sourceId)
									.map((tag) => (
										<SelectItem key={tag.id} value={tag.id}>
											{tag.name}
										</SelectItem>
									))}
							</SelectContent>
						</Select>

						<Button
							variant="outline"
							disabled={!sourceId || !targetId || sourceId === targetId}
							onClick={() => setConfirmMerge(true)}
						>
							Mesclar
						</Button>
					</CardContent>
				</Card>
			) : null}

			<AlertDialog
				open={confirming !== null}
				onOpenChange={(open) => !open && setConfirming(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Excluir o assunto “{target?.name}”?
						</AlertDialogTitle>
						<AlertDialogDescription>
							As matérias continuam existindo — só deixam de ser agrupadas por
							este assunto, e a página dele sai do ar.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
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

			<AlertDialog open={confirmMerge} onOpenChange={setConfirmMerge}>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>
							Mesclar “{nameOf(sourceId)}” em “{nameOf(targetId)}”?
						</AlertDialogTitle>
						<AlertDialogDescription>
							Não há como desfazer. “{nameOf(sourceId)}” deixa de existir e suas
							matérias passam a responder por “{nameOf(targetId)}”.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Cancelar</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => {
								merge.mutate({ sourceId, targetId });
								setSourceId("");
								setTargetId("");
								setConfirmMerge(false);
							}}
						>
							Mesclar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}
