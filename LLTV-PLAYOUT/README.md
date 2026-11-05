# LLTV PLAYOUT V1.0 — Desenvolvimento integrado 1.4.0

**A Casa das Ligas Alternativas – LLTV Brasil**

Este repositório é uma base executável e expansível para uma plataforma de automação televisiva. Ele contém um backend Node.js funcional com PostgreSQL, API de saúde e canais, serviço controlado de FFmpeg, interface React inicial, shell desktop Electron, player web, esquema SQL, Docker Compose, scripts Windows, testes e documentação.

> **Estado real da entrega:** esta é a versão de desenvolvimento integrada. Não é ainda um playout broadcast completo nem está homologada para operação 24/7. Os módulos estão classificados em `documentation/STATUS-MODULOS.md`. Recursos como gráficos completos, SRT, distribuição HLS pública de produção, integração OBS bidirecional, inserção automática de comerciais e failover de infraestrutura ainda exigem implementação e validação.

## Requisitos

- Windows 10/11 64 bits
- Node.js 20 LTS ou superior e npm
- Docker Desktop (recomendado) para PostgreSQL
- FFmpeg instalado e disponível no `PATH` (opcional para iniciar a API; necessário para transcodificação)
- Git

## Início rápido (Windows)

1. Instale Node.js 20+ e Docker Desktop.
2. Copie `.env.example` para `.env` e ajuste as credenciais.
3. Execute `scripts\\setup-windows.bat`.
4. Execute `scripts\\start-database.bat` para iniciar PostgreSQL.
5. Em um terminal, execute `npm run dev`.
6. Abra `http://localhost:4000/api/health`.

A interface administrativa React em `apps/web` oferece navegação por visão geral, canais, mídias, playlists, programação, comerciais e sistema. Para executá-la em outro terminal: `cd apps/web`, `npm install`, `npm run dev`. O Vite exibirá o endereço local.

## Comandos da raiz

- `npm install` — instala dependências do backend.
- `npm run dev` — inicia a API em modo desenvolvimento.
- `npm start` — inicia a API.
- `npm test` — executa os testes automatizados.
- `npm run db:migrate` — aplica o schema PostgreSQL.
- `npm run scheduler:run-once` — executa uma verificação manual dos agendamentos vencidos.
- `npm run media:check` — verifica se FFmpeg está acessível.

## API inicial

- `GET /api/health` — estado da API, banco e FFmpeg.
- `GET /api/channels` — lista canais cadastrados.
- `POST /api/channels` — cria canal (nome e slug obrigatórios).
- `GET /api/playout/status` — lista jobs da conta autenticada.
- `POST /api/playout/rtmp/start` — publica uma mídia da biblioteca para RTMP/RTMPS.
- `POST /api/playout/rtmp/start-playlist` — publica uma playlist de vídeos em repetição contínua, com tentativas limitadas de reconexão.
- `GET /api/playout/rtmp/jobs` e `POST /api/playout/rtmp/stop/:jobId` — acompanham e encerram jobs da conta.
- `GET /api/playout/rtmp/history` — histórico persistido de publicações RTMP da conta.
- `POST /api/playout/start` permanece como rota legada autenticada; prefira as rotas novas baseadas em IDs de mídia/playlist.

A publicação contínua possui agora persistência PostgreSQL, recuperação opcional após reinício, heartbeat do encoder, alertas por log/webhook, failover para um segundo destino RTMP e supervisor PowerShell do Windows para reiniciar a API se ela travar. Para habilitar, aplique `npm run db:migrate` e configure `RTMP_SECRET_ENCRYPTION_KEY` e `RTMP_RECOVER_ON_START=true`; consulte `documentation/RTMP-RESILIENCE-PERSISTENCE.md`. O supervisor de inicialização é opcional e inicia no logon do usuário Windows. Isso ainda não equivale a garantia de broadcast 24/7 ou failover de hardware/rede: exige teste real e infraestrutura redundante.

## Segurança importante

- Nunca publique `.env`, senhas, tokens ou chaves de transmissão no GitHub.
- O serviço FFmpeg não aceita comandos arbitrários: recebe caminho de mídia, URL RTMP e parâmetros validados, usando `spawn` sem shell.
- Configure firewall, TLS, autenticação, autorização por canal e gestão de segredos antes de produção.
- Para operação 24/7, use UPS, monitoramento externo, redundância de internet/energia e testes de recuperação.

## Estrutura

Veja `documentation/ARCHITECTURE.md` e `documentation/STATUS-MODULOS.md`.

## Saída real de vídeo do Playout

A Central de Playout utiliza o serviço `backend/src/services/playout-engine.js` para iniciar o FFmpeg e gerar saída HLS por canal. Consulte `documentation/FFMPEG-PLAYOUT-OUTPUT.md` para configuração, uso em VLC/OBS e limitações (incluindo PAUSE indisponível no Windows nesta versão).

## Publicação RTMP/RTMPS

Consulte `documentation/RTMP-PUBLISHING.md` para publicar um vídeo da biblioteca em uma plataforma externa, acompanhar jobs e encerrar a transmissão.


## Programação automática

A versão 1.4.0 adiciona dispatcher de grade com recorrências uma vez/diária/semanal/mensal, início automático da playlist no canal, controle de pausar/reativar e exclusão de horários. Consulte `documentation/SCHEDULER-AUTOMATICO.md`. A execução foi coberta por testes unitários de cálculo de recorrência; a execução integrada depende de PostgreSQL configurado e precisa ser homologada no Windows.

## Diagnóstico e prontidão no Windows

A versão 1.4.0 inclui `npm run doctor`, que verifica Node.js, FFmpeg/FFprobe, permissões das pastas, segredos obrigatórios e conexão/tabelas do PostgreSQL. Consulte `documentation/WINDOWS-PREFLIGHT-AND-HEALTH.md`. O endpoint `/api/health/live` é usado pelo supervisor; `/api/health` verifica a prontidão de dependências.

## Atualização 1.5.0 — oito frentes de operação

Consulte `documentation/BROADCAST-MODULES-1.5.0.md` para os módulos de comerciais automáticos, Preview/Program, OBS WebSocket, grafismos/placar, Web TV, ingest SRT, recuperação de filas HLS e scripts de backup/instalação Windows. Execute `npm run db:migrate` após atualizar o projeto. Esta entrega ainda requer homologação em Windows/PostgreSQL/OBS/rede reais antes de produção.
