# Operação do Playout — versão inicial

1. Inicie PostgreSQL e aplique `npm run db:migrate`.
2. Inicie backend e frontend.
3. Confirme `GET /api/health`.
4. Cadastre um canal por `POST /api/channels`.
5. Coloque um arquivo de mídia autorizado dentro de `storage/media`.
6. Configure um destino RTMP de teste e inicie um job por `POST /api/playout/start`.
7. Consulte `GET /api/playout/status` e pare pelo endpoint `/api/playout/stop/:jobId`.

A versão inicial não oferece operação 24/7 automatizada, playlist contínua, preview/program, agendamento ou failover.
