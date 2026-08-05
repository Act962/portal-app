import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@portal-app/ui/components/tabs";

import { PageHeader } from "@/components/admin/page-header";
import { requireStaff } from "@/lib/require-staff";

import { SectionsManager } from "./sections-manager";
import { TagsManager } from "./tags-manager";

export default async function TaxonomyPage() {
	// Editorias e assuntos são geridos por quem tem taxonomy:manage (ADMIN).
	await requireStaff("taxonomy:manage");

	return (
		<>
			<PageHeader
				title="Editorias e assuntos"
				description="Como o portal se organiza. A ordem das editorias é a ordem em que elas aparecem na navegação."
			/>

			<Tabs defaultValue="editorias">
				<TabsList className="mb-4">
					<TabsTrigger value="editorias">Editorias</TabsTrigger>
					<TabsTrigger value="assuntos">Assuntos</TabsTrigger>
				</TabsList>
				<TabsContent value="editorias">
					<SectionsManager />
				</TabsContent>
				<TabsContent value="assuntos">
					<TagsManager />
				</TabsContent>
			</Tabs>
		</>
	);
}
