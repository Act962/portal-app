"use client";

import { Slug } from "@portal-app/columnists";
import { MAX_PAGE_SIZE } from "@portal-app/shared-kernel";
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
	Dialog,
	DialogContent,
	DialogDescription,
	DialogFooter,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
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
import { ImageIcon, Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useMemo, useState } from "react";
import { toast } from "sonner";

import { SortableRow, SortableRows } from "@/components/admin/sortable-rows";
import { AssetImage } from "@/components/media/asset-image";
import { ImageField } from "@/components/media/image-field";
import { trpc } from "@/utils/trpc";

type ColumnistDto = {
	id: string;
	slug: string;
	name: string;
	beat: string;
	blurb: string;
	photoMediaId: string | null;
	order: number;
	active: boolean;
};

type FormState = {
	name: string;
	beat: string;
	blurb: string;
	photoMediaId: string | null;
};

const EMPTY_FORM: FormState = {
	name: "",
	beat: "",
	blurb: "",
	photoMediaId: null,
};

export function ColumnistsManager() {
	const queryClient = useQueryClient();
	const columnists = useQuery(trpc.columnists.list.queryOptions());
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<ColumnistDto | null>(null);
	const [confirming, setConfirming] = useState<string | null>(null);
	const [form, setForm] = useState<FormState>(EMPTY_FORM);

	const invalidate = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.columnists.list.queryKey(),
		});
	const onError = (error: { message: string }) => toast.error(error.message);

	const create = useMutation(
		trpc.columnists.create.mutationOptions({
			onSuccess: (created) => {
				invalidate();
				setCreating(false);
				setForm(EMPTY_FORM);
				toast.success(`${created.name} entrou no bloco de colunistas.`);
			},
			onError,
		}),
	);
	const update = useMutation(
		trpc.columnists.update.mutationOptions({
			onSuccess: () => {
				invalidate();
				setEditing(null);
			},
			onError,
		}),
	);
	const setActive = useMutation(
		trpc.columnists.setActive.mutationOptions({
			onSuccess: invalidate,
			onError,
		}),
	);
	/**
	 * Reordenar é a única ação daqui que o usuário vê ANTES de o servidor
	 * responder — a linha já está sob o dedo, no lugar novo. Sem escrever no
	 * cache aqui, ela voltaria ao lugar antigo até a resposta chegar e então
	 * saltaria de novo. Em erro, desfaz e diz o porquê.
	 */
	const reorder = useMutation(
		trpc.columnists.reorder.mutationOptions({
			onMutate: async ({ orders }) => {
				const queryKey = trpc.columnists.list.queryKey();
				await queryClient.cancelQueries({ queryKey });
				const previous = queryClient.getQueryData(queryKey);
				const position = new Map(orders.map((o) => [o.id, o.order]));
				queryClient.setQueryData(queryKey, (old) =>
					old
						? [...old].sort(
								(a, b) =>
									(position.get(a.id) ?? a.order) -
									(position.get(b.id) ?? b.order),
							)
						: old,
				);
				return { previous };
			},
			onError: (error, _input, context) => {
				queryClient.setQueryData(
					trpc.columnists.list.queryKey(),
					context?.previous,
				);
				onError(error);
			},
			onSettled: invalidate,
		}),
	);
	const remove = useMutation(
		trpc.columnists.delete.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Colunista removido do bloco.");
			},
			onError,
		}),
	);

	const list = columnists.data ?? [];
	const target = list.find((c) => c.id === confirming);

	/**
	 * As fotos da lista, buscadas de uma vez pelos ids — não uma consulta por
	 * linha. A tabela mostrava só nome e endereço, então não havia como conferir
	 * QUEM está no bloco da home sem abrir cada um; e quem escolhia a foto errada
	 * não descobria nem abrindo, porque o diálogo também não a mostrava.
	 */
	const photoIds = useMemo(
		() => [
			...new Set(list.map((c) => c.photoMediaId).filter((id) => id !== null)),
		],
		[list],
	);
	const photos = useQuery({
		...trpc.media.library.queryOptions({
			ids: photoIds,
			perPage: MAX_PAGE_SIZE,
		}),
		enabled: photoIds.length > 0,
	});
	const photoById = new Map(
		(photos.data?.items ?? []).map((asset) => [asset.id, asset]),
	);

	/**
	 * O endereço vem do MESMO objeto de valor que o servidor usa (`Slug`), e não
	 * de uma cópia da regra aqui — mesma razão da tela de editorias: preview que
	 * normaliza diferente promete um endereço e grava outro.
	 */
	const slugResult = Slug.create(form.name);
	const slug = slugResult.isOk() ? slugResult.unwrap().value : null;

	/**
	 * Aviso de assinatura repetida antes de enviar, a partir da lista já
	 * carregada. O servidor continua sendo a autoridade (devolve `SlugTaken`).
	 */
	const slugTaken = slug !== null && list.some((c) => c.slug === slug);

	/** Persiste a ordem COMPLETA — a posição de um item só existe em relação
	 *  aos outros, e gravar só o que se moveu deixaria buracos na sequência. */
	const persistOrder = (ids: string[]) =>
		reorder.mutate({
			orders: ids.map((id, position) => ({ id, order: position })),
		});

	const openEdit = (columnist: ColumnistDto) => {
		setForm({
			name: columnist.name,
			beat: columnist.beat,
			blurb: columnist.blurb,
			photoMediaId: columnist.photoMediaId,
		});
		setEditing(columnist);
	};

	const submitCreate = (event: React.FormEvent) => {
		event.preventDefault();
		create.mutate({
			name: form.name.trim(),
			beat: form.beat.trim(),
			blurb: form.blurb.trim(),
			photoMediaId: form.photoMediaId,
		});
	};

	const submitEdit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!editing) {
			return;
		}
		update.mutate({
			id: editing.id,
			name: form.name.trim(),
			beat: form.beat.trim(),
			blurb: form.blurb.trim(),
			photoMediaId: form.photoMediaId,
		});
	};

	return (
		<div className="flex flex-col gap-4">
			<Dialog open={creating} onOpenChange={setCreating}>
				<div className="flex justify-end">
					<DialogTrigger
						render={
							<Button
								type="button"
								onClick={() => {
									setForm(EMPTY_FORM);
									setCreating(true);
								}}
							/>
						}
					>
						<Plus className="size-4" />
						Novo colunista
					</DialogTrigger>
				</div>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Novo colunista</DialogTitle>
						<DialogDescription>
							O nome precisa ser o MESMO com que as matérias são assinadas — é
							ele que liga o perfil aos textos da pessoa, e não dá para mudar
							depois.
						</DialogDescription>
					</DialogHeader>
					<ColumnistForm
						form={form}
						onChange={setForm}
						onSubmit={submitCreate}
						slug={slug}
						slugTaken={slugTaken}
					>
						<Button
							type="submit"
							disabled={slug === null || slugTaken || create.isPending}
						>
							Criar
						</Button>
					</ColumnistForm>
				</DialogContent>
			</Dialog>

			<div className="rounded-lg border">
				<SortableRows
					items={list}
					onReorder={persistOrder}
					labelOf={(id) => list.find((item) => item.id === id)?.name ?? id}
				>
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead className="w-12">
									<span className="sr-only">Ordem</span>
								</TableHead>
								<TableHead>Colunista</TableHead>
								<TableHead>Coluna</TableHead>
								<TableHead className="w-24">No ar</TableHead>
								<TableHead className="w-20" />
							</TableRow>
						</TableHeader>
						<TableBody>
							{columnists.isLoading ? (
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
										<p className="font-medium">Nenhum colunista ainda.</p>
										<p className="mt-1 text-muted-foreground text-sm">
											O bloco de colunistas só aparece na home quando houver
											pelo menos um no ar.
										</p>
									</TableCell>
								</TableRow>
							) : (
								list.map((columnist) => (
									<SortableRow
										key={columnist.id}
										id={columnist.id}
										label={columnist.name}
									>
										{(handle) => (
											<>
												<TableCell>{handle}</TableCell>
												<TableCell>
													<span className="flex items-center gap-3">
														{(() => {
															const photo = columnist.photoMediaId
																? photoById.get(columnist.photoMediaId)
																: undefined;
															return photo ? (
																<AssetImage
																	src={photo.url}
																	alt=""
																	className="size-9 shrink-0 rounded-md border object-cover"
																	style={{
																		objectPosition: `${(photo.focalPoint?.x ?? 0.5) * 100}% ${(photo.focalPoint?.y ?? 0.5) * 100}%`,
																	}}
																/>
															) : (
																<span
																	aria-hidden
																	className="flex size-9 shrink-0 items-center justify-center rounded-md border border-dashed text-muted-foreground"
																>
																	<ImageIcon className="size-4" />
																</span>
															);
														})()}
														<span className="min-w-0">
															<span className="block font-medium">
																{columnist.name}
															</span>
															{/* O endereço é o que amarra o perfil às matérias —
												    vale mostrar, para a redação conferir a assinatura. */}
															<span className="block font-mono text-muted-foreground text-xs">
																/autor/{columnist.slug}
															</span>
														</span>
													</span>
												</TableCell>
												<TableCell className="text-muted-foreground">
													{columnist.beat || "—"}
												</TableCell>
												<TableCell>
													<Switch
														checked={columnist.active}
														aria-label={`${columnist.active ? "Tirar" : "Pôr"} ${columnist.name} no ar`}
														onCheckedChange={(active) =>
															setActive.mutate({ id: columnist.id, active })
														}
													/>
												</TableCell>
												<TableCell>
													<div className="flex justify-end">
														<Button
															variant="ghost"
															size="icon"
															aria-label={`Editar ${columnist.name}`}
															onClick={() => openEdit(columnist)}
														>
															<Pencil className="size-4" />
														</Button>
														<Button
															variant="ghost"
															size="icon"
															aria-label={`Excluir ${columnist.name}`}
															onClick={() => setConfirming(columnist.id)}
														>
															<Trash2 className="size-4 text-destructive" />
														</Button>
													</div>
												</TableCell>
											</>
										)}
									</SortableRow>
								))
							)}
						</TableBody>
					</Table>
				</SortableRows>
			</div>

			<Dialog
				open={editing !== null}
				onOpenChange={(open) => !open && setEditing(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Editar {editing?.name}</DialogTitle>
						<DialogDescription>
							O endereço{" "}
							<span className="font-mono">/autor/{editing?.slug}</span> não
							muda: ele já está indexado e é o que liga o perfil às matérias
							assinadas.
						</DialogDescription>
					</DialogHeader>
					<ColumnistForm form={form} onChange={setForm} onSubmit={submitEdit}>
						<Button type="submit" disabled={update.isPending}>
							Salvar
						</Button>
					</ColumnistForm>
				</DialogContent>
			</Dialog>

			<AlertDialog
				open={confirming !== null}
				onOpenChange={(open) => !open && setConfirming(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Excluir “{target?.name}”?</AlertDialogTitle>
						<AlertDialogDescription>
							Sai do bloco da home e perde foto, coluna e descrição. As matérias
							assinadas continuam no ar, e a página do autor também — ela vem
							das matérias, não daqui. Para só dar uma pausa, use a chave “No
							ar”.
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
		</div>
	);
}

function ColumnistForm({
	form,
	onChange,
	onSubmit,
	slug,
	slugTaken,
	children,
}: {
	form: FormState;
	onChange: (form: FormState) => void;
	onSubmit: (event: React.FormEvent) => void;
	/** Só na criação: depois de criado o endereço não muda. */
	slug?: string | null;
	slugTaken?: boolean;
	children: React.ReactNode;
}) {
	const nameId = useId();
	const beatId = useId();
	const blurbId = useId();

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={nameId}>Nome</Label>
				<Input
					id={nameId}
					required
					value={form.name}
					onChange={(event) => onChange({ ...form, name: event.target.value })}
				/>
				{slug !== undefined ? (
					<p className="text-muted-foreground text-xs">
						{slug === null ? (
							"Digite um nome para gerar o endereço."
						) : slugTaken ? (
							<span className="text-destructive">
								Já existe um colunista em /autor/{slug}.
							</span>
						) : (
							<>
								Endereço: <span className="font-mono">/autor/{slug}</span>
							</>
						)}
					</p>
				) : null}
			</div>

			<div className="flex flex-col gap-1.5">
				<Label htmlFor={beatId}>Coluna</Label>
				<Input
					id={beatId}
					value={form.beat}
					placeholder="Bastidores da Política"
					onChange={(event) => onChange({ ...form, beat: event.target.value })}
				/>
				<p className="text-muted-foreground text-xs">
					O nome da coluna, se houver. Aparece acima da descrição, no cartão da
					home.
				</p>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label htmlFor={blurbId}>Descrição</Label>
				<Textarea
					id={blurbId}
					rows={2}
					value={form.blurb}
					placeholder="Análise semanal do jogo político no estado."
					onChange={(event) => onChange({ ...form, blurb: event.target.value })}
				/>
			</div>

			<div className="flex flex-col gap-1.5">
				<Label>Foto</Label>
				{/* Quadrada: é retrato de pessoa, e é assim que o cartão da home a
				    recorta. Um preview 16:9 aqui prometeria um enquadramento que o
				    portal não usa. */}
				<ImageField
					mediaId={form.photoMediaId}
					onChange={(photoMediaId) => onChange({ ...form, photoMediaId })}
					pickerTitle="Escolher a foto do colunista"
					aspect="square"
					hint="Sem foto, o cartão da home mostra o espaço reservado."
				/>
			</div>

			<DialogFooter>{children}</DialogFooter>
		</form>
	);
}
