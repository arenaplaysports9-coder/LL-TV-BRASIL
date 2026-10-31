CREATE TABLE IF NOT EXISTS channels (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(120) NOT NULL, slug VARCHAR(120) UNIQUE NOT NULL,
  description TEXT, logo_url TEXT, stream_key_hash TEXT, stream_url TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS programs (
  id BIGSERIAL PRIMARY KEY, channel_id BIGINT REFERENCES channels(id) ON DELETE SET NULL,
  title VARCHAR(180) NOT NULL, description TEXT, cover_url TEXT, media_url TEXT,
  starts_at TIMESTAMPTZ NOT NULL, ends_at TIMESTAMPTZ, recurrence VARCHAR(30),
  priority INTEGER NOT NULL DEFAULT 0, status VARCHAR(24) NOT NULL DEFAULT 'scheduled',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS news (
  id BIGSERIAL PRIMARY KEY, title VARCHAR(220) NOT NULL, slug VARCHAR(240) UNIQUE NOT NULL,
  summary TEXT, body TEXT NOT NULL, image_url TEXT, category VARCHAR(100),
  tags TEXT[] NOT NULL DEFAULT '{}', status VARCHAR(24) NOT NULL DEFAULT 'draft',
  published_at TIMESTAMPTZ, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS broadcasts (
  id BIGSERIAL PRIMARY KEY, channel_id BIGINT REFERENCES channels(id) ON DELETE SET NULL,
  title VARCHAR(180) NOT NULL, competition VARCHAR(180), round_name VARCHAR(80),
  home_team VARCHAR(120), away_team VARCHAR(120), home_badge_url TEXT, away_badge_url TEXT,
  starts_at TIMESTAMPTZ, local_time_label VARCHAR(80), venue VARCHAR(180), city VARCHAR(120),
  narrator VARCHAR(120), commentator VARCHAR(120), cover_url TEXT,
  status VARCHAR(24) NOT NULL DEFAULT 'scheduled', created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS media_library (
  id BIGSERIAL PRIMARY KEY, title VARCHAR(180) NOT NULL, description TEXT,
  media_url TEXT NOT NULL, cover_url TEXT, category VARCHAR(80),
  duration_seconds INTEGER, visibility VARCHAR(20) NOT NULL DEFAULT 'public',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS admins (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(120), email VARCHAR(190) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL, role VARCHAR(40) NOT NULL DEFAULT 'operator',
  is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS sponsors (
  id BIGSERIAL PRIMARY KEY, name VARCHAR(160) NOT NULL, logo_url TEXT, banner_url TEXT,
  target_url TEXT, placement VARCHAR(50), starts_at TIMESTAMPTZ, ends_at TIMESTAMPTZ,
  is_active BOOLEAN NOT NULL DEFAULT TRUE, created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS shows (
  id BIGSERIAL PRIMARY KEY, title VARCHAR(180) NOT NULL, description TEXT,
  logo_url TEXT, cover_url TEXT, host_name VARCHAR(120), schedule_text VARCHAR(160),
  is_active BOOLEAN NOT NULL DEFAULT TRUE
);
CREATE TABLE IF NOT EXISTS episodes (
  id BIGSERIAL PRIMARY KEY, show_id BIGINT REFERENCES shows(id) ON DELETE CASCADE,
  title VARCHAR(180) NOT NULL, description TEXT, media_url TEXT NOT NULL,
  cover_url TEXT, published_at TIMESTAMPTZ
);
CREATE TABLE IF NOT EXISTS audience_events (
  id BIGSERIAL PRIMARY KEY, channel_id BIGINT REFERENCES channels(id) ON DELETE SET NULL,
  event_type VARCHAR(40) NOT NULL, anonymous_session_id VARCHAR(120),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(120) PRIMARY KEY, setting_value JSONB NOT NULL DEFAULT '{}',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY, admin_id BIGINT REFERENCES admins(id) ON DELETE SET NULL,
  action VARCHAR(120) NOT NULL, resource VARCHAR(120), details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
INSERT INTO channels (name, slug, description)
VALUES ('LLTV BRASIL', 'lltv-brasil', 'Canal principal da LLTV BRASIL')
ON CONFLICT (slug) DO NOTHING;


-- Catálogo de módulos da plataforma (metadados; não substitui as tabelas funcionais).
CREATE TABLE IF NOT EXISTS module_catalog (
  id INTEGER PRIMARY KEY,
  category VARCHAR(100) NOT NULL,
  name VARCHAR(160) NOT NULL,
  slug VARCHAR(100) UNIQUE NOT NULL,
  status VARCHAR(60) NOT NULL DEFAULT 'Estrutura inicial',
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
