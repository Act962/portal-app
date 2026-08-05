import Providers from "@/components/providers";

/**
 * Área autenticada (painel e login).
 *
 * Deliberadamente separada do `(site)`: o portal e as ferramentas da redação têm
 * chrome, público e orçamento de performance diferentes.
 *
 * Aqui só moram os providers — React Query, tema e toaster — porque só esta área
 * os usa; o portal público é todo renderizado no servidor e não embarca nada
 * disso. A casca visual do painel (sidebar, topbar) fica em `dashboard/layout`,
 * já que o `/login` também vive neste grupo e não deve tê-la.
 */
export default function AppLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	return <Providers>{children}</Providers>;
}
