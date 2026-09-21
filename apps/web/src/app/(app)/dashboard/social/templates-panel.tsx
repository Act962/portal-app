"use client";

import {
	ART_FORMATS,
	type ArtDesign,
	type ArtFormat,
	DESTINATION_LABEL,
	formatServes,
	SAMPLE_CONTENT,
	SOCIAL_DESTINATIONS,
	type SocialDestination,
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
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@portal-app/ui/components/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@portal-app/ui/components/select";
import { Skeleton } from "@portal-app/ui/components/skeleton";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Archive, Copy, Pencil, Plus, Star } from "lucide-react";
import type { Route } from "next";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState } from "react";
import { toast } from "sonner";

import { ArtCanvas } from "@/components/art/art-canvas";
import { trpc } from "@/utils/trpc";

const FORMAT_OPTIONS = [
	{ value: "4:5", label: "4:5 — retrato (feed)" },
	{ value: "1:1", label: "1:1 — quadrado (feed)" },
	{ value: "9:16", label: "9:16 — tela cheia (Stories e Reels)" },
] satisfies { value: ArtFormat; label: string }[];

const editorRoute = (id: string) => `/dashboard/social/padroes/${id}` as Route;

/**
 * Os padrões de arte (spec 09, F4): a identidade visual do veículo nas redes.
 *
 * **Cada cartão mostra a arte de verdade**, desenhada pelo servidor com um
 * título de exemplo — escolher padrão pelo nome ("Últimas — feed v2") é
 * adivinhar; pela miniatura, é reconhecer.
 */
export function TemplatesPanel({ canDesign }: { canDesign: boolean }) {
	const queryClient = useQueryClient();
	const router = useRouter();
	const [creating, setCreating] = useState(false);
	const [archiving, setArchiving] = useState<{
		id: string;
		name: string;
	} | null>(null);

	const templates = useQuery(trpc.social.templates.list.queryOptions());

	const refresh = () =>
		queryClient.invalidateQueries({
			queryKey: trpc.social.templates.list.queryKey(),
		});

	const duplicate = useMutation(
		trpc.social.templates.duplicate.mutationOptions({
			onSuccess: async (dto) => {
				toast.success(`Criado "${dto.name}".`);
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const archive = useMutation(
		trpc.social.templates.archive.mutationOptions({
			onSuccess: async (dto) => {
				toast.success(`"${dto.name}" arquivado.`);
				setArchiving(null);
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const setDefaults = useMutation(
		trpc.social.templates.setDefaults.mutationOptions({
			onSuccess: async () => {
				toast.success("Padrão de destino atualizado.");
				await refresh();
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	const items = templates.data ?? [];

	return (
		<div className="flex flex-col gap-4">
			<div className="flex flex-wrap items-center justify-between gap-2">
				<p className="max-w-2xl text-muted-foreground text-sm">
					O desenho que a notícia veste nas redes. O padrão de cada destino é
					aplicado sozinho ao post que nasce da matéria publicada.
				</p>
				{canDesign ? (
					<Button onClick={() => setCreating(true)}>
						<Plus className="size-4" />
						Novo padrão
					</Button>
				) : null}
			</div>

			{templates.isPending ? (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					<Skeleton className="h-80" />
					<Skeleton className="h-80" />
					<Skeleton className="h-80" />
				</div>
			) : items.length === 0 ? (
				<div className="rounded-lg border border-dashed p-10 text-center">
					<p className="font-medium">Nenhum padrão ainda.</p>
					<p className="mt-1 text-muted-foreground text-sm">
						{canDesign
							? "Crie o primeiro: suba a moldura do veículo como imagem e posicione o título por cima."
							: "Quem gerencia as redes cria os padrões; eles aparecem aqui para a escolha."}
					</p>
				</div>
			) : (
				<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
					{items.map((template) => (
						<article
							key={template.id}
							className="flex flex-col gap-3 rounded-lg border bg-card p-3"
						>
							<TemplateThumbnail
								name={template.name}
								format={template.format}
								design={template.design}
							/>
							<div className="flex items-start justify-between gap-2">
								<div className="min-w-0">
									<p className="truncate font-medium">{template.name}</p>
									<p className="text-muted-foreground text-xs">
										{template.format} · versão {template.version}
									</p>
								</div>
							</div>
							{template.defaultFor.length > 0 ? (
								<div className="flex flex-wrap gap-1">
									{template.defaultFor.map((destination) => (
										<Badge
											key={destination}
											variant="secondary"
											className="gap-1"
										>
											<Star className="size-3" />
											{DESTINATION_LABEL[destination]}
										</Badge>
									))}
								</div>
							) : null}

							<div className="mt-auto flex flex-wrap gap-2">
								<Button
									variant="outline"
									size="sm"
									nativeButton={false}
									render={<Link href={editorRoute(template.id)} />}
								>
									<Pencil className="size-4" />
									{canDesign ? "Editar" : "Ver"}
								</Button>
								{canDesign ? (
									<>
										<Popover>
											<PopoverTrigger
												render={<Button variant="outline" size="sm" />}
											>
												<Star className="size-4" />
												Padrão de
											</PopoverTrigger>
											<PopoverContent className="w-64 p-3">
												<div className="flex flex-col gap-2">
													{SOCIAL_DESTINATIONS.map((destination) => {
														const checked =
															template.defaultFor.includes(destination);
														const compatible = formatServes(
															template.format,
															destination,
														);
														return (
															<label
																key={destination}
																className={`flex items-center gap-2 text-sm ${compatible ? "" : "opacity-50"}`}
															>
																<input
																	type="checkbox"
																	checked={checked}
																	disabled={
																		!compatible || setDefaults.isPending
																	}
																	onChange={() =>
																		setDefaults.mutate({
																			id: template.id,
																			destinations: checked
																				? template.defaultFor.filter(
																						(item) => item !== destination,
																					)
																				: [
																						...template.defaultFor,
																						destination as SocialDestination,
																					],
																		})
																	}
																/>
																{DESTINATION_LABEL[destination]}
															</label>
														);
													})}
													<p className="text-muted-foreground text-xs">
														Marcar aqui tira a marca de quem era o padrão
														daquele destino.
													</p>
												</div>
											</PopoverContent>
										</Popover>
										<Button
											variant="ghost"
											size="sm"
											disabled={duplicate.isPending}
											onClick={() => duplicate.mutate({ id: template.id })}
										>
											<Copy className="size-4" />
											Duplicar
										</Button>
										<Button
											variant="ghost"
											size="sm"
											onClick={() =>
												setArchiving({ id: template.id, name: template.name })
											}
										>
											<Archive className="size-4" />
											Arquivar
										</Button>
									</>
								) : null}
							</div>
						</article>
					))}
				</div>
			)}

			<NewTemplateDialog
				open={creating}
				onOpenChange={setCreating}
				onCreated={async (id) => {
					await refresh();
					router.push(editorRoute(id));
				}}
			/>

			<AlertDialog
				open={archiving !== null}
				onOpenChange={(open) => !open && setArchiving(null)}
			>
				<AlertDialogContent>
					<AlertDialogHeader>
						<AlertDialogTitle>Arquivar "{archiving?.name}"?</AlertDialogTitle>
						<AlertDialogDescription>
							Ele sai da escolha e deixa de ser padrão de qualquer destino.
							Posts já aprovados continuam com o desenho que alguém aprovou.
							Para usá-lo de novo, duplique-o.
						</AlertDialogDescription>
					</AlertDialogHeader>
					<AlertDialogFooter>
						<AlertDialogCancel>Manter</AlertDialogCancel>
						<AlertDialogAction
							onClick={() => archiving && archive.mutate({ id: archiving.id })}
						>
							Arquivar
						</AlertDialogAction>
					</AlertDialogFooter>
				</AlertDialogContent>
			</AlertDialog>
		</div>
	);
}

/**
 * A miniatura é a arte de verdade, desenhada no navegador com a mesma cena do
 * servidor (spec 10, D9) e o conteúdo de exemplo.
 */
function TemplateThumbnail({
	name,
	format,
	design,
}: {
	name: string;
	format: ArtFormat;
	design: ArtDesign;
}) {
	return (
		<div className="mx-auto w-full max-w-60">
			<ArtCanvas
				format={format}
				design={design}
				content={SAMPLE_CONTENT}
				label={`Prévia do padrão ${name}`}
				className="rounded-md border"
			/>
		</div>
	);
}

function NewTemplateDialog({
	open,
	onOpenChange,
	onCreated,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (id: string) => Promise<void> | void;
}) {
	const nameId = useId();
	const [name, setName] = useState("");
	const [format, setFormat] = useState<ArtFormat>("4:5");

	const create = useMutation(
		trpc.social.templates.create.mutationOptions({
			onSuccess: async (dto) => {
				toast.success("Padrão criado. Agora monte as camadas.");
				onOpenChange(false);
				setName("");
				await onCreated(dto.id);
			},
			onError: (error) => toast.error(error.message),
		}),
	);

	return (
		<Dialog open={open} onOpenChange={onOpenChange}>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Novo padrão</DialogTitle>
					<DialogDescription>
						O formato decide para onde ele serve: 9:16 para os Stories e o Reels
						— é o formato de VÍDEO —; 4:5 e 1:1 para o feed de fotos.
					</DialogDescription>
				</DialogHeader>
				<div className="flex flex-col gap-4 py-2">
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={nameId}>Nome</Label>
						<Input
							id={nameId}
							value={name}
							placeholder="Últimas — feed"
							onChange={(event) => setName(event.target.value)}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<span className="font-medium text-sm">Formato</span>
						<Select
							items={FORMAT_OPTIONS}
							value={format}
							onValueChange={(value) =>
								value && ART_FORMATS.includes(value as ArtFormat)
									? setFormat(value as ArtFormat)
									: undefined
							}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{FORMAT_OPTIONS.map((option) => (
									<SelectItem key={option.value} value={option.value}>
										{option.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>
				</div>
				<DialogFooter>
					<Button variant="ghost" onClick={() => onOpenChange(false)}>
						Cancelar
					</Button>
					<Button
						disabled={name.trim() === "" || create.isPending}
						onClick={() => create.mutate({ name, format })}
					>
						Criar e montar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
