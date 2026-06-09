CREATE TABLE IF NOT EXISTS citizen.broadcast_updates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  broadcast_id UUID NOT NULL REFERENCES citizen.broadcasts(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS broadcast_updates_broadcast_created_idx
  ON citizen.broadcast_updates (broadcast_id, created_at ASC);