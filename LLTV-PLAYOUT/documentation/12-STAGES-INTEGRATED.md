# Entrega integrada das 12 etapas — estado 1.4.0

Esta atualização incorpora as doze frentes numa única base de desenvolvimento. O estado abaixo distingue funções reais de recursos ainda parciais.

| Etapa | Escopo | Estado nesta entrega |
|---:|---|---|
| 1 | Autenticação e segurança | Parcial: registro/login JWT, hash bcrypt, RBAC básico, Helmet e escopo tenant em rotas autenticadas; faltam MFA, rate limit, recuperação de senha, auditoria completa e revisão de segurança independente |
| 2 | Biblioteca de mídia | Parcial: upload autenticado, limite e MIME allowlist, listagem; faltam FFprobe obrigatório, scanner antivírus, proxies, thumbnails e gestão completa de metadados |
| 3 | Playlists | Parcial: criação, inclusão de itens e execução pelo motor HLS/RTMP; faltam edição/reordenação completa e regras broadcast avançadas |
| 4 | Scheduler | Parcial funcional: dispatcher PostgreSQL inicia playlist no canal para once/daily/weekly/monthly; faltam fuso por canal, fila de execução durável e recuperação de sessão HLS após queda abrupta |
| 5 | Central Preview/Program | Parcial: console de canal e saída HLS real; Preview/Program simultâneos, transições e multiview broadcast ainda pendentes |
| 6 | Comerciais | Parcial: cadastro de campanhas; inserção automática na fila e relatório de comprovação ainda pendentes |
| 7 | Encoding/streaming | Parcial: HLS por canal, RTMP/RTMPS de arquivo e playlist contínua, reconexão limitada, persistência e destino failover; SRT, ingest, GPU e homologação externa pendentes |
| 8 | Entradas ao vivo e OBS | Pendente: documentação técnica, sem integração operacional bidirecional |
| 9 | Gráficos e placar | Pendente: compositor e templates profissionais ainda não implementados |
| 10 | Player Web TV | Pendente: distribuição pública e player Web TV de produção ainda não implementados |
| 11 | Multi-tenant e White Label | Parcial: tenant/user, RBAC básico, canais e rotas autenticadas com escopo; branding configurável, billing e auditoria completa pendentes |
| 12 | Monitoramento, backups, instalador e produção | Parcial: health, doctor, métricas, supervisor Windows e logs; backups automatizados, instalador final e testes prolongados pendentes |

## Endpoints principais

- `POST /api/auth/register`, `POST /api/auth/login`, `GET /api/auth/me`.
- `GET /api/channels`, `POST /api/channels` (autenticados; criação owner/admin).
- `POST /api/media/upload`, `GET /api/media`.
- `POST /api/playlists`, `GET /api/playlists`, `POST /api/playlists/:id/items`.
- `POST /api/schedule`, `GET /api/schedule`, `PATCH /api/schedule/:id`, `DELETE /api/schedule/:id`.
- `POST /api/commercials`, `GET /api/commercials`.
- `GET /api/system/metrics`.
- Rotas HLS/console e publicação RTMP descritas em `documentation/API.md`.

O registro público cria um tenant novo; em produção deve ser protegido por convite/controle de provisionamento. O upload ainda precisa de antivírus e inspeção real de conteúdo. Configure HTTPS, rate limiting, backups e políticas operacionais antes de expor o serviço.

## Limitações importantes

O projeto ainda não é um produto broadcast final. Permanecem pendentes automação comercial, Preview/Program completo, SRT/ingest, integração OBS operacional, gráficos/placar, Web TV pública, white label, backup automatizado, persistência de sessão HLS após crash e homologação de operação 24/7.
