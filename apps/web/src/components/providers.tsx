"use client";

import { Toaster } from "@portal-app/ui/components/sonner";
import { QueryClientProvider } from "@tanstack/react-query";
import { ReactQueryDevtools } from "@tanstack/react-query-devtools";

import { queryClient } from "@/utils/trpc";

import { ThemeProvider } from "./theme-provider";

export default function Providers({ children }: { children: React.ReactNode }) {
	return (
		// Só o painel tem tema: o portal público é sempre claro e nem carrega o
		// next-themes — os providers vivem apenas no grupo `(app)`. A chave de
		// armazenamento é própria para não colidir com nada do portal.
		<ThemeProvider
			attribute="class"
			defaultTheme="system"
			enableSystem
			storageKey="portal-admin-theme"
			disableTransitionOnChange
		>
			<QueryClientProvider client={queryClient}>
				{children}
				<ReactQueryDevtools />
			</QueryClientProvider>
			<Toaster richColors />
		</ThemeProvider>
	);
}
