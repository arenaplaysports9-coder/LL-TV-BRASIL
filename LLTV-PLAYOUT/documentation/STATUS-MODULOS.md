# Status dos 30 módulos — LLTV PLAYOUT V1.0

Legenda: **Implementado (base)** = código inicial executável; **Parcial** = fundação funcional, mas faltam recursos importantes; **Pendente** = ainda não implementado.

| Nº | Módulo | Estado real | Observação |
|---:|---|---|---|
| 1 | Planejamento e arquitetura | Implementado (base) | Arquitetura e documentação inicial |
| 2 | Estrutura inicial do projeto | Implementado | Monorepo/pastas e scripts |
| 3 | Ambiente Windows | Parcial | Scripts .bat e supervisor PowerShell; sem instalador final/homologação |
| 4 | Identidade visual | Parcial | Tema web inicial preto/dourado |
| 5 | PostgreSQL | Implementado (base) | Schema e migração; banco real não homologado neste ambiente |
| 6 | Backend e APIs | Parcial | Health, autenticação, mídia, playlist, grade e playout |
| 7 | Autenticação e segurança | Parcial | JWT/RBAC e escopo tenant em rotas principais; hardening, MFA e auditoria pendentes |
| 8 | Dashboard administrativo | Parcial | Dashboard React com módulos básicos |
| 9 | Gerenciador de mídia | Parcial | Upload/listagem e validação MIME/tamanho; FFprobe, scanner e proxies pendentes |
| 10 | Playlists | Parcial | Criação/itens e execução HLS/RTMP; editor completo pendente |
| 11 | Agendador | Parcial funcional | Dispatcher automático PostgreSQL para once/daily/weekly/monthly; recuperação de jobs agendados requer homologação |
| 12 | Central de Playout | Parcial | Console HLS, Preview com player, TAKE/Program e recuperação persistida; PAUSE Windows e transições pendentes |
| 13 | Motor FFmpeg | Parcial | HLS por canal, RTMP arquivo/playlist, reconexão e telemetria |
| 14 | Resolução e encoding | Parcial | SD/HD/FHD/4K, H.264/AAC CPU; 4K depende de hardware adequado |
| 15 | Motor de streaming | Parcial | HLS, RTMP/RTMPS e ingest SRT→HLS; homologação externa e redundância pendentes |
| 16 | Entradas ao vivo | Parcial | Ingest SRT caller/listener com HLS e recuperação criptografada; switching multi-fonte pendente |
| 17 | Integração OBS | Parcial | OBS WebSocket v5: teste de conexão e comandos StartStream/StopStream; homologação com OBS real pendente |
| 18 | Gráficos televisivos | Parcial | Tarja e placar HTML transparente para Browser Source; templates profissionais e compositor no encoder pendentes |
| 19 | Placar esportivo | Parcial | Placar manual com mandante, visitante, gols, relógio e período em overlay; integração automática de dados pendente |
| 20 | Comerciais | Parcial funcional | Inserção automática nas filas HLS e RTMP contínuas por intervalo aproximado na fronteira entre arquivos; relatório de veiculação pendente |
| 21 | Áudio profissional | Pendente | Mixagem, roteamento e processamento pendentes |
| 22 | Web TV | Parcial | Player público HLS e configuração de canal; CDN, escalabilidade e homologação de produção pendentes |
| 23 | Electron | Parcial | Janela desktop inicial |
| 24 | Multicanal | Parcial | Modelo de canais existe; isolamento e execução simultânea precisam de homologação |
| 25 | SaaS multi-tenant | Parcial | Tenant, usuários e escopo em rotas principais; billing e auditoria pendentes |
| 26 | White Label | Pendente | Branding configurável pendente |
| 27 | Armazenamento e backups | Parcial | Scripts PowerShell para dump PostgreSQL e ZIP de mídia, com restauração de banco; testes de restauração e backup externo pendentes |
| 28 | Monitoramento e contingência | Parcial | Health, doctor, telemetria FFmpeg, alertas e supervisor; redundância física pendente |
| 29 | Testes e validação | Parcial | 22 testes automatizados aprovados; integração PostgreSQL/Windows/OBS/SRT ainda pendente |
| 30 | Implantação e documentação | Parcial | Documentação e scripts; instalador e homologação de produção pendentes |

**Não considerar nenhum módulo parcial ou pendente como concluído.** A evolução deve preservar os módulos existentes e fechar cada lacuna com testes correspondentes.

## Central Playout

**Implementado:** seleção de canal/playlist, carregamento de fila, saída HLS via FFmpeg, controles PLAY/STOP/NEXT/PREVIOUS, URL com token temporário e execução de playlist pelo scheduler.

**Pendente:** PAUSE real no Windows, relógio e duração precisa, Preview/Program simultâneos com dois decoders, transições e homologação 24/7. Preview/TAKE, recuperação da sessão Program e overlay básico foram adicionados na 1.5.0.

## RTMP resiliente

Persistência de jobs, criptografia AES-256-GCM de destinos em repouso, recuperação configurável após reinício, heartbeat de progresso FFmpeg, watchdog de encoder, alertas via operation_logs/webhook e failover entre dois destinos RTMP estão implementados no backend. Dependem de migração PostgreSQL, segredo estável e teste em Windows/plataforma real. Não há failover de hardware ou internet.

## Atualização 1.4.0 — Programação automática e isolamento

- Dispatcher PostgreSQL para agendamentos uma vez/diários/semanais/mensais.
- Início de playlist no motor HLS do canal.
- Controles para pausar/reativar/excluir agendamento na API e interface.
- Rotas de canal protegidas por autenticação e escopo de tenant.
- Testes unitários de recorrência incluídos.

## Atualização 1.5.0 — módulos broadcast

- Comerciais inseridos automaticamente nas filas HLS e RTMP contínuas nos limites entre arquivos.
- Preview com player protegido por token e TAKE para Program.
- OBS WebSocket v5 com GetVersion, StartStream e StopStream.
- Grafismos e placar básico em overlay HTML transparente para Browser Source.
- Web TV pública com player HLS e gestão de publicação.
- Entrada SRT caller/listener para HLS, com segredo criptografado e recuperação no boot.
- Persistência/recuperação das filas HLS Program no PostgreSQL.
- Scripts PowerShell para instalação/preparação, backup e restauração de banco.
- 22 testes automatizados aprovados nesta entrega.

Esses recursos permanecem parciais até homologação com PostgreSQL, Windows, OBS, rede SRT, plataformas RTMP e restauração real de backup.
