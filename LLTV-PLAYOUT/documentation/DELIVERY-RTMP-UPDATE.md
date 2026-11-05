# Atualização — publicação RTMP/RTMPS

## Implementado nesta entrega

- Painel RTMP/RTMPS na Central Playout, integrado à biblioteca de vídeos.
- API autenticada para iniciar, listar e parar jobs por tenant.
- Resolução da mídia pelo ID do asset no banco; não é aceito caminho de arquivo arbitrário pela nova interface.
- Validação de protocolo, host, caminho, resolução, FPS, bitrate e preset de codificação.
- Comando FFmpeg H.264/AAC/FLV com leitura em tempo real, mapeamento opcional de áudio e perfis de CPU.
- Metadados públicos do job não incluem a URL completa nem a chave de transmissão.
- Limites padrão de concorrência: 1 job por tenant e 2 jobs globais, configuráveis por ambiente.
- Documentação operacional, API, segurança e limites atualizada.

## Validações realmente executadas

- `npm test`: 9 testes aprovados, 0 falhas, 0 ignorados.
- `node --check` em todos os arquivos JavaScript de backend e testes: aprovado.
- Parser TypeScript usado apenas para validar a sintaxe JSX de `apps/web/src/main.jsx`: aprovado, zero diagnósticos.
- FFmpeg local: protocolos RTMP e RTMPS presentes; encoders libx264 e AAC presentes.
- Saída HLS real do motor anterior: coberta pelo teste de integração automatizado e aprovada.

## Não testado / limitações

- Não foi feita publicação para YouTube/Facebook ou servidor RTMP externo; isso exige chave e destino válidos do usuário.
- PostgreSQL, autenticação real, isolamento multi-tenant ponta a ponta e navegador/Windows ainda precisam ser testados no ambiente de instalação.
- A interface não foi empacotada em build Vite porque as dependências do frontend não estão instaladas neste ambiente; JSX foi validado sintaticamente.
- Publica um arquivo por job e termina ao final do arquivo. Sem repetição de playlist, scheduler, reconexão automática, failover, ingest SRT ou monitoramento de confirmação do provedor.
- A chave RTMP transita no corpo da requisição e nos argumentos do processo FFmpeg. Use HTTPS; usuários administradores locais podem inspecionar argumentos de processo. Não há cofre de segredos nesta versão.
- O Celeron N3350 pode não codificar HD em tempo real. Comece em SD/HD, 25 FPS, bitrate conservador e preset ultrafast.
