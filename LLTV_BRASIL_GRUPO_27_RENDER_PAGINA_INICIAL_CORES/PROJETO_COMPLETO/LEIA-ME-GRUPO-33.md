# LLTV Brasil Placar Pro — Grupo 33

## Correção funcional dos controles individuais do overlay

Este grupo parte do Grupo 32 atualizado e corrige a aplicação das opções da Central de Transmissão no `overlay.html`.

### O que foi corrigido
- Cada opção de estatística controla sua própria informação; a faixa geral também pode ser ocultada.
- Titulares e reservas do mandante e visitante são controlados separadamente. Os títulos correspondentes também desaparecem.
- Arbitragem e equipe de transmissão são ocultadas pelo respectivo controle.
- GC, identificação do jogador, placar, cronômetro, logos, escudos, nomes, competição, rodada e patrocinadores respeitam os controles de exibição.
- O overlay recalcula a visibilidade a cada atualização recebida pelo Socket.IO.
- Os dados cadastrados permanecem salvos; somente a exibição é alterada.
- Cache do service worker versionado e scripts com versão `v=33` para reduzir o risco de carregar arquivos antigos.

## Instalação
1. Faça backup do repositório atual.
2. Extraia este ZIP.
3. Envie o conteúdo diretamente para a raiz do repositório GitHub, mantendo as pastas `public`, `server` e `data`.
4. Faça o deploy no Render.
5. No navegador do painel e na fonte Browser do OBS, atualize/recarregue para obter os arquivos da versão 33. Se o painel estiver instalado como PWA, feche e abra novamente após o deploy.

## Verificações executadas
- `node --check public/app.js`
- `node --check public/overlay.js`
- `node --check server.js`
- Integridade do ZIP após geração.

Não foi possível executar deploy no Render nem teste visual dentro do OBS nesta sessão. A confirmação final depende do deploy e da atualização da fonte Browser.
