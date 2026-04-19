-- Add 'auto' value to linkedin_mode enum so users can explicitly opt into auto-send.
-- The application now dynamically detects active LinkedIn integrations (OutX/Unipile)
-- to determine send mode, but we keep the enum updated for future profile-level overrides.
ALTER TYPE linkedin_mode ADD VALUE IF NOT EXISTS 'auto';

-- Update default to 'auto' so new users get automatic sending when they configure an integration.
ALTER TABLE profiles ALTER COLUMN linkedin_mode SET DEFAULT 'auto';

-- Migrate existing users who have an active LinkedIn integration to 'auto' mode.
UPDATE profiles
SET linkedin_mode = 'auto'
WHERE id IN (
  SELECT DISTINCT user_id
  FROM user_integrations
  WHERE provider IN ('outx', 'unipile')
    AND is_active = true
);
