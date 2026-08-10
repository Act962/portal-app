"use client";

import { Slug } from "@portal-app/taxonomy";
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
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
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
import { Textarea } from "@portal-app/ui/components/textarea";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

const DEFAULT_COLOR = "#2563eb";

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

	const [creating, setCreating] = useState(false);
	const [name, setName] = useState("");
	const [description, setDescription] = useState("");
	const [color, setColor] = useState(DEFAULT_COLOR);
	const [confirming, setConfirming] = useState<string | null>(null);

	const list = sections.data ?? [];
	const target = list.find((s) => s.id === confirming);

	/**
	 * O endereço vem do MESMO objeto de valor que o servidor usa (`Slug`), e não
	 * de uma cópia da regra aqui. Um preview que normaliza diferente do domínio é
	 * pior que preview nenhum: promete `/politica-local` e grava outra coisa.
	 */
	const slugResult = Slug.create(name);
	const slug = slugResult.isOk() ? slugResult.unwrap().value : null;

	/**
	 * Aviso de endereço repetido antes de enviar. O servidor continua sendo a
	 * autoridade — isto só evita a viagem de ida e volta para descobrir algo que
	 * a lista já carregada sabe responder.
	 */
	const slugTaken = slug !== null && list.some((s) => s.slug === slug);

	const openCreate = () => {
		setName("");
		setDescription("");
		setColor(DEFAULT_COLOR);
		setCreating(true);
	};

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
			{/* Criar editoria saiu do inline para um diálogo. Editoria não é registro
			    corriqueiro: define a navegação do portal, a URL pública e — como não
			    existe tela de edição — tudo o que se preenche aqui é PERMANENTE. Um
			    campo solto ao lado de um botão convida a criar sem pensar; o diálogo
			    dá espaço para o endereço e a descrição, que o inline não comportava e
			    que ninguém consegue corrigir depois. */}
			<div className="flex justify-end">
				<Button onClick={openCreate}>
					<Plus className="size-4" />
					Nova editoria
				</Button>
			</div>

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
									{/* Com a criação atrás de um diálogo, o vazio precisa
									    oferecer a saída — senão a tela só informa o problema. */}
									<Button className="mt-4" onClick={openCreate}>
										<Plus className="size-4" />
										Criar a primeira
									</Button>
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

			<Dialog
				open={creating}
				onOpenChange={(open) => !open && setCreating(false)}
			>
				<DialogContent>
					<form
						onSubmit={(event) => {
							event.preventDefault();
							create.mutate(
								{
									name: name.trim(),
									color,
									// Só manda descrição se houver: string vazia gravaria uma
									// meta description em branco, que é pior que ausente.
									...(description.trim()
										? { description: description.trim() }
										: {}),
								},
								{
									onSuccess: (section) => {
										setCreating(false);
										toast.success(`Editoria “${section.name}” criada.`);
									},
									// Em erro o diálogo FICA aberto com o que foi digitado. A
									// versão inline limpava o campo junto com o `mutate`, então
									// um nome repetido levava embora o texto e o contexto.
								},
							);
						}}
					>
						<DialogHeader>
							<DialogTitle>Nova editoria</DialogTitle>
							<DialogDescription>
								Editorias organizam o portal, aparecem na navegação e são
								exigidas para publicar.
							</DialogDescription>
						</DialogHeader>

						<div className="flex flex-col gap-4 py-4">
							<div className="flex flex-col gap-2">
								<Label htmlFor="section-name">Nome</Label>
								<div className="flex items-center gap-2">
									{/* biome-ignore lint/a11y/noAutofocus: primeiro campo do diálogo */}
									<Input
										autoFocus
										id="section-name"
										value={name}
										onChange={(event) => setName(event.target.value)}
										placeholder="Ex.: Política"
									/>
									<input
										type="color"
										value={color}
										onChange={(event) => setColor(event.target.value)}
										aria-label="Cor da editoria"
										className="h-9 w-12 shrink-0 cursor-pointer rounded-md border bg-transparent"
									/>
								</div>
								{/* O endereço é derivado do nome e NÃO muda depois. Sem mostrá-lo
								    aqui, o editor só descobre a URL do portal depois de criar. */}
								<p className="text-muted-foreground text-xs">
									{slug ? (
										<>
											Endereço no portal:{" "}
											<code className="rounded bg-muted px-1 py-0.5 font-mono">
												/{slug}
											</code>{" "}
											— não muda depois.
										</>
									) : (
										"O endereço no portal é gerado a partir do nome."
									)}
								</p>
								{slugTaken ? (
									<p className="text-destructive text-xs">
										Já existe uma editoria em <code>/{slug}</code>. Escolha
										outro nome.
									</p>
								) : null}
							</div>

							<div className="flex flex-col gap-2">
								<Label htmlFor="section-description">
									Descrição{" "}
									<span className="font-normal text-muted-foreground">
										(opcional)
									</span>
								</Label>
								<Textarea
									id="section-description"
									value={description}
									onChange={(event) => setDescription(event.target.value)}
									placeholder="Uma frase sobre o que sai nesta editoria."
									rows={3}
								/>
								{/* Não é enfeite: é a meta description e o texto que aparece ao
								    compartilhar a página da editoria. O form inline não tinha
								    onde pedi-la, então toda editoria nascia sem. */}
								<p className="text-muted-foreground text-xs">
									Aparece no Google e ao compartilhar o link da editoria.
								</p>
							</div>
						</div>

						<DialogFooter>
							<Button
								type="button"
								variant="outline"
								onClick={() => setCreating(false)}
							>
								Cancelar
							</Button>
							<Button
								type="submit"
								disabled={slug === null || slugTaken || create.isPending}
							>
								Criar editoria
							</Button>
						</DialogFooter>
					</form>
				</DialogContent>
			</Dialog>

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
