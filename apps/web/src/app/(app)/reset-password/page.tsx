import { Button } from "@portal-app/ui/components/button";
import {
	Card,
	CardContent,
	CardDescription,
	CardHeader,
	CardTitle,
} from "@portal-app/ui/components/card";
import { Radio } from "lucide-react";
import Link from "next/link";
import { ResetPasswordForm } from "@/components/reset-password-form";
import { siteConfig } from "@/config/site";

export default async function ResetPasswordPage({
	searchParams,
}: {
	searchParams: Promise<{ token?: string; error?: string }>;
}) {
	const { token, error } = await searchParams;

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
						<CardTitle>Redefinir senha</CardTitle>
						<CardDescription>Escolha a nova senha de acesso.</CardDescription>
					</CardHeader>
					<CardContent>
						{token && !error ? (
							<ResetPasswordForm token={token} />
						) : (
							<div className="flex flex-col gap-3">
								<p className="text-muted-foreground text-sm">
									Este link é inválido ou já expirou. Peça a um administrador da
									redação para gerar um novo.
								</p>
								<Button variant="outline" render={<Link href="/login" />}>
									Voltar para o login
								</Button>
							</div>
						)}
					</CardContent>
				</Card>
			</div>
		</div>
	);
}
