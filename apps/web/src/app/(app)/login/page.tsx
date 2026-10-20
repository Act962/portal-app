"use client";

import { Button } from "@portal-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@portal-app/ui/components/card";
import { useQuery } from "@tanstack/react-query";
import { Radio } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { siteConfig } from "@/config/site";
import { trpc } from "@/utils/trpc";

/**
 * Entrada do painel. O padrão é ENTRAR — o cadastro é a exceção, não a regra
 * (antes esta tela abria no formulário de criação de conta).
 */
function LoginContent() {
	const searchParams = useSearchParams();
	const invitationToken = searchParams.get("invite") ?? undefined;
	const invitation = useQuery({
		...trpc.identity.invitations.preview.queryOptions({
			id: invitationToken ?? "",
		}),
		enabled: Boolean(invitationToken),
		retry: false,
	});
	const [mode, setMode] = useState<"entrar" | "criar">(
		invitationToken || searchParams.get("modo") === "criar"
			? "criar"
			: "entrar",
	);

	return (
		<div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
			<div className="w-full max-w-sm">
				<div className="mb-6 flex flex-col items-center gap-2 text-center">
					<div className="flex size-11 items-center justify-center rounded-xl bg-brand-accent text-on-accent">
						<Radio className="size-5" />
					</div>
					<h1 className="font-semibold text-xl">{siteConfig.name}</h1>
					<p className="text-muted-foreground text-sm">Painel da redação</p>
				</div>

				<Card>
					<CardHeader>
						<CardTitle>
							{mode === "entrar" ? "Entrar" : "Criar conta"}
						</CardTitle>
						<CardDescription>
							{invitation.isError
								? invitation.error.message
								: mode === "entrar"
									? "Use o e-mail e a senha da redação."
									: "Preencha os dados para ter acesso ao painel."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{mode === "entrar" ? (
							<SignInForm onSwitchToSignUp={() => setMode("criar")} />
						) : invitationToken && invitation.isPending ? (
							<p className="py-4 text-center text-muted-foreground text-sm">
								Validando convite…
							</p>
						) : invitationToken && invitation.isError ? (
							<Button
								type="button"
								variant="link"
								className="w-full"
								onClick={() => setMode("entrar")}
							>
								Voltar para entrar
							</Button>
						) : (
							<SignUpForm
								key={invitation.data?.email ?? invitationToken ?? "signup"}
								onSwitchToSignIn={() => setMode("entrar")}
								invitationToken={invitationToken}
								invitedEmail={invitation.data?.email}
							/>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}

export default function LoginPage() {
	return (
		<Suspense>
			<LoginContent />
		</Suspense>
	);
}
