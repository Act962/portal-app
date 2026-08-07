"use client";

import { Button } from "@portal-app/ui/components/button";
import { Input } from "@portal-app/ui/components/input";
import { Label } from "@portal-app/ui/components/label";
import { useForm } from "@tanstack/react-form";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import z from "zod";

import { authClient } from "@/lib/auth-client";

export function ResetPasswordForm({ token }: { token: string }) {
	const router = useRouter();

	const form = useForm({
		defaultValues: { newPassword: "" },
		onSubmit: async ({ value }) => {
			const { error } = await authClient.resetPassword({
				newPassword: value.newPassword,
				token,
			});
			if (error) {
				toast.error(
					error.message ||
						"O link expirou ou já foi usado. Peça um novo a um administrador.",
				);
				return;
			}
			toast.success("Senha redefinida. Entre com a senha nova.");
			router.push("/login");
		},
		validators: {
			onSubmit: z.object({
				newPassword: z.string().min(8, "A senha tem no mínimo 8 caracteres"),
			}),
		},
	});

	return (
		<form
			onSubmit={(e) => {
				e.preventDefault();
				e.stopPropagation();
				form.handleSubmit();
			}}
			className="flex flex-col gap-4"
		>
			<form.Field name="newPassword">
				{(field) => (
					<div className="flex flex-col gap-1.5">
						<Label htmlFor={field.name}>Nova senha</Label>
						<Input
							id={field.name}
							name={field.name}
							type="password"
							autoComplete="new-password"
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
						{isSubmitting ? "Salvando…" : "Salvar nova senha"}
					</Button>
				)}
			</form.Subscribe>
		</form>
	);
}
