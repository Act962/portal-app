-- O contato do rodapé vira uma lista de linhas livres (`contactLines`).
ALTER TABLE "site_settings" ADD COLUMN "contactLines" JSONB NOT NULL DEFAULT '[]';

-- Copia o que já estava cadastrado, na mesma ordem e com os mesmos rótulos que
-- o rodapé imprimia. Campo nulo NÃO vira linha: era alguém tentando tirá-lo do
-- ar, e o portal insistia em mostrar o valor padrão no lugar.
--
-- As colunas antigas (e as duas da rádio) ficam por um deploy — a versão que
-- ainda está no ar durante o build continua lendo delas.
UPDATE "site_settings" AS s
SET "contactLines" = (
	SELECT COALESCE(jsonb_agg(t.line ORDER BY t.ord), '[]'::jsonb)
	FROM (
		VALUES
			(1, 'Redação · ' || NULLIF(btrim(s."contactNewsroom"), '')),
			(2, 'WhatsApp · ' || NULLIF(btrim(s."contactWhatsapp"), '')),
			(3, NULLIF(btrim(s."contactEmail"), '')),
			(4, NULLIF(btrim(s."contactAddress"), ''))
	) AS t(ord, line)
	WHERE t.line IS NOT NULL
);
