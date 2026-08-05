"use client";

import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@portal-app/ui/components/card";
import { Radio } from "lucide-react";
import { useState } from "react";

import SignInForm from "@/components/sign-in-form";
import SignUpForm from "@/components/sign-up-form";
import { siteConfig } from "@/config/site";

/**
 * Entrada do painel. O padrão é ENTRAR — o cadastro é a exceção, não a regra
 * (antes esta tela abria no formulário de criação de conta).
 */
export default function LoginPage() {
	const [mode, setMode] = useState<"entrar" | "criar">("entrar");

	return (
		<div className="flex min-h-svh items-center justify-center bg-muted/30 p-4">
			<div className="w-full max-w-sm">
				<div className="mb-6 flex flex-col items-center gap-2 text-center">
					<div className="flex size-11 items-center justify-center rounded-xl bg-brand-red text-white">
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
							{mode === "entrar"
								? "Use o e-mail e a senha da redação."
								: "Preencha os dados para ter acesso ao painel."}
						</CardDescription>
					</CardHeader>
					<CardContent>
						{mode === "entrar" ? (
							<SignInForm onSwitchToSignUp={() => setMode("criar")} />
						) : (
							<SignUpForm onSwitchToSignIn={() => setMode("entrar")} />
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
