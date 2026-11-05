# LLTV PLAYOUT V1.0 — atualização integrada 1.4.0

## Entregue

1. Dispatcher automático de programação conectado ao PostgreSQL e ao motor HLS.
2. Recorrências única, diária, semanal e mensal.
3. Reivindicação transacional com `FOR UPDATE SKIP LOCKED` para reduzir risco de execução duplicada entre instâncias.
4. Controle de agendamento: listar, pausar, reativar e excluir.
5. Estado de execução e erro gravados no banco e em `operation_logs`.
6. Isolamento de canais: endpoints de listagem e criação agora exigem autenticação e aplicam escopo do tenant; criação exige owner/admin.
7. Interface de programação atualizada para exibir próxima execução, estado e ações.

## Validações executadas neste ambiente

- `node --test`: 17 testes aprovados, nenhum falhou ou foi ignorado.
- `node --check` em arquivos JavaScript do backend, scripts e desktop: aprovado.
- Teste real local do FFmpeg/HLS executado pela suíte: aprovado.
- PostgreSQL não está instalado/conectado neste ambiente; migração e dispatcher com banco real não foram executados.
- Dependências npm não estão instaladas nesta cópia; build React/Vite e integração ponta a ponta não foram executados.
- Windows 10/11 não foi usado para homologação.

## Instalação/atualização

No Windows, após extrair o projeto:

```powershell
npm install
Copy-Item .env.example .env
# Ajuste DATABASE_URL, JWT_SECRET e RTMP_SECRET_ENCRYPTION_KEY no .env
npm run db:migrate
npm test
npm start
```

Para a interface web, em outro terminal:

```powershell
cd apps/web
npm install
npm run build
npm run dev
```

## Limitações importantes

Esta versão continua sendo uma compilação de desenvolvimento. O scheduler inicia uma playlist HLS na hora programada, mas ainda não fornece grade broadcast sem lacunas, sessão HLS persistente após queda abrupta, fuso horário configurável por canal, automação de comerciais, Preview/Program completo, SRT, integração OBS bidirecional ou failover de infraestrutura. Não classificar como produto final nem operar em transmissão profissional sem homologação completa.
