-- Seed mínimo para o E2E: uma editoria e uma matéria PUBLICADA, para o portal
-- (read model da Fase 4) ter conteúdo real a renderizar. Idempotente.

INSERT INTO section (id, name, slug, description, color, "order", status, "createdAt", "updatedAt")
VALUES (gen_random_uuid()::text, 'Cidades', 'cidades', 'O dia a dia dos municipios.', NULL, 0, 'ATIVA', now(), now())
ON CONFLICT (slug) DO NOTHING;

INSERT INTO article (
  id, headline, slug, kicker, standfirst, body,
  "authorId", "authorName", "sectionId", "tagIds",
  status, "publishedAt", "firstPublishedAt", "createdAt", "updatedAt"
)
SELECT
  gen_random_uuid()::text,
  'Pacote de obras para o norte do Piauí',
  'pacote-de-obras-para-o-norte-do-piaui',
  'INFRAESTRUTURA',
  'Governo anuncia investimento em estradas e saneamento para a regiao.',
  '[{"type":"paragraph","text":"O anuncio foi feito nesta terca-feira em cerimonia na capital."},{"type":"heading","level":2,"text":"O que muda"},{"type":"paragraph","text":"As obras devem comecar no proximo trimestre."}]'::jsonb,
  'seed-autor', 'Redacao', s.id, '{}',
  'PUBLICADA', now(), now(), now(), now()
FROM section s WHERE s.slug = 'cidades'
ON CONFLICT (slug) DO NOTHING;
