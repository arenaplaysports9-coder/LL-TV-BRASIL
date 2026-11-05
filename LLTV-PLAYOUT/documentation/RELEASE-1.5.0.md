# Release 1.5.0 — oito frentes integradas

## Implementado nesta versão

1. **Comerciais:** campanhas ativas entram nas filas HLS e RTMP contínuas por intervalo configurado, no limite entre arquivos.
2. **Preview/Program:** preview de vídeo por URL-capability e TAKE para o motor HLS; fila Program persistida e recuperada no boot.
3. **OBS Studio:** autenticação OBS WebSocket v5, GetVersion, StartStream e StopStream.
4. **Grafismos/placar:** dados persistidos e overlay HTML transparente com tarja e placar básico para Browser Source.
5. **Web TV:** configuração de publicação, listagem pública e página player HLS.
6. **Entrada ao vivo SRT:** caller/listener para HLS SD/HD, URL criptografada no PostgreSQL e recuperação controlada após reinício.
7. **Recuperação:** recuperação de sessões HLS, RTMP e SRT; exige banco, mídia, FFmpeg e segredo estável.
8. **Backups/instalação:** preparação Windows via PowerShell, dump PostgreSQL, ZIP de mídia e script de restauração do banco.

## Validação executada no ambiente de desenvolvimento

- `node --check` nos arquivos JavaScript do backend e scripts: aprovado.
- Parser JSX TypeScript: 0 diagnósticos de sintaxe.
- `node --test`: 22/22 testes aprovados.
- FFmpeg HLS real com vídeo de teste: coberto por teste automatizado.
- Protocolo SRT listado em `ffmpeg -protocols`: encontrado.
- JSON do package: validado.
- Integridade do ZIP: validada na geração do pacote.

## Não homologado neste ambiente

PostgreSQL real e migração aplicada; build Vite (dependências npm não instaladas); Windows 10/11; conexão e controle OBS real; entrada SRT real através da rede; publicação em YouTube/Facebook; restauração de backup; operação contínua prolongada; desempenho no Celeron N3350. O projeto não deve ser declarado pronto para produção até essas verificações.
