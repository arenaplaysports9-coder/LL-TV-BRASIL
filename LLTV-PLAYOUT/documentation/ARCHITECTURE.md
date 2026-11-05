# Arquitetura

## Visão geral

- `apps/web`: interface React/Vite.
- `apps/desktop`: shell Electron isolado, sem Node integration no renderer.
- `apps/player`: futuro player público.
- `backend`: API Express, PostgreSQL e controle de processos FFmpeg.
- `streaming-engine`: documentação e evolução do motor audiovisual.
- `database`: schema SQL.
- `storage`: diretório local de mídia e logs.
- `docker`: espaço para serviços auxiliares futuros.

## Fluxo atual

React/Electron → API HTTP Express → PostgreSQL.
API → serviço FFmpeg (`spawn`, `shell:false`) → destino RTMP.
A API de saúde verifica conexão com o banco. O status dos jobs é mantido em memória; reiniciar o backend perde o inventário dos processos em execução.

## Decisões e limites

A API escuta por padrão em `127.0.0.1`, reduzindo exposição acidental. O endpoint de transmissão não deve ser exposto sem autenticação. A execução em CPU com libx264 é a única rota codificadora incluída. GPU e H.265 ainda não foram implementados.
