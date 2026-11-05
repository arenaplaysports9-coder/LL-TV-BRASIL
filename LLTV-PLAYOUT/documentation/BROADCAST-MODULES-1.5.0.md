# LLTV PLAYOUT 1.5.0 — Módulos de operação broadcast

Esta entrega integra oito frentes solicitadas no mesmo repositório. Ela amplia o backend, o schema e o painel React; não representa homologação de produção.

## 1. Comerciais automáticos

Comerciais ativos (`commercials.enabled=true`) são inseridos nas filas HLS carregadas pela Central e nas playlists RTMP contínuas. O intervalo é calculado sobre a duração de programação, não incluindo a duração dos próprios anúncios, e é aplicado no limite entre arquivos (não corta um vídeo no segundo exato do intervalo). Apenas arquivos de vídeo com caminhos válidos no MEDIA_ROOT são elegíveis. A regra é aplicada quando a fila/publicação é montada; mudanças feitas depois disso entram na próxima montagem.

## 2. Preview / Program

`POST /api/playout/preview/:channelId` seleciona uma mídia para Preview. `POST /api/playout/take/:channelId` envia a mídia selecionada ao motor de playout HLS e inicia o Program. TAKE aceita vídeo nesta versão. O estado Preview permanece em memória; Program é executado pelo motor de playout.

## 3. OBS Studio

Integração com OBS WebSocket v5 para testar conexão e solicitar `StartStream` / `StopStream`. O OBS deve ter WebSocket ativado e ser alcançável a partir do servidor LLTV. Credenciais não são persistidas. Browser Source pode usar `/api/graphics/overlay/:channelId` e Media Source pode usar a saída HLS do canal.

## 4. Grafismos e placar

`PUT /api/graphics/:channelId` persiste tarja, identificação e placar no PostgreSQL. `/api/graphics/overlay/:channelId` entrega uma página HTML transparente para Browser Source. O overlay é um módulo gráfico web independente; não é ainda um compositor integrado ao encoder RTMP/HLS.

## 5. Web TV

`PUT /api/webtv/settings/:channelId` controla publicação pública. `/api/webtv/channels` lista canais públicos com HLS ativo. `/api/webtv/player/:slug` fornece um player web. A compatibilidade HLS varia por navegador; a página usa Hls.js CDN em navegadores sem HLS nativo.

## 6. Entrada SRT

`POST /api/ingest/srt/:channelId/start` inicia FFmpeg como SRT caller/listener e converte entrada para HLS SD/HD. `POST .../stop` encerra a entrada. URL de saída é protegida por token aleatório. Requer FFmpeg compilado com suporte SRT, portas/firewall e conectividade de rede configurados.

## 7. Recuperação

As filas HLS ativas são persistidas em `channel_playout_sessions` e recuperadas no boot da API. Entradas SRT são persistidas com URL criptografada em `srt_ingest_sessions` e recuperadas no boot. Transmissões RTMP persistidas continuam usando o supervisor existente. A recuperação só pode funcionar se o banco, arquivos de mídia, segredos e FFmpeg estiverem disponíveis. Sessões Preview não são recuperadas. A recuperação depende da mesma chave `RTMP_SECRET_ENCRYPTION_KEY` permanecer estável entre reinícios.

## 8. Backup e instalação

- `scripts/install-lltv-windows.ps1` verifica Node 20+, FFmpeg/FFprobe, instala dependências, compila o painel e tenta executar migrações quando DATABASE_URL está configurada.
- `scripts/backup-lltv.ps1` cria dump custom do PostgreSQL e ZIP das mídias. Não copia `.env` nem chaves secretas.
- `scripts/restore-database.ps1` restaura dump PostgreSQL; faça backup prévio e confira DATABASE_URL.

## Endpoints e autenticação

As rotas de gestão exigem JWT e respeitam tenant. Endpoints públicos WebTV/overlay/SRT são intencionalmente públicos e limitados a canais habilitados ou tokens efêmeros.

## Limitações e homologação obrigatória

Não foi possível testar PostgreSQL real, OBS instalado, rede SRT real, RTMP de plataforma externa, firewall do Windows, restauração real de backup ou hardware de produção neste ambiente. O OBS WebSocket deve ser validado com OBS v5 real. O Celeron N3350 não é recomendado para codificação HD/Full HD/4K simultânea; começar em SD, ultrafast e um único processo. O instalador é um script de preparação, não um instalador MSI assinado nem serviço Windows formal. Failover de destino RTMP não substitui redundância de internet, energia ou servidor.
