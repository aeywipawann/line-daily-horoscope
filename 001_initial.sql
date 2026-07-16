CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS users (
  line_user_id TEXT PRIMARY KEY,
  zodiac_sign TEXT CHECK (zodiac_sign IN (
    'aries','taurus','gemini','cancer','leo','virgo',
    'libra','scorpio','sagittarius','capricorn','aquarius','pisces'
  )),
  birth_date DATE,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (zodiac_sign IS NOT NULL OR birth_date IS NULL)
);

CREATE TABLE IF NOT EXISTS horoscope_requests (
  id BIGSERIAL PRIMARY KEY,
  line_user_id TEXT NOT NULL REFERENCES users(line_user_id) ON DELETE CASCADE,
  request_type TEXT NOT NULL CHECK (request_type IN (
    'daily','love','career','finance','lucky_number'
  )),
  zodiac_sign TEXT NOT NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS horoscope_requests_user_time_idx
  ON horoscope_requests (line_user_id, requested_at DESC);

CREATE TABLE IF NOT EXISTS horoscopes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  horoscope_date DATE NOT NULL,
  zodiac_sign TEXT NOT NULL CHECK (zodiac_sign IN (
    'aries','taurus','gemini','cancer','leo','virgo',
    'libra','scorpio','sagittarius','capricorn','aquarius','pisces'
  )),
  overview TEXT NOT NULL,
  career TEXT NOT NULL,
  finance TEXT NOT NULL,
  love TEXT NOT NULL,
  health TEXT NOT NULL,
  lucky_color TEXT NOT NULL,
  lucky_number TEXT NOT NULL,
  advice TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published')),
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (horoscope_date, zodiac_sign)
);

CREATE INDEX IF NOT EXISTS horoscopes_published_lookup_idx
  ON horoscopes (horoscope_date, zodiac_sign, status);

CREATE TABLE IF NOT EXISTS processed_webhook_events (
  webhook_event_id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'processing' CHECK (status IN ('processing','completed')),
  locked_until TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '2 minutes',
  processed_at TIMESTAMPTZ,
  last_error TEXT
);

CREATE INDEX IF NOT EXISTS processed_webhook_events_time_idx
  ON processed_webhook_events (processed_at);

CREATE TABLE IF NOT EXISTS user_rate_limits (
  line_user_id TEXT PRIMARY KEY,
  window_started_at TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL CHECK (request_count >= 0)
);

CREATE TABLE IF NOT EXISTS session (
  sid VARCHAR NOT NULL PRIMARY KEY,
  sess JSON NOT NULL,
  expire TIMESTAMP(6) NOT NULL
);

CREATE INDEX IF NOT EXISTS session_expire_idx ON session (expire);
