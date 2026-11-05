# Plano de testes

## Automatizados disponíveis
- Validação de resolução não permitida.
- Validação de protocolo de destino.

Execute `npm test`.

## Validação manual inicial
1. `npm install` sem erros.
2. PostgreSQL saudável via Docker.
3. `npm run db:migrate`.
4. `npm run dev` e GET `/api/health`.
5. Criar canal e listar canais.
6. Verificar rejeição de arquivo fora de MEDIA_ROOT.
7. Em endpoint RTMP de teste, iniciar e parar job.
8. Testar frontend com API desligada e ligada.

## Antes de produção
Testes de carga por canal, soak test 72h+, perda de rede, queda de FFmpeg, reinício de máquina, disco cheio, permissões, autenticação, isolamento multi-tenant, backups e restauração, sincronismo A/V, latência e qualidade em todas as resoluções.
