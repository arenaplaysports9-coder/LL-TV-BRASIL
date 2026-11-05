# Pré-instalação e diagnóstico — Windows 10/11

Esta etapa acrescenta verificações de prontidão antes de colocar o LLTV PLAYOUT em operação. Não substitui um teste real de transmissão.

## Requisitos
- Windows 10/11 64 bits.
- Node.js 20 ou superior e npm.
- PostgreSQL acessível pela `DATABASE_URL`.
- FFmpeg e FFprobe instalados e disponíveis no PATH, ou caminhos absolutos em `FFMPEG_PATH` e `FFPROBE_PATH`.
- Permissão de leitura/escrita nas pastas `MEDIA_ROOT` e `PLAYOUT_OUTPUT_ROOT`.

## Preparação
1. Extraia o ZIP em uma pasta local, por exemplo `C:\LLTV-PLAYOUT`.
2. Copie `.env.example` para `.env` e configure banco, `JWT_SECRET` e `RTMP_SECRET_ENCRYPTION_KEY`.
3. Abra PowerShell na pasta do projeto e execute `npm install`.
4. Execute `npm run doctor`. O comando verifica versões, binários, pastas, segredos e conexão/tabelas do PostgreSQL.
5. Se necessário, execute `npm run db:migrate`.
6. Execute novamente `npm run doctor` e depois `npm start`.

## Endpoints de saúde
- `GET /api/health/live`: confirma somente que o processo HTTP está respondendo; é o endpoint usado pelo supervisor.
- `GET /api/health`: readiness; verifica PostgreSQL, tabelas essenciais e gravação nas pastas. Retorna HTTP 503 se algum requisito estiver indisponível.

## Limitações e segurança
- O diagnóstico não valida credenciais de plataformas RTMP nem garante largura de banda, estabilidade elétrica ou internet.
- Não exponha `.env`, logs com dados sensíveis ou portas administrativas diretamente à internet.
- Use uma chave de criptografia estável e faça backup seguro; perder `RTMP_SECRET_ENCRYPTION_KEY` impede descriptografar destinos RTMP salvos.
- O supervisor monitora a API, não substitui redundância de servidor/rede.
- A homologação final exige teste no computador Windows de destino, com PostgreSQL, FFmpeg e uma transmissão privada/não listada.
