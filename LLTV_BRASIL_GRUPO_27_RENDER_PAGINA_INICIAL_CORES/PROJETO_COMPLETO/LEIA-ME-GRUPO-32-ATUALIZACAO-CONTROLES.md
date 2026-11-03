# LLTV Brasil — Grupo 32 (atualização dos controles de transmissão)

Esta atualização complementa o Grupo 32 existente com botões individuais na Central de Transmissão para ativar/desativar as informações exibidas no overlay.

## Controles adicionados
- Faixa de estatísticas
- Posse de bola
- Finalizações
- Escanteios
- Faltas
- Cartões
- Escalação do mandante
- Reservas do mandante
- Escalação do visitante
- Reservas do visitante
- Arbitragem
- Identificação do jogador
- Gerador de caracteres (GC)
- Equipe de narração/transmissão

Os botões alteram apenas a exibição; os dados cadastrados permanecem salvos. As mudanças são enviadas pelo estado compartilhado via Socket.IO, sem recarregar o OBS.

## Instalação
Extraia o ZIP e envie o conteúdo para a raiz do repositório GitHub, substituindo os arquivos correspondentes. Não envie a pasta externa que contém o projeto; envie o conteúdo interno. Faça o deploy no Render depois do commit.

## Verificações realizadas
- `node --check public/app.js`
- `node --check server.js`
- `node --check public/overlay.js`
- Integridade do ZIP

O deploy no Render e o teste visual dentro do OBS precisam ser realizados no ambiente de transmissão.
