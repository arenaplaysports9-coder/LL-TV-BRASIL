# API inicial

Base URL local: `http://127.0.0.1:4000/api`

## GET /health
Retorna estado da API e PostgreSQL.

## GET /channels
Lista canais.

## POST /channels
JSON: `{"name":"LLTV Brasil","slug":"lltv-brasil","resolution":"HD"}`

## GET /playout/status
Lista os jobs da conta autenticada (JWT obrigatório).

## POST /playout/start (legado, autenticado)
JSON: `{"inputPath":"C:/lltv/storage/media/video.mp4","outputUrl":"rtmp://servidor/app/CHAVE","resolution":"HD","fps":30,"bitrateKbps":4500}`

O caminho precisa estar dentro de `MEDIA_ROOT`. Somente RTMP/RTMPS é aceito. Não compartilhe stream keys.

## POST /playout/stop/:jobId (legado, autenticado)
Envia SIGTERM somente a um job pertencente à conta autenticada. O serviço tenta SIGKILL após 5 segundos se o processo não encerrar.

## Publicação RTMP/RTMPS

Todas as rotas abaixo exigem `Authorization: Bearer <JWT>`. Para iniciar/parar é necessário papel `owner`, `admin` ou `operator`.

- `GET /api/playout/rtmp/jobs` — jobs de publicação da conta autenticada.
- `POST /api/playout/rtmp/start` — corpo JSON: `mediaAssetId`, `outputUrl`, `resolution` (`SD|HD|FULL_HD|UHD_4K`), `fps`, `bitrateKbps`, `preset` (`ultrafast|superfast|veryfast|faster|fast|medium`).
- `POST /api/playout/rtmp/stop/:jobId` — encerra um job da própria conta.

O backend resolve o caminho de arquivo pela biblioteca do tenant; não aceite caminhos arbitrários enviados pelo navegador. A URL de publicação contém a chave do provedor: use HTTPS em produção, evite registrar o corpo HTTP e não compartilhe a URL. Ver `documentation/RTMP-PUBLISHING.md`.
