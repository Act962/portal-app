import { Button } from "@portal-app/ui/components/button";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

import { ForgotPasswordDialog } from "./forgot-password-dialog";
import Loader from "./loader";

export default function SignInForm({
	onSwitchToSignUp,
}: {
	onSwitchToSignUp: () => void;
}) {
	const router = useRouter();
	const { isPending } = authClient.useSession();

	const form = useForm({
		defaultValues: { email: "", password: "" },
		onSubmit: async ({ value }) => {
			await authClient.signIn.email(
				{ email: value.email, password: value.password },
				{
					onSuccess: () => {
						router.push("/dashboard");
					},
					onError: (error) => {
						toast.error(error.error.message || error.error.statusText);
					},
				},
			);
		},
		validators: {
			onSubmit: z.object({
				email: z.email("Informe um e-mail válido"),
				password: z.string().min(8, "A senha tem no mínimo 8 caracteres"),
			}),
		},
	});

	if (isPending) {
		return <Loader />;
	}

	return (
		<>
			<form
				onSubmit={(e) => {
					e.preventDefault();
					e.stopPropagation();
					form.handleSubmit();
				}}
				className="flex flex-col gap-4"
			>
				<form.Field name="email">
					{(field) => (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor={field.name}>E-mail</Label>
							<Input
								id={field.name}
								name={field.name}
								type="email"
								autoComplete="email"
								placeholder="voce@fm7cidades.com"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
							{field.state.meta.errors.map((error) => (
								<p key={error?.message} className="text-destructive text-sm">
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Field name="password">
					{(field) => (
						<div className="flex flex-col gap-1.5">
							<Label htmlFor={field.name}>Senha</Label>
							<Input
								id={field.name}
								name={field.name}
								type="password"
								autoComplete="current-password"
								value={field.state.value}
								onBlur={field.handleBlur}
								onChange={(e) => field.handleChange(e.target.value)}
							/>
							{field.state.meta.errors.map((error) => (
								<p key={error?.message} className="text-destructive text-sm">
									{error?.message}
								</p>
							))}
						</div>
					)}
				</form.Field>

				<form.Subscribe
					selector={(state) => ({
						canSubmit: state.canSubmit,
						isSubmitting: state.isSubmitting,
					})}
				>
					{({ canSubmit, isSubmitting }) => (
						<Button
							type="submit"
							className="mt-1 w-full"
							disabled={!canSubmit || isSubmitting}
						>
							{isSubmitting ? "Entrando…" : "Entrar"}
						</Button>
					)}
				</form.Subscribe>
			</form>

			<ForgotPasswordDialog />

			<p className="mt-4 text-center text-muted-foreground text-sm">
				Ainda não tem acesso?{" "}
				<Button variant="link" className="px-1" onClick={onSwitchToSignUp}>
					Criar conta
				</Button>
			</p>
		</>
	);
}
