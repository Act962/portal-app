-- Spec 12: vídeo dentro do padrão de arte, para o Reels e os Stories.
--
-- As duas colunas nascem vazias e assim ficam no que já existe: post gravado
-- antes desta spec é post de foto, e arquivo enviado antes dela não é vídeo.
-- Nenhum backfill, portanto — a ausência já quer dizer a coisa certa.

-- O vídeo do post e o corte feito nele: arquivo, duração dele, começo, fim e som.
ALTER TABLE "social_post" ADD COLUMN "video" JSONB NOT NULL DEFAULT '{}';

-- Duração do arquivo em segundos; só vídeo e áudio a têm. Medida no navegador.
ALTER TABLE "media_asset" ADD COLUMN "durationSeconds" DOUBLE PRECISION;
