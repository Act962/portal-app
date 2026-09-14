-- Spec 10, D5: os padrões e as artes do modelo antigo (camadas) eram de teste e
-- são descartados — decisão do cliente em 14/09/2026. As imagens já publicadas
-- continuam no armazenamento; some só a cópia do desenho guardada no post.
DELETE FROM "social_art_template";
UPDATE "social_post" SET "art" = '{}';

-- O desenho novo (fundo, elementos e variáveis) numa coluna só.
ALTER TABLE "social_art_template" DROP COLUMN "layers",
ADD COLUMN "design" JSONB NOT NULL DEFAULT '{}';
