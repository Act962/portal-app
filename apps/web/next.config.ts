import "@portal-app/env/web";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	typedRoutes: true,
	reactCompiler: true,
	/*
	 * O desenhista dos padrões de arte (spec 10, D1) roda no servidor com o
	 * Konva sobre o skia-canvas, um binário nativo. Empacotado, o skia perde o
	 * caminho do próprio `.node`; e o Konva precisa ser UMA instância só, a
	 * mesma que o backend do skia configura — carregados do `node_modules`, os
	 * dois funcionam como no teste.
	 */
	serverExternalPackages: ["skia-canvas", "konva"],
	/*
	 * As fontes dos padrões são achadas no disco em tempo de execução
	 * (`findInNodeModules`), e o rastreador de arquivos do build não enxerga
	 * isso — sem esta lista, o deploy sairia sem os `.woff` e toda arte com
	 * texto quebraria em produção.
	 */
	outputFileTracingIncludes: {
		"/*": ["./node_modules/@fontsource/*/files/*-latin-*.woff"],
	},
};

export default nextConfig;
