"use client";

import { Button } from "@portal-app/ui/components/button";
import { Calendar } from "@portal-app/ui/components/calendar";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@portal-app/ui/components/popover";
import { cn } from "@portal-app/ui/lib/utils";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import * as React from "react";

/**
 * Seletores de data sobre o `Calendar` do shadcn (react-day-picker), no lugar dos
 * `<input type="date">` / `type="datetime-local"` nativos — que cada navegador
 * desenha do seu jeito e ignoram o tema e o pt-BR do painel.
 *
 * São **drop-in**: falam a MESMA string que os inputs nativos falavam
 * (`YYYY-MM-DD` para data, `YYYY-MM-DDTHH:mm` para data+hora), então a lógica de
 * fuso de quem os usa (a "meia-noite local" das campanhas, o `new Date(at)` do
 * agendamento) continua valendo sem tocar em nada. `parseISO`/`format` sem `Z`
 * trabalham no fuso local, igual ao input nativo.
 */

/** Faixa dos menus de mês/ano — ±5 anos em volta de hoje, chega para pauta e campanha. */
function captionRange(): { startMonth: Date; endMonth: Date } {
	const year = new Date().getFullYear();
	return {
		startMonth: new Date(year - 5, 0),
		endMonth: new Date(year + 5, 11),
	};
}

/** Lê a string do input nativo como Date local; string vazia → indefinido. */
function toDate(value: string): Date | undefined {
	if (!value) {
		return undefined;
	}
	const parsed = parseISO(value);
	return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

type DatePickerProps = {
	/** `YYYY-MM-DD`, como o `<input type="date">`. */
	value: string;
	onChange: (value: string) => void;
	id?: string;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
	/** Bloqueia dias anteriores a esta data (ex.: hoje, para não agendar no passado). */
	minDate?: Date;
};

/** Substitui o `<input type="date">`: um botão que abre o calendário. */
export function DatePicker({
	value,
	onChange,
	id,
	disabled,
	placeholder = "Escolha a data",
	className,
	minDate,
}: DatePickerProps) {
	const [open, setOpen] = React.useState(false);
	const date = toDate(value);

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						id={id}
						variant="outline"
						disabled={disabled}
						className={cn(
							"w-full justify-start text-left font-normal",
							!date && "text-muted-foreground",
							className,
						)}
					/>
				}
			>
				<CalendarIcon className="size-4" />
				{date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={date}
					defaultMonth={date}
					captionLayout="dropdown"
					locale={ptBR}
					autoFocus
					disabled={minDate ? { before: minDate } : undefined}
					{...captionRange()}
					onSelect={(next) => {
						onChange(next ? format(next, "yyyy-MM-dd") : "");
						setOpen(false);
					}}
				/>
			</PopoverContent>
		</Popover>
	);
}

type DateTimePickerProps = {
	/** `YYYY-MM-DDTHH:mm`, como o `<input type="datetime-local">`. */
	value: string;
	onChange: (value: string) => void;
	id?: string;
	disabled?: boolean;
	placeholder?: string;
	className?: string;
	minDate?: Date;
};

/**
 * Substitui o `<input type="datetime-local">`: o calendário escolhe o dia e um
 * campo de hora ao lado escolhe a hora — o mesmo arranjo do date-time picker do
 * shadcn. Emite `YYYY-MM-DDTHH:mm`, sem fuso, como o nativo.
 */
export function DateTimePicker({
	value,
	onChange,
	id,
	disabled,
	placeholder = "Escolha data e hora",
	className,
	minDate,
}: DateTimePickerProps) {
	const [open, setOpen] = React.useState(false);
	const date = toDate(value);
	const timeValue = date ? format(date, "HH:mm") : "";

	/** Junta o dia escolhido com a hora que já estava (ou a de agora, na 1ª vez). */
	const emitWithDay = (day: Date | undefined) => {
		if (!day) {
			onChange("");
			return;
		}
		const base = date ?? new Date();
		const next = new Date(day);
		next.setHours(base.getHours(), base.getMinutes(), 0, 0);
		onChange(format(next, "yyyy-MM-dd'T'HH:mm"));
	};

	/** Aplica `HH:mm` ao dia escolhido (ou a hoje, se ainda não há dia). */
	const emitWithTime = (time: string) => {
		if (!time) {
			return;
		}
		const [hours, minutes] = time.split(":").map(Number);
		const next = date ? new Date(date) : new Date();
		next.setHours(hours ?? 0, minutes ?? 0, 0, 0);
		onChange(format(next, "yyyy-MM-dd'T'HH:mm"));
	};

	return (
		<Popover open={open} onOpenChange={setOpen}>
			<PopoverTrigger
				render={
					<Button
						id={id}
						variant="outline"
						disabled={disabled}
						className={cn(
							"w-full justify-start text-left font-normal",
							!date && "text-muted-foreground",
							className,
						)}
					/>
				}
			>
				<CalendarIcon className="size-4" />
				{date
					? format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })
					: placeholder}
			</PopoverTrigger>
			<PopoverContent className="w-auto p-0" align="start">
				<Calendar
					mode="single"
					selected={date}
					defaultMonth={date}
					captionLayout="dropdown"
					locale={ptBR}
					autoFocus
					disabled={minDate ? { before: minDate } : undefined}
					{...captionRange()}
					onSelect={emitWithDay}
				/>
				<div className="flex items-center gap-2 border-t p-3">
					<Label htmlFor={`${id ?? "datetime"}-time`}>Hora</Label>
					<Input
						id={`${id ?? "datetime"}-time`}
						type="time"
						value={timeValue}
						disabled={disabled}
						className="w-32"
						onChange={(event) => emitWithTime(event.target.value)}
					/>
				</div>
			</PopoverContent>
		</Popover>
	);
}
