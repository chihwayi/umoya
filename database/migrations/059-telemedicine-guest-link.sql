-- Lets a doctor generate a shareable, unauthenticated guest link for a
-- telemedicine call (e.g. an outside specialist or family member joining
-- without an Umoya account). The token is single-purpose and time-boxed —
-- it is not a login credential and only ever grants access to one room.

ALTER TABLE IF EXISTS telemedicine_consultations
  ADD COLUMN IF NOT EXISTS guest_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS guest_token_expires_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_telemedicine_consultations_guest_token
  ON telemedicine_consultations(guest_token)
  WHERE guest_token IS NOT NULL;

COMMENT ON COLUMN telemedicine_consultations.guest_token IS
  'Opaque token for the unauthenticated guest-join link. Null until the doctor generates one via POST .../guest-link.';
COMMENT ON COLUMN telemedicine_consultations.guest_token_expires_at IS
  'Guest link expiry — checked on every guest join attempt, independent of the LiveKit token''s own TTL.';
