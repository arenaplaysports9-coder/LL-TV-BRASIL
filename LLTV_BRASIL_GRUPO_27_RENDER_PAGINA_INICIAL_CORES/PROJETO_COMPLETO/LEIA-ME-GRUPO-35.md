GRUPO 35 — CORREÇÃO DEFINITIVA DOS CONTROLES DE VISIBILIDADE DO OVERLAY
LLTV BRASIL — atualização integrada ao projeto existente

OBJETIVO
Corrigir a sincronização dos botões ATIVAR/DESATIVAR da Central de Transmissão com os elementos exibidos no Overlay do Placar no OBS.

CORREÇÕES APLICADAS
1. Os controles de Placar principal, faixa de estatísticas, GC, identificação de jogador e escalações sincronizam também o estado de visibilidade correspondente.
2. Titulares e reservas do mandante e visitante continuam independentes. Ao desativar um bloco, ele desaparece; o contêiner de escalações permanece somente se algum dos quatro blocos estiver ativo.
3. A página do Overlay recebe nova versão de cache (overlay.js?v=35), evitando que o OBS continue usando o JavaScript antigo armazenado em cache.
4. Mantida a comunicação de estado existente por Socket.IO e a estrutura dos Grupos anteriores.

ARQUIVOS ALTERADOS
- public/app.js
- public/overlay.html

IMPORTANTE SOBRE O TESTE
Este pacote foi preparado a partir do ZIP do Grupo 34 disponível nesta conversa. A correção sincroniza os estados e atualiza a versão do script do Overlay. Como o OBS e o Render não estão conectados para execução nesta sessão, o teste final em transmissão real precisa ser feito após a implantação.

COMO INSTALAR
1. Faça uma cópia de segurança do repositório atual.
2. Extraia este ZIP.
3. No GitHub, substitua os arquivos correspondentes:
   - lltv34/public/app.js (use o conteúdo do app.js atualizado)
   - lltv34/public/overlay.html (use o conteúdo do overlay.html atualizado)
   Se o repositório não tiver a pasta lltv34, envie os dois arquivos para a pasta public/ que contém o app.js e overlay.html do serviço atual.
4. Faça commit e aguarde o Render concluir o deploy.
5. No OBS, abra Propriedades da Fonte de Navegador do Overlay e atualize a página. Se necessário, feche e reabra a fonte.
6. Teste cada botão ATIVAR/DESATIVAR na Central de Transmissão e confira o resultado no Overlay.

TESTE RECOMENDADO
- Desativar Placar principal: placar principal e mini placar devem sumir.
- Ativar Placar principal: deve reaparecer o modo selecionado.
- Desativar Posse de bola: somente a informação de posse deve sumir.
- Desativar Faixa de estatísticas: toda a faixa deve sumir.
- Desativar Titulares do mandante: somente os titulares do mandante devem sumir.
- Desativar Reservas do mandante: somente os reservas do mandante devem sumir.
- Repetir os dois testes para o visitante.
- Desativar GC, identificação, arbitragem, transmissão e patrocinadores individualmente.

NÃO CRIAR OUTRO SERVIÇO OU REPOSITÓRIO. Esta é uma atualização do projeto LLTV Brasil existente.
