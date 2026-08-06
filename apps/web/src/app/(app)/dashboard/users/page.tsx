import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@portal-app/ui/components/tabs";

import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/require-staff";

import { InvitationsPanel } from "./invitations-panel";
import { PermissionMatrix } from "./permission-matrix";
import { UsersTable } from "./users-table";

export default async function UsersPage() {
	// Só quem pode gerenciar usuários (ADMIN, pela matriz) entra aqui.
	await requireStaff("user:manage");

	return (
		<>
			<PageHeader
				title="Equipe"
				description="Quem tem acesso ao painel e o que cada papel pode fazer."
			/>

			<Tabs defaultValue="pessoas">
				<TabsList className="mb-4">
					<TabsTrigger value="pessoas">Pessoas</TabsTrigger>
					<TabsTrigger value="convites">Convites</TabsTrigger>
					<TabsTrigger value="permissoes">O que cada papel faz</TabsTrigger>
				</TabsList>
				<TabsContent value="pessoas">
					<UsersTable />
				</TabsContent>
				<TabsContent value="convites">
					<InvitationsPanel />
				</TabsContent>
				<TabsContent value="permissoes">
					<PermissionMatrix />
				</TabsContent>
			</Tabs>
		</>
	);
}
