CREATE TABLE IF NOT EXISTS auth.user_notification_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  alert_notifications BOOLEAN NOT NULL DEFAULT true,
  reply_notifications BOOLEAN NOT NULL DEFAULT true,
  agency_ping_notifications BOOLEAN NOT NULL DEFAULT true,
  volunteer_notifications BOOLEAN NOT NULL DEFAULT false,
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  phone_number TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CHECK (sms_enabled = false OR phone_number IS NOT NULL)
);

CREATE TABLE IF NOT EXISTS auth.broadcast_dismissals (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  broadcast_id UUID REFERENCES citizen.broadcasts(id) ON DELETE CASCADE,
  action TEXT NOT NULL CHECK (action IN ('notify', 'ignore')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, broadcast_id)
);
