# Publicação RTMP/RTMPS — LLTV PLAYOUT V1.0

## O que está implementado

- A Central de Playout oferece um painel para publicar um vídeo da biblioteca em um destino RTMP ou RTMPS.
- A API valida que a mídia pertence ao tenant autenticado e que seu tipo é vídeo.
- A URL de publicação precisa usar `rtmp://` ou `rtmps://`, com host, aplicação e chave/caminho completos. Usuário/senha embutidos e fragmentos são rejeitados.
- O FFmpeg recebe o arquivo em tempo real (`-re`), mapeia vídeo e áudio quando disponível, escala para SD/HD/Full HD/4K e codifica H.264 + AAC em FLV.
- Presets de CPU disponíveis: `ultrafast`, `superfast`, `veryfast`, `faster`, `fast` e `medium`. O padrão é `ultrafast`.
- Jobs são listados e encerrados somente dentro da conta proprietária. O padrão limita a 1 publicação simultânea por tenant e 2 no servidor (ajustável por `MAX_RTMP_JOBS_PER_TENANT` e `MAX_RTMP_JOBS_GLOBAL`). A resposta pública mostra host e nome da mídia, nunca devolve a URL completa nem a chave.
- A chave é enviada via HTTPS em produção e não é persistida pelo backend. Evite capturas de tela do formulário ou logs HTTP que gravem corpos de requisição.

## Como usar

1. Cadastre/importar um vídeo na Biblioteca de Mídias.
2. Abra **Central Playout → Saída RTMP/RTMPS**.
3. Selecione o vídeo e informe a URL de publicação fornecida pela plataforma (servidor + chave).
4. Comece com SD ou HD, 25 FPS, 1.500–2.500 kb/s e preset `ultrafast`.
5. Pressione **Iniciar publicação RTMP** e acompanhe o estado do processo.
6. Pressione **Parar** para encerrar a publicação.

A publicação é de um arquivo único: termina quando o vídeo chega ao fim. O recurso ainda não combina a fila do Playout HLS com RTMP, não repete playlist e não reconecta automaticamente após queda de rede.

## API

- `GET /api/playout/rtmp/jobs` — lista os jobs da conta autenticada.
- `POST /api/playout/rtmp/start` — inicia publicação. JSON: `mediaAssetId`, `outputUrl`, `resolution`, `fps`, `bitrateKbps`, `preset`.
- `POST /api/playout/rtmp/stop/:jobId` — encerra um job pertencente à conta autenticada.

Requer JWT válido e papel `owner`, `admin` ou `operator` para iniciar/parar.

## Segurança e limites

- Não cole a chave de transmissão em chamados, chats públicos ou documentação.
- Em produção, use HTTPS/TLS, proteja o acesso ao painel e não registre o corpo do endpoint de início nos logs de proxy.
- O processo FFmpeg precisa acessar a internet e o destino deve aceitar RTMP/RTMPS.
- O serviço usa `spawn` sem shell; a URL é passada como argumento de processo e pode ser visível a administradores locais via ferramentas de inspeção de processos do sistema operacional.
- Não há ainda armazenamento seguro de segredos, criptografia de chave em repouso, monitoramento de ingest do provedor, failover, watchdog persistente ou agendamento contínuo.
- Evite executar RTMP e HLS simultaneamente no mesmo notebook. O notebook Intel Celeron N3350 pode não conseguir codificar HD em tempo real. Use SD/HD, preset ultrafast e bitrate baixo; valide CPU, temperatura e estabilidade no computador de operação.

## Testes

Os testes unitários verificam validação de destino, caminho de mídia, parâmetros de codificação e construção dos argumentos FFmpeg. Uma transmissão real depende de uma chave válida e de um endpoint RTMP/RTMPS externo e não é simulada pelos testes locais.
