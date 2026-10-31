# LLTV BRASIL WEB TV — Projeto Novo

**A CASA DAS LIGAS ALTERNATIVAS**

Este repositório é a base inicial executável da plataforma LLTV BRASIL WEB TV. Ele organiza o site público, API, banco de dados e infraestrutura inicial de streaming.

## O que já está incluído
- Interface pública responsiva com identidade preto, dourado e branco.
- Página inicial, player HLS, agenda e notícias demonstrativas claramente identificadas.
- API Node.js/Express com endpoints de saúde, programação, canais e notícias.
- Esquema PostgreSQL inicial.
- Docker Compose para PostgreSQL e serviço de ingestão RTMP (NGINX RTMP).
- Configuração de exemplo para variáveis de ambiente.
- Documentação de arquitetura e próximos passos.

## Requisitos
- Node.js 20+
- npm
- Docker Desktop (para banco e ingestão RTMP)
- OBS Studio para testar envio de sinal

## Executar a interface
```bash
cd frontend
npm install
npm run dev
```
Abra http://localhost:5173

## Executar a API
Em outro terminal:
```bash
cd backend
cp .env.example .env
npm install
npm run dev
```
API: http://localhost:8787/api/health

## Iniciar os serviços de infraestrutura
Na raiz do projeto:
```bash
docker compose up -d
```
PostgreSQL: localhost:5432  
RTMP ingest: rtmp://localhost:1935/live  
HLS: http://localhost:8080/hls/

> A configuração RTMP/HLS fornecida é para desenvolvimento e teste. Para produção, configure domínio, HTTPS, CDN, armazenamento persistente, autenticação de ingestão, limites de banda e monitoramento.

## Configurar o player
Defina `VITE_LIVE_STREAM_URL` no arquivo `frontend/.env` com uma URL HLS acessível pelo navegador, por exemplo `http://localhost:8080/hls/lltv.m3u8` após configurar o pipeline de geração HLS.

## Importante sobre o estágio
Este pacote é o **início técnico do Projeto Novo**, não uma emissora já publicada nem um serviço de streaming de produção. A transmissão pública 24h, autenticação completa, painel administrativo com persistência, transcodificação multiqualidade, CDN, pagamentos/publicidade e publicação em domínio dependem de implementação, credenciais e infraestrutura reais. Consulte `docs/ROADMAP.md`.


## Especificação integral de recursos
Consulte:
- `docs/PROJETO_MESTRE_COMPLETO.md` — escopo completo de todos os módulos e etapas.
- `docs/CONTROLE_DE_RECURSOS.md` — matriz transparente do que tem base técnica e do que ainda precisa ser implementado.
- `docs/API_CONTRATO.md` — contrato-alvo dos endpoints.
- `streaming/PRODUCAO_CHECKLIST.md` — requisitos para streaming público.

A atualização amplia o projeto para contemplar todos os recursos solicitados. Isso não significa que todos já estejam implementados: os itens pendentes estão identificados na matriz de controle. A infraestrutura de produção exige domínio, hospedagem, armazenamento, CDN e dimensionamento de tráfego.


## Catálogo dos 65 módulos
O projeto agora inclui catálogo centralizado com 65 módulos em nove áreas, painel inicial em `/admin` com busca e filtro por categoria e endpoint `GET /api/modules`. Consulte `docs/CATALOGO_65_MODULOS.md`. A interface é uma estrutura inicial de gestão; os fluxos CRUD, integrações, autenticação/autorização robustas, automações e operação em produção permanecem como etapas de desenvolvimento e testes.
