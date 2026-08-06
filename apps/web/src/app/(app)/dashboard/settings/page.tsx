import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/require-staff";

import { SettingsForm } from "./settings-form";

export default async function SettingsPage() {
	// Só quem administra o veículo. A barreira que vale é a do router
	// (`requirePermission("settings:manage")` no `settings.update`); esta existe
	// para não renderizar uma tela que o papel não pode usar.
	await requireStaff("settings:manage");

	return (
		<>
			<PageHeader
				title="Configurações do site"
				description="A identidade do portal: nome, contatos, redes e rádio. O que você salvar aqui aparece no site em até um minuto."
			/>
			<SettingsForm />
		</>
	);
}
