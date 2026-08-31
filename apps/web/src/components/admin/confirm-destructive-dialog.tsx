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
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { useEffect, useId, useState } from "react";

import {
	DELETE_CONFIRMATION,
	isDeleteConfirmed,
} from "@/lib/article-selection";

/**
 * A confirmação das ações que não têm desfazer.
 *
 * Uma só para arquivar e para apagar, e uma só para a lista e para a tela da
 * matéria. Já foram quatro confirmações escritas em quatro lugares, e o
 * resultado previsível é o que aconteceu antes aqui: uma delas prometendo um
 * "dá para republicar depois" que o domínio não cumpre. Consequência é texto de
 * contrato — precisa ter uma versão só.
 *
 * O `requireTyping` é o degrau de cima: além de clicar, escrever a palavra.
 * QUANDO exigi-lo não se decide aqui — decide em `requiresTypedConfirmation`,
 * que é testado; este componente só obedece.
 */
export function ConfirmDestructiveDialog({
	open,
	onOpenChange,
	title,
	description,
	notice,
	confirmLabel,
	requireTyping = false,
	pending = false,
	onConfirm,
}: {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	title: string;
	description: string;
	/** Aviso extra — o que ficou de fora da seleção, por exemplo. */
	notice?: string | null;
	confirmLabel: string;
	requireTyping?: boolean;
	pending?: boolean;
	onConfirm: () => void;
}) {
	const [typed, setTyped] = useState("");
	const inputId = useId();

	// Zera a cada abertura. Sem isto, uma confirmação feita agora deixaria a
	// palavra escrita na próxima — que abriria já destravada, e a trava que só
	// vale na primeira vez não é trava.
	useEffect(() => {
		if (open) {
			setTyped("");
		}
	}, [open]);

	const confirmed = !requireTyping || isDeleteConfirmed(typed);

	const confirm = () => {
		if (!confirmed || pending) {
			return;
		}
		onConfirm();
	};

	return (
		<AlertDialog open={open} onOpenChange={onOpenChange}>
			<AlertDialogContent>
				<AlertDialogHeader>
					<AlertDialogTitle>{title}</AlertDialogTitle>
					<AlertDialogDescription>{description}</AlertDialogDescription>
				</AlertDialogHeader>

				{notice ? (
					<p className="rounded-md border bg-muted/50 px-3 py-2 text-sm">
						{notice}
					</p>
				) : null}

				{requireTyping ? (
					<div className="grid gap-1.5">
						<Label htmlFor={inputId} className="text-sm">
							Digite <strong>{DELETE_CONFIRMATION}</strong> para confirmar
						</Label>
						<Input
							id={inputId}
							value={typed}
							onChange={(event) => setTyped(event.target.value)}
							// A palavra é a trava; o preenchimento automático do navegador
							// e a correção do celular só atrapalhariam quem está digitando
							// exatamente o que se pediu.
							autoComplete="off"
							autoCorrect="off"
							autoCapitalize="characters"
							spellCheck={false}
							placeholder={DELETE_CONFIRMATION}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									confirm();
								}
							}}
						/>
					</div>
				) : null}

				<AlertDialogFooter>
					<AlertDialogCancel>Cancelar</AlertDialogCancel>
					{/* `destructive` porque a ação não volta — o botão precisa parecer o
					    que faz, e não um "OK" qualquer. */}
					<AlertDialogAction
						variant="destructive"
						disabled={!confirmed || pending}
						onClick={confirm}
					>
						{confirmLabel}
					</AlertDialogAction>
				</AlertDialogFooter>
			</AlertDialogContent>
		</AlertDialog>
	);
}
