CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS tenants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  email VARCHAR(254) NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  role VARCHAR(24) NOT NULL DEFAULT 'operator' CHECK (role IN ('owner','admin','operator','viewer')),
  active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(80) NOT NULL UNIQUE,
  resolution VARCHAR(12) NOT NULL DEFAULT 'HD' CHECK (resolution IN ('SD','HD','FULL_HD','UHD_4K')),
  width INTEGER NOT NULL DEFAULT 1280,
  height INTEGER NOT NULL DEFAULT 720,
  fps NUMERIC(5,2) NOT NULL DEFAULT 30,
  video_codec VARCHAR(12) NOT NULL DEFAULT 'h264' CHECK (video_codec IN ('h264','h265')),
  audio_codec VARCHAR(12) NOT NULL DEFAULT 'aac',
  video_bitrate_kbps INTEGER NOT NULL DEFAULT 4500,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS media_assets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  title VARCHAR(240) NOT NULL,
  file_path TEXT NOT NULL,
  media_type VARCHAR(20) NOT NULL DEFAULT 'video',
  duration_seconds INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS playlists (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES channels(id) ON DELETE CASCADE,
  name VARCHAR(160) NOT NULL,
  mode VARCHAR(12) NOT NULL DEFAULT 'manual' CHECK (mode IN ('manual','scheduled','loop')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS playlist_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id),
  position INTEGER NOT NULL,
  scheduled_at TIMESTAMPTZ,
  UNIQUE (playlist_id, position)
);
CREATE TABLE IF NOT EXISTS schedule_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  playlist_id UUID NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
  starts_at TIMESTAMPTZ NOT NULL,
  recurrence VARCHAR(16) NOT NULL DEFAULT 'once' CHECK (recurrence IN ('once','daily','weekly','monthly')),
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  last_run_at TIMESTAMPTZ,
  next_run_at TIMESTAMPTZ,
  last_status VARCHAR(20) NOT NULL DEFAULT 'pending' CHECK (last_status IN ('pending','running','completed','failed','disabled')) ,
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS last_run_at TIMESTAMPTZ;
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS next_run_at TIMESTAMPTZ;
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS last_status VARCHAR(20) NOT NULL DEFAULT 'pending';
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS last_error TEXT;
ALTER TABLE schedule_entries ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
UPDATE schedule_entries SET next_run_at=starts_at WHERE next_run_at IS NULL AND enabled=true;
CREATE INDEX IF NOT EXISTS idx_schedule_due ON schedule_entries(enabled,next_run_at);
CREATE TABLE IF NOT EXISTS commercials (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE,
  media_asset_id UUID NOT NULL REFERENCES media_assets(id),
  advertiser VARCHAR(160) NOT NULL,
  campaign VARCHAR(160),
  insertion_interval_minutes INTEGER NOT NULL DEFAULT 30,
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS playout_jobs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('starting','running','stopped','failed')),
  input_path TEXT NOT NULL,
  output_url TEXT NOT NULL,
  pid INTEGER,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ,
  error TEXT
);
CREATE TABLE IF NOT EXISTS operation_logs (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID REFERENCES tenants(id) ON DELETE SET NULL,
  user_id UUID REFERENCES users(id) ON DELETE SET NULL,
  level VARCHAR(12) NOT NULL DEFAULT 'info',
  event VARCHAR(120) NOT NULL,
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_media_tenant ON media_assets(tenant_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON playout_jobs(status);
CREATE INDEX IF NOT EXISTS idx_logs_created ON operation_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_schedule_starts ON schedule_entries(starts_at);


-- Persistent RTMP supervisor state. Destination URLs (including stream keys)
-- are stored only as AES-256-GCM ciphertext generated by the backend.
CREATE TABLE IF NOT EXISTS rtmp_stream_jobs (
  id UUID PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  playlist_id UUID REFERENCES playlists(id) ON DELETE SET NULL,
  status VARCHAR(16) NOT NULL CHECK (status IN ('starting','running','reconnecting','stopped','failed')),
  destination_ciphertext TEXT NOT NULL,
  failover_ciphertext TEXT,
  options JSONB NOT NULL DEFAULT '{}'::jsonb,
  source_title VARCHAR(240),
  retry_count INTEGER NOT NULL DEFAULT 0,
  max_retries INTEGER NOT NULL DEFAULT 3,
  using_failover BOOLEAN NOT NULL DEFAULT FALSE,
  last_heartbeat TIMESTAMPTZ,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stopped_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_rtmp_jobs_recovery ON rtmp_stream_jobs(status,updated_at);
CREATE INDEX IF NOT EXISTS idx_rtmp_jobs_tenant ON rtmp_stream_jobs(tenant_id,started_at DESC);

-- Broadcast operation modules: graphics/scoreboard, public Web TV and commercial audit.
CREATE TABLE IF NOT EXISTS channel_graphics (
  channel_id UUID PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS webtv_settings (
  channel_id UUID PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  public_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  display_name VARCHAR(160),
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS commercial_insertions (
  id BIGSERIAL PRIMARY KEY,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  channel_id UUID REFERENCES channels(id) ON DELETE SET NULL,
  commercial_id UUID REFERENCES commercials(id) ON DELETE SET NULL,
  inserted_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source VARCHAR(24) NOT NULL DEFAULT 'playlist'
);
CREATE INDEX IF NOT EXISTS idx_commercial_insertions_tenant ON commercial_insertions(tenant_id,inserted_at DESC);
CREATE TABLE IF NOT EXISTS channel_playout_sessions (
  channel_id UUID PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  queue JSONB NOT NULL,
  resolution VARCHAR(12) NOT NULL DEFAULT 'SD',
  status VARCHAR(16) NOT NULL DEFAULT 'stopped' CHECK (status IN ('playing','stopped','failed')),
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_channel_playout_recovery ON channel_playout_sessions(status,updated_at);

CREATE TABLE IF NOT EXISTS srt_ingest_sessions (
  channel_id UUID PRIMARY KEY REFERENCES channels(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  input_ciphertext TEXT NOT NULL,
  mode VARCHAR(12) NOT NULL CHECK (mode IN ('listener','caller')),
  resolution VARCHAR(8) NOT NULL DEFAULT 'SD' CHECK (resolution IN ('SD','HD')),
  status VARCHAR(16) NOT NULL DEFAULT 'stopped' CHECK (status IN ('running','stopped','failed')),
  last_error TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
