# Modelo de banco de dados

O arquivo `database/schema.sql` define tenants, channels, media_assets, playlists, playlist_items, playout_jobs e operation_logs. A migração inicial é idempotente para as tabelas e índices. A autenticação e as políticas de isolamento multi-tenant ainda não estão implementadas; portanto, o campo tenant_id é apenas fundação de modelagem e não deve ser tratado como isolamento de segurança.
