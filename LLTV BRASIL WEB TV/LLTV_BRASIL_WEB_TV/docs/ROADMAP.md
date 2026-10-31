# Plano de implementação e conclusão

Este plano mantém as etapas no mesmo Projeto Novo.

## Fase A — Base técnica (incluída neste pacote)
- Estrutura do repositório.
- Interface pública inicial.
- API inicial.
- Esquema PostgreSQL.
- Docker Compose.
- Gateway RTMP/HLS de desenvolvimento.

## Fase B — Administração real
- Login seguro com hash de senha e sessão/JWT.
- CRUD completo de canais, programação, partidas e notícias.
- Upload de imagens e vídeos para armazenamento persistente.
- Perfis e permissões.
- Auditoria administrativa.

## Fase C — Operação de televisão
- Serviço de automação em segundo plano.
- Playlist linear e troca automática de conteúdo.
- Regras de prioridade para eventos ao vivo.
- Retomada após reinicialização.
- Monitoramento de falhas e alertas.

## Fase D — Streaming de produção
- Autenticação de publicação OBS por chave individual.
- FFmpeg/transcodificação e perfis de qualidade.
- HLS segmentado e armazenamento.
- CDN e HTTPS.
- Proteção contra hotlink/abuso e limites de ingestão.
- Teste de carga e estimativa de banda.

## Fase E — Conteúdo e monetização
- Notícias e agenda com CRUD completo.
- Biblioteca VOD.
- Programas e episódios.
- Patrocinadores e inventário de publicidade.
- Métricas e relatórios de audiência.

## Fase F — Publicação
- Domínio e DNS.
- Hospedagem de aplicação.
- Banco gerenciado e backups.
- Servidores de mídia e CDN.
- Monitoramento, logs e alertas.
- Teste de aceitação e documentação operacional.

## Critérios de aceite
- O OBS publica com credencial individual.
- O player público reproduz o sinal externo.
- O agendador inicia e encerra itens no horário correto.
- A grade continua operando sem navegador aberto.
- Dados administrativos persistem no PostgreSQL.
- O sistema recupera serviços após reinício.
- O site funciona em celular, computador e Smart TV compatível.

## Dependências externas para produção
Domínio, hospedagem, servidor/CDN, armazenamento, orçamento de tráfego e credenciais administrativas. O pacote não cria contas nem contrata infraestrutura.
