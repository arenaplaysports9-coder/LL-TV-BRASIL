# Dispatcher automático de programação

## Escopo implementado nesta atualização

- Dispatcher inicia junto com a API e consulta horários vencidos em intervalo configurável (`SCHEDULER_POLL_MS`, padrão 10 segundos).
- Agendamentos `once`, `daily`, `weekly` e `monthly` são calculados em UTC, preservando o horário da execução.
- O dispatcher utiliza transação PostgreSQL e `FOR UPDATE SKIP LOCKED` para evitar que duas instâncias reivindiquem simultaneamente a mesma linha.
- A playlist é carregada no motor HLS do canal vinculado e o comando PLAY inicia o FFmpeg.
- A programação permite pausar/reativar e excluir agendamentos pela API e interface.
- Falhas são registradas no agendamento e em `operation_logs`.
- `npm run scheduler:run-once` permite disparo manual de verificação (requer dependências instaladas e PostgreSQL disponível).

## Rotas

- `POST /api/schedule` — cria agendamento.
- `GET /api/schedule` — lista grade e estado.
- `PATCH /api/schedule/:id` — recebe `{ "enabled": true|false }`.
- `DELETE /api/schedule/:id` — remove (owner/admin).

## Instalação/atualização

1. Execute `npm install` na raiz.
2. Configure `.env` e PostgreSQL.
3. Execute `npm run db:migrate` para aplicar as colunas e índices novos.
4. Inicie `npm start`.
5. Consulte `GET /api/health` e os logs da API para confirmar a inicialização do dispatcher.

## Limitações que permanecem

- O dispatcher agenda o início de uma playlist HLS no canal; ainda não é um sistema completo de grade broadcast com transições sem intervalo, eventos de duração fixa, override manual, prioridade de emergência ou Preview/Program.
- A recorrência mensal usa regra de mesmo dia do mês com ajuste para o último dia quando necessário (ex.: dia 31 em fevereiro).
- A data/hora é persistida em UTC. A interface converte a data local do navegador para ISO UTC, mas ainda não oferece seleção explícita de fuso horário por canal.
- A conclusão do item final não atualiza automaticamente o status do agendamento; o status indica que o dispatcher iniciou a sessão, não que toda a playlist foi assistida.
- A recuperação de um processo de playout HLS após queda abrupta da API ainda precisa de um supervisor persistente de sessões HLS, distinto do supervisor RTMP.
- A integração precisa ser validada com PostgreSQL e FFmpeg no Windows de destino antes de produção.
