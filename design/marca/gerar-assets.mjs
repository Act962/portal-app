/**
 * Regera os arquivos de marca de `apps/web/public/brand/` a partir da
 * arte-mestre deste diretório.
 *
 * Roda da raiz do repositório: `node design/marca/gerar-assets.mjs`.
 * É idempotente — duas execuções produzem os mesmos bytes.
 *
 * Não é build: nada no pipeline chama este script. Ele existe para o dia em
 * que alguém precisar de outro tamanho ou trocar a arte, e é o registro
 * executável de COMO cada arquivo servido foi produzido — que é a informação
 * que se perde primeiro.
 */
import fs from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const AQUI = path.dirname(fileURLToPath(import.meta.url));
const RAIZ = path.resolve(AQUI, "../..");

// O `sharp` vem junto com o Next; resolvido pelo caminho do pnpm para o script
// funcionar de qualquer diretório.
const [dirSharp] = fs
	.readdirSync(path.join(RAIZ, "node_modules/.pnpm"))
	.filter((d) => d.startsWith("sharp@"));
const sharp = require(
	path.join(
		RAIZ,
		"node_modules/.pnpm",
		dirSharp,
		"node_modules/sharp/lib/index.js",
	),
);

const SAIDA = path.join(RAIZ, "apps/web/public/brand");
const MARROM = "#3a1f0e";
const origem = (nome) => path.join(AQUI, `${nome}.png`);

/**
 * Monta um `.ico` com cada imagem embutida como PNG.
 *
 * O contêiner aceita duas codificações por entrada: BMP cru — que exige o
 * cabeçalho DIB, linhas de baixo para cima e uma máscara AND alinhada em 4
 * bytes — ou o PNG inteiro. A segunda é lida por todo navegador desde o IE11 e
 * elimina a classe de erro mais comum deste tipo de gerador.
 */
function montarIco(imagens) {
	const cabecalho = Buffer.alloc(6);
	cabecalho.writeUInt16LE(0, 0); // reservado
	cabecalho.writeUInt16LE(1, 2); // 1 = ícone (2 seria cursor)
	cabecalho.writeUInt16LE(imagens.length, 4);

	const diretorio = Buffer.alloc(16 * imagens.length);
	let deslocamento = cabecalho.length + diretorio.length;

	imagens.forEach(({ size, buf }, i) => {
		const o = i * 16;
		// 256 vira 0: o campo tem um byte só, e é assim que o formato o expressa.
		diretorio[o] = size >= 256 ? 0 : size;
		diretorio[o + 1] = size >= 256 ? 0 : size;
		diretorio.writeUInt16LE(1, o + 4); // planos de cor
		diretorio.writeUInt16LE(32, o + 6); // bits por pixel
		diretorio.writeUInt32LE(buf.length, o + 8);
		diretorio.writeUInt32LE(deslocamento, o + 12);
		deslocamento += buf.length;
	});

	return Buffer.concat([cabecalho, diretorio, ...imagens.map((i) => i.buf)]);
}

/**
 * A arte de favicon do cliente, achatada sobre o marrom da marca.
 *
 * Ela foi desenhada para ir SOBRE fundo colorido — o miolo do "7" é vazado.
 * Sobre branco ela desaparece; sobre o marrom é a marca.
 */
const chapadaNoMarrom = (size) =>
	sharp(origem("FAVICON_portal_7_cidades"))
		.resize(size, size, {
			fit: "contain",
			background: { r: 0, g: 0, b: 0, alpha: 0 },
		})
		.flatten({ background: MARROM })
		.png({ compressionLevel: 9 })
		.toBuffer();

/** Arte transparente reduzida. `palette` corta ~85% do peso em cor chapada. */
const transparente = (nome, width) =>
	sharp(origem(nome))
		.resize({ width, withoutEnlargement: true })
		.png({ compressionLevel: 9, palette: true })
		.toBuffer();

const escrever = (nome, buf) => fs.writeFileSync(path.join(SAIDA, nome), buf);

// --- Ícones chapados: aba do navegador, manifest e tela inicial -------------
// Ícone de tela inicial NÃO pode ser transparente: Android e iOS compõem sobre
// branco ou preto por conta própria, e o "7" vazado sumiria num dos dois.
escrever(
	"favicon.ico",
	montarIco(
		await Promise.all(
			[16, 32, 48, 256].map(async (size) => ({
				size,
				buf: await chapadaNoMarrom(size),
			})),
		),
	),
);
escrever("icon-192.png", await chapadaNoMarrom(192));
escrever("icon-512.png", await chapadaNoMarrom(512));
escrever("apple-icon.png", await chapadaNoMarrom(180));

// --- Artes transparentes ---------------------------------------------------
// O símbolo do cabeçalho precisa de alfa: o masthead o pinta de branco com
// `brightness-0 invert`, e uma arte chapada viraria um quadrado branco.
escrever("symbol.png", await transparente("icon_7_cidades", 512));
escrever("logo-7-cidades.png", await transparente("logo_7_cidades", 1024));
escrever("rupestre.png", await transparente("transparence_rupestre", 900));

for (const f of fs.readdirSync(SAIDA).sort()) {
	const kb = (fs.statSync(path.join(SAIDA, f)).size / 1024).toFixed(1);
	console.log(`${f.padEnd(22)} ${kb.padStart(6)} KB`);
}
