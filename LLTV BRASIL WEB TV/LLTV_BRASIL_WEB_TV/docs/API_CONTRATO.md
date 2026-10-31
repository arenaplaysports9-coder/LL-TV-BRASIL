# Contrato de API planejado

Base local: `http://localhost:8787/api`

## Público
- GET `/health`
- GET `/channels`
- GET `/programs`
- GET `/news`
- GET `/broadcasts`
- GET `/shows`
- GET `/media`
- GET `/channels/:slug`

## Administrativo (autenticação obrigatória)
- POST `/auth/login`, POST `/auth/logout`, POST `/auth/refresh`
- CRUD `/admin/users`
- CRUD `/channels`
- POST `/streams/:channelId/rotate-key`, GET `/streams/:channelId/status`
- CRUD `/schedule`
- GET `/schedule/conflicts`, GET `/schedule/executions`
- CRUD `/broadcasts`
- CRUD `/news`
- CRUD `/media`
- CRUD `/shows`, CRUD `/episodes`
- CRUD `/sponsors`
- GET `/analytics/summary`, GET `/analytics/export`
- CRUD `/settings`

Todos os recursos administrativos precisam validar papel/permissão no back-end, validar payloads e registrar operações sensíveis em audit_logs. Este documento descreve o contrato-alvo; endpoints não implementados ainda não devem ser tratados como disponíveis.
