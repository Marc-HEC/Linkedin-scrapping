-- ============================================================
-- Tags de ciblage sur contacts + fonction de matching par priorité
-- ============================================================

ALTER TABLE public.contacts
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

CREATE INDEX IF NOT EXISTS idx_contacts_tags_gin
  ON public.contacts USING GIN (tags);

-- Matching par priorité :
-- - p_tags est ordonné : plus un tag est tôt, plus il pèse
-- - on garde les contacts qui matchent AU MOINS un tag
-- - tri : nb de tags matchés (desc), puis score de position (desc)
CREATE OR REPLACE FUNCTION public.match_contacts_by_tags(
  p_user UUID,
  p_tags TEXT[],
  p_limit INT DEFAULT 500
)
RETURNS TABLE (
  id UUID,
  first_name TEXT,
  last_name TEXT,
  email TEXT,
  linkedin_url TEXT,
  company_name TEXT,
  role TEXT,
  tags TEXT[],
  custom_fields JSONB,
  match_count INT,
  position_score INT
)
LANGUAGE SQL STABLE
AS $$
  SELECT
    c.id, c.first_name, c.last_name, c.email, c.linkedin_url,
    c.company_name, c.role, c.tags, c.custom_fields,
    cardinality(ARRAY(SELECT unnest(c.tags) INTERSECT SELECT unnest(p_tags)))::INT AS match_count,
    COALESCE((
      SELECT SUM(array_length(p_tags, 1) - array_position(p_tags, t) + 1)::INT
      FROM unnest(c.tags) t
      WHERE t = ANY(p_tags)
    ), 0) AS position_score
  FROM public.contacts c
  WHERE c.user_id = p_user
    AND c.tags && p_tags
  ORDER BY match_count DESC, position_score DESC, c.created_at DESC
  LIMIT p_limit;
$$;

GRANT EXECUTE ON FUNCTION public.match_contacts_by_tags(UUID, TEXT[], INT) TO authenticated;

-- Retourne la liste distincte des tags utilisés par l'utilisateur (pour combobox)
CREATE OR REPLACE FUNCTION public.list_user_tags(p_user UUID)
RETURNS TABLE (tag TEXT, usage_count BIGINT)
LANGUAGE SQL STABLE
AS $$
  SELECT t AS tag, COUNT(*) AS usage_count
  FROM public.contacts c, unnest(c.tags) t
  WHERE c.user_id = p_user
  GROUP BY t
  ORDER BY usage_count DESC, t ASC;
$$;

GRANT EXECUTE ON FUNCTION public.list_user_tags(UUID) TO authenticated;
