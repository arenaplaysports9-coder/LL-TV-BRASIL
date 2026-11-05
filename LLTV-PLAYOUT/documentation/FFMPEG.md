# Manual do motor FFmpeg

O serviço usa `child_process.spawn` com `shell:false` e argumentos separados. Os arquivos precisam existir dentro de `MEDIA_ROOT`. Os encoders utilizados nesta versão são `libx264` (CPU) e AAC.

Teste de disponibilidade: `npm run media:check`.

## Saídas disponíveis

- **HLS por canal:** a Central de Playout reproduz uma fila de vídeos e gera `index.m3u8` e segmentos MPEG-TS. Consulte `documentation/FFMPEG-PLAYOUT-OUTPUT.md`.
- **RTMP/RTMPS por arquivo:** a Central permite selecionar um vídeo da biblioteca e publicá-lo para um destino externo. Consulte `documentation/RTMP-PUBLISHING.md`.

## API RTMP/RTMPS

A rota recomendada é `POST /api/playout/rtmp/start`, com `mediaAssetId`, `outputUrl`, resolução, FPS, bitrate e preset. O backend resolve o caminho do asset por tenant. Jobs podem ser listados em `GET /api/playout/rtmp/jobs` e encerrados em `POST /api/playout/rtmp/stop/:jobId`.

Há também uma rota legada `POST /api/playout/start`, autenticada, que recebe `inputPath` e confere se o caminho corresponde a uma mídia da biblioteca do tenant. Prefira a rota nova baseada em `mediaAssetId`.

## Segurança e limites

- A URL RTMP contém a chave de publicação. Use HTTPS, não compartilhe a URL e evite registrar o corpo da requisição.
- A chave não é persistida no banco, mas é passada como argumento ao processo FFmpeg e pode ser vista por administradores locais do sistema operacional.
- O limite padrão é uma publicação simultânea por tenant (`MAX_RTMP_JOBS_PER_TENANT=1`) e duas no servidor (`MAX_RTMP_JOBS_GLOBAL=2`).
- A publicação RTMP atual envia um arquivo único e termina no fim do arquivo. Não há loop de playlist, retorno automático, transições, reconexão ou failover.
- Não há encoder GPU, H.265, SRT ou ingest ao vivo nesta etapa.
- Evite executar RTMP e HLS simultaneamente no notebook Intel Celeron N3350. Comece em SD/HD, 25 FPS, bitrate conservador e preset `ultrafast`.
