"use client";

import { Button } from "@portal-app/ui/components/button";
import {
	Dialog,
	DialogContent,
	DialogDescription,
	DialogHeader,
	DialogTitle,
	DialogTrigger,
} from "@portal-app/ui/components/dialog";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { useQuery } from "@tanstack/react-query";
import { useId, useState } from "react";

import { authClient } from "@/lib/auth-client";
import { trpc } from "@/utils/trpc";

/**
 * Sem Mailer configurado (Bloco 1.3), o Better Auth aceitaria o pedido e não
 * entregaria nada — pior do que não oferecer a opção. `mailerEnabled` decide
 * entre o autosserviço de verdade e a orientação para procurar um admin.
 */
export function ForgotPasswordDialog() {
	const emailId = useId();
	const [email, setEmail] = useState("");
	const [sent, setSent] = useState(false);
	const capability = useQuery(
		trpc.identity.capabilities.mailerEnabled.queryOptions(),
	);

	return (
		<Dialog
			onOpenChange={(open) => {
				if (!open) {
					setEmail("");
					setSent(false);
				}
			}}
		>
			<DialogTrigger
				render={
					<Button
						type="button"
						variant="link"
						className="mt-1 h-auto px-0 text-muted-foreground"
					/>
				}
			>
				Esqueci minha senha
			</DialogTrigger>
			<DialogContent>
				<DialogHeader>
					<DialogTitle>Esqueceu a senha?</DialogTitle>
					{capability.data ? (
						<DialogDescription>
							Informe seu e-mail — se ele estiver cadastrado, você recebe um
							link para escolher uma senha nova.
						</DialogDescription>
					) : (
						<DialogDescription>
							Fale com um administrador da redação — ele gera um link de
							redefinição para você em "Equipe", no painel.
						</DialogDescription>
					)}
				</DialogHeader>

				{capability.data && !sent ? (
					<form
						className="flex flex-col gap-3"
						onSubmit={async (event) => {
							event.preventDefault();
							await authClient.requestPasswordReset({
								email,
								redirectTo: `${window.location.origin}/reset-password`,
							});
							setSent(true);
						}}
					>
						<div className="flex flex-col gap-1.5">
							<Label htmlFor={emailId}>E-mail</Label>
							<Input
								id={emailId}
								type="email"
								required
								value={email}
								onChange={(event) => setEmail(event.target.value)}
							/>
						</div>
						<Button type="submit" disabled={!email}>
							Enviar link
						</Button>
					</form>
				) : null}

				{capability.data && sent ? (
					<p className="text-muted-foreground text-sm">
						Se esse e-mail existir, um link chega em instantes. Confira também o
						spam.
					</p>
				) : null}
			</DialogContent>
		</Dialog>
	);
}
