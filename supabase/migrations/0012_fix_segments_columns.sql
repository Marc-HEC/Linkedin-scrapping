-- Migration 0012: fix segments table schema mismatch.
-- Migration 0001 created segments with `filters JSONB NOT NULL` and no `tag_filters`.
-- Migration 0010 used CREATE TABLE IF NOT EXISTS, so was a no-op on existing DBs.
-- This migration adds the missing column and makes the obsolete one optional.

ALTER TABLE public.segments ADD COLUMN IF NOT EXISTS tag_filters jsonb NOT NULL DEFAULT '[]';

-- Make the old `filters` column optional so new code that omits it won't fail.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'segments' AND column_name = 'filters'
  ) THEN
    ALTER TABLE public.segments ALTER COLUMN filters DROP NOT NULL;
    ALTER TABLE public.segments ALTER COLUMN filters SET DEFAULT '{}'::jsonb;
  END IF;
END $$;
