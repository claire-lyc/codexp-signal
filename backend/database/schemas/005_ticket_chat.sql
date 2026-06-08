CREATE TABLE IF NOT EXISTS citizen.report_chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES citizen.reports(id) ON DELETE CASCADE,
  author_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  author_type public.actor_type NOT NULL,
  author_label TEXT,
  message_kind TEXT NOT NULL DEFAULT 'reply' CHECK (message_kind IN ('original', 'reply', 'system')),
  visibility TEXT NOT NULL CHECK (visibility IN ('public', 'internal')),
  body TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE citizen.report_chat_messages
  ADD COLUMN IF NOT EXISTS author_label TEXT,
  ADD COLUMN IF NOT EXISTS message_kind TEXT NOT NULL DEFAULT 'reply';

CREATE INDEX IF NOT EXISTS report_chat_messages_report_id_idx
  ON citizen.report_chat_messages (report_id, created_at);

CREATE TABLE IF NOT EXISTS citizen.report_chat_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES citizen.report_chat_messages(id) ON DELETE CASCADE,
  report_image_id UUID REFERENCES citizen.report_images(id) ON DELETE SET NULL,
  original_filename TEXT,
  mime_type TEXT,
  byte_size INTEGER,
  storage_key TEXT,
  preview_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS report_chat_attachments_message_id_idx
  ON citizen.report_chat_attachments (message_id);

INSERT INTO citizen.report_chat_messages (
  report_id,
  author_user_id,
  author_type,
  author_label,
  message_kind,
  visibility,
  body,
  created_at
)
SELECT
  reports.id,
  reports.reporter_user_id,
  CASE WHEN reports.reporter_user_id IS NULL THEN 'anonymous_citizen'::public.actor_type ELSE 'citizen'::public.actor_type END,
  reports.reporter_label,
  'original',
  'public',
  reports.description,
  reports.created_at
FROM citizen.reports reports
WHERE NOT EXISTS (
  SELECT 1
  FROM citizen.report_chat_messages messages
  WHERE messages.report_id = reports.id
    AND messages.message_kind = 'original'
);

INSERT INTO citizen.report_chat_messages (
  report_id,
  author_user_id,
  author_type,
  author_label,
  message_kind,
  visibility,
  body,
  created_at
)
SELECT
  comments.report_id,
  comments.author_user_id,
  comments.author_type,
  NULL,
  'reply',
  comments.visibility,
  comments.body,
  comments.created_at
FROM citizen.report_comments comments
WHERE NOT EXISTS (
  SELECT 1
  FROM citizen.report_chat_messages messages
  WHERE messages.report_id = comments.report_id
    AND messages.body = comments.body
    AND messages.visibility = comments.visibility
    AND messages.created_at = comments.created_at
);

INSERT INTO citizen.report_chat_attachments (
  message_id,
  report_image_id,
  original_filename,
  mime_type,
  byte_size,
  storage_key,
  preview_url,
  created_at
)
SELECT
  messages.id,
  images.id,
  images.original_filename,
  images.mime_type,
  images.byte_size,
  images.storage_key,
  images.processed_metadata ->> 'previewUrl',
  images.created_at
FROM citizen.report_images images
JOIN citizen.report_chat_messages messages
  ON messages.report_id = images.report_id
 AND messages.message_kind = 'original'
WHERE NOT EXISTS (
  SELECT 1
  FROM citizen.report_chat_attachments attachments
  WHERE attachments.report_image_id = images.id
);
