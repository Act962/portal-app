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
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useId, useState } from "react";
import { toast } from "sonner";

import { trpc } from "@/utils/trpc";

const DAY_LABELS = [
	"Domingo",
	"Segunda",
	"Terça",
	"Quarta",
	"Quinta",
	"Sexta",
	"Sábado",
] as const;

type ProgramDto = {
	id: string;
	name: string;
	host: string;
	dayOfWeek: number;
	startTime: string;
	endTime: string;
	order: number;
};

type FormState = {
	name: string;
	host: string;
	dayOfWeek: string;
	startTime: string;
	endTime: string;
};

const EMPTY_FORM: FormState = {
	name: "",
	host: "",
	dayOfWeek: "1",
	startTime: "",
	endTime: "",
};

export function ScheduleManager() {
	const queryClient = useQueryClient();
	const programs = useQuery(trpc.broadcast.list.queryOptions());
	const [creating, setCreating] = useState(false);
	const [editing, setEditing] = useState<ProgramDto | null>(null);
	const [confirming, setConfirming] = useState<string | null>(null);
	const [form, setForm] = useState<FormState>(EMPTY_FORM);

	const invalidate = () =>
		queryClient.invalidateQueries({ queryKey: trpc.broadcast.list.queryKey() });
	const onError = (error: { message: string }) => toast.error(error.message);

	const create = useMutation(
		trpc.broadcast.create.mutationOptions({
			onSuccess: () => {
				invalidate();
				setCreating(false);
				setForm(EMPTY_FORM);
			},
			onError,
		}),
	);
	const update = useMutation(
		trpc.broadcast.update.mutationOptions({
			onSuccess: () => {
				invalidate();
				setEditing(null);
			},
			onError,
		}),
	);
	const remove = useMutation(
		trpc.broadcast.delete.mutationOptions({
			onSuccess: () => {
				invalidate();
				toast.success("Programa excluído.");
			},
			onError,
		}),
	);

	const list = programs.data ?? [];
	const target = list.find((p) => p.id === confirming);

	const openEdit = (program: ProgramDto) => {
		setForm({
			name: program.name,
			host: program.host,
			dayOfWeek: String(program.dayOfWeek),
			startTime: program.startTime,
			endTime: program.endTime,
		});
		setEditing(program);
	};

	const submitCreate = (event: React.FormEvent) => {
		event.preventDefault();
		create.mutate({
			name: form.name.trim(),
			host: form.host.trim(),
			dayOfWeek: Number(form.dayOfWeek),
			startTime: form.startTime,
			endTime: form.endTime,
		});
	};

	const submitEdit = (event: React.FormEvent) => {
		event.preventDefault();
		if (!editing) return;
		update.mutate({
			id: editing.id,
			name: form.name.trim(),
			host: form.host.trim(),
			dayOfWeek: Number(form.dayOfWeek),
			startTime: form.startTime,
			endTime: form.endTime,
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
						Novo programa
					</DialogTrigger>
				</div>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Novo programa</DialogTitle>
						<DialogDescription>
							Um horário fixo, toda semana no mesmo dia — sem exceção pontual
							por enquanto.
						</DialogDescription>
					</DialogHeader>
					<ProgramForm form={form} onChange={setForm} onSubmit={submitCreate}>
						<Button type="submit" disabled={create.isPending}>
							Criar
						</Button>
					</ProgramForm>
				</DialogContent>
			</Dialog>

			<div className="rounded-lg border">
				<Table>
					<TableHeader>
						<TableRow>
							<TableHead className="w-28">Dia</TableHead>
							<TableHead className="w-32">Horário</TableHead>
							<TableHead>Programa</TableHead>
							<TableHead>Locutor</TableHead>
							<TableHead className="w-20" />
						</TableRow>
					</TableHeader>
					<TableBody>
						{programs.isLoading ? (
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
									<p className="font-medium">Nenhum programa ainda.</p>
									<p className="mt-1 text-muted-foreground text-sm">
										A grade aparece no portal assim que houver programas
										cadastrados.
									</p>
								</TableCell>
							</TableRow>
						) : (
							list.map((program) => (
								<TableRow key={program.id}>
									<TableCell>{DAY_LABELS[program.dayOfWeek]}</TableCell>
									<TableCell className="font-mono text-sm">
										{program.startTime}–{program.endTime}
									</TableCell>
									<TableCell className="font-medium">{program.name}</TableCell>
									<TableCell className="text-muted-foreground">
										{program.host}
									</TableCell>
									<TableCell>
										<div className="flex justify-end">
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Editar ${program.name}`}
												onClick={() => openEdit(program)}
											>
												<Pencil className="size-4" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												aria-label={`Excluir ${program.name}`}
												onClick={() => setConfirming(program.id)}
											>
												<Trash2 className="size-4 text-destructive" />
											</Button>
										</div>
									</TableCell>
								</TableRow>
							))
						)}
					</TableBody>
				</Table>
			</div>

			<Dialog
				open={editing !== null}
				onOpenChange={(open) => !open && setEditing(null)}
			>
				<DialogContent>
					<DialogHeader>
						<DialogTitle>Editar {editing?.name}</DialogTitle>
					</DialogHeader>
					<ProgramForm form={form} onChange={setForm} onSubmit={submitEdit}>
						<Button type="submit" disabled={update.isPending}>
							Salvar
						</Button>
					</ProgramForm>
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
							O programa sai da grade do portal imediatamente.
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

function ProgramForm({
	form,
	onChange,
	onSubmit,
	children,
}: {
	form: FormState;
	onChange: (form: FormState) => void;
	onSubmit: (event: React.FormEvent) => void;
	children: React.ReactNode;
}) {
	const nameId = useId();
	const hostId = useId();
	const startId = useId();
	const endId = useId();

	return (
		<form className="flex flex-col gap-3" onSubmit={onSubmit}>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={nameId}>Nome do programa</Label>
				<Input
					id={nameId}
					required
					value={form.name}
					onChange={(event) => onChange({ ...form, name: event.target.value })}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label htmlFor={hostId}>Locutor</Label>
				<Input
					id={hostId}
					required
					value={form.host}
					onChange={(event) => onChange({ ...form, host: event.target.value })}
				/>
			</div>
			<div className="flex flex-col gap-1.5">
				<Label>Dia da semana</Label>
				<Select
					items={DAY_LABELS.map((label, day) => ({
						value: String(day),
						label,
					}))}
					value={form.dayOfWeek}
					onValueChange={(value) =>
						value && onChange({ ...form, dayOfWeek: value })
					}
				>
					<SelectTrigger>
						<SelectValue />
					</SelectTrigger>
					<SelectContent>
						{DAY_LABELS.map((label, day) => (
							<SelectItem key={label} value={String(day)}>
								{label}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
			</div>
			<div className="grid grid-cols-2 gap-3">
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={startId}>Início</Label>
					<Input
						id={startId}
						type="time"
						required
						value={form.startTime}
						onChange={(event) =>
							onChange({ ...form, startTime: event.target.value })
						}
					/>
				</div>
				<div className="flex flex-col gap-1.5">
					<Label htmlFor={endId}>Término</Label>
					<Input
						id={endId}
						type="time"
						required
						value={form.endTime}
						onChange={(event) =>
							onChange({ ...form, endTime: event.target.value })
						}
					/>
				</div>
			</div>
			<DialogFooter>{children}</DialogFooter>
		</form>
	);
}
