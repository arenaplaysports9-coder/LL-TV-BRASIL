LLTV BRASIL — BROADCAST SYSTEM 1.5.0
====================================

ATUALIZAÇÃO 1.5.0 — PRIMEIRA ETAPA DA MIGRAÇÃO PARA PRODUÇÃO INDEPENDENTE

Esta versão inicia a preparação da LLTV Brasil para operar sem OBS Studio. A integração OBS WebSocket e a dependência obs-websocket-js foram removidas do produto. As rotas antigas /api/obs/* retornam HTTP 410 para informar que essa integração foi descontinuada.

O que foi atualizado nesta etapa:
- Removida a dependência npm obs-websocket-js.
- Removido o painel de conexão e controle do OBS na Central.
- Atualizados os textos do painel para identificar o overlay como recurso gráfico da LLTV Brasil.
- Mantido o placar, os dados existentes, o overlay, as estatísticas, a agenda de competições e a multitransmissão FFmpeg já existente.
- Mantido o endpoint gráfico /overlay.html para futura integração com o compositor próprio.
- Ampliados os testes de sintaxe dos arquivos JavaScript.

IMPORTANTE — O QUE AINDA NÃO ESTÁ IMPLEMENTADO
Esta atualização NÃO entrega ainda um mixer audiovisual próprio completo. O Preview/Programa continua sendo seleção visual no navegador; a câmera do navegador não é encaminhada automaticamente ao FFmpeg; ajustes de imagem não são filtros de composição da saída. Replay multicâmera, VAR, melhores momentos automáticos, WEB TV pública, aplicativo nativo e arquitetura SaaS ainda precisam ser desenvolvidos e testados em etapas posteriores. A multitransmissão FFmpeg atual continua aceitando as fontes compatíveis descritas abaixo.

INSTALAÇÃO / ATUALIZAÇÃO
1. Faça uma cópia de segurança da pasta da versão anterior, especialmente data/state.json, data/access-token.txt e data/secret.key.
2. Extraia esta versão em uma nova pasta.
3. Instale Node.js 18 ou superior.
4. Execute INICIAR_PLACAR.bat.
5. Abra o endereço do painel exibido no terminal.
6. Se já possuir dados de uma versão anterior, copie os arquivos de dados preservando os originais e mantenha juntos access-token.txt e secret.key para conseguir descriptografar destinos já armazenados.
7. Para a multitransmissão, instale FFmpeg e configure FFMPEG_PATH se necessário.

Atenção: não substitua sua pasta de produção sem backup. Teste primeiro esta versão em uma cópia. Esta entrega é uma etapa de migração, não uma plataforma SaaS pronta para comercialização.

----------------------------------------
DOCUMENTAÇÃO HISTÓRICA DA VERSÃO ANTERIOR
----------------------------------------

LLTV BRASIL — PLACAR DE FUTEBOL PARA OBS STUDIO
Versão 1.0.0 | Windows 10/11 | Node.js 18+

O QUE ESTA VERSÃO INCLUI
- Painel web em português.
- Overlay transparente para a fonte Navegador do OBS Studio.
- Controle de gols, cronômetro, períodos e cartões.
- Data, horário, competição, rodada, estádio e cidade.
- Upload de escudos (PNG/JPG/WebP/SVG, até 1 MB).
- Atualização entre painel e overlay por Server-Sent Events.
- Persistência das configurações em data/state.json.
- Acesso pelo celular na mesma rede, com token.
- Script de inicialização e instruções para instalar.

IMPORTANTE
Esta é uma integração por fonte de navegador e servidor local Node.js; não é um plugin nativo compilado do OBS Studio. Para uso em rede, o computador e o celular precisam estar na mesma rede Wi-Fi. Não exponha a porta 8787 diretamente à internet.

INSTALAÇÃO
1. Instale Node.js 18 ou superior a partir do site oficial: https://nodejs.org/
2. Extraia a pasta LLTV_BRASIL_PLACAR para um local permanente, por exemplo Documentos.
3. No Windows, dê dois cliques em INICIAR_PLACAR.bat.
4. A janela preta mostrará o link do painel com token e os endereços de rede.
5. Abra o link do painel mostrado na janela.
6. No OBS Studio, adicione uma fonte Navegador e use:
   http://127.0.0.1:8787/overlay.html
   Largura: 1920
   Altura: 1080
7. Para controlar pelo celular, conecte-o à mesma rede Wi-Fi e use o link de rede com /panel.html?token=... mostrado no terminal.

SEGURANÇA
- O token é criado na primeira execução e salvo em data/access-token.txt.
- Não compartilhe o link do painel/token publicamente.
- Se o firewall perguntar, permita apenas em redes privadas confiáveis.
- Não configure encaminhamento de porta no roteador.
- A página overlay é somente de leitura; o painel exige token para alterar dados.

RESOLUÇÃO DE PROBLEMAS
- Se a porta 8787 estiver ocupada, feche a outra aplicação ou altere PORT no ambiente antes de iniciar.
- Se o celular não conectar, confira se ambos estão na mesma rede e se o firewall permite Node.js na rede privada.
- Se a URL da fonte do navegador não carregar, confirme que a janela do servidor continua aberta.
- O programa não baixa Node.js automaticamente. A instalação do Node é feita uma única vez.
- As funções e arquivos devem ser testados no computador de destino antes de uma transmissão real.

DADOS
As informações da partida são salvas localmente em data/state.json.
Para fazer backup, feche o servidor e copie a pasta data.


INICIAR COM O WINDOWS SEM JANELA
1. Execute CONFIGURAR_INICIALIZACAO_AUTOMATICA.bat uma única vez.
2. Na próxima inicialização do Windows, o servidor do placar iniciará em segundo plano, sem janela preta aberta.
3. Para abrir o painel depois, execute ABRIR_PAINEL.bat ou acesse http://localhost:8787/panel.html no computador.
4. Para desativar, execute REMOVER_INICIALIZACAO_AUTOMATICA.bat.
Observação: o Node.js precisa estar instalado.

REINICIAR O SERVIDOR SEM REINICIAR O WINDOWS
1. Execute REINICIAR_SERVIDOR.bat.
2. Aguarde a mensagem de reinicio.
3. Atualize o painel no navegador com Ctrl+F5.
O script encerra o processo que estiver escutando na porta 8787 e inicia o servidor em segundo plano.

ACRÉSCIMO MANUAL
No painel, em Cronômetro > Acréscimo manual, defina os minutos e clique em Aplicar minutos. Use o botão Ativar/Desativar para mostrar ou ocultar automaticamente o acréscimo no overlay do OBS.

CORES DOS CLUBES
No painel, use os campos "Cor do mandante" e "Cor do visitante" para selecionar as cores principais que combinam com os escudos. As cores são salvas e aparecem automaticamente na prévia e no overlay do OBS.


ATUALIZAÇÃO 1.1 — MÓDULOS AVANÇADOS
- Mantém o placar, cronômetro, período, acréscimos, cores, escudos, cartões simples e persistência existentes.
- Acrescenta estrutura persistente para escalações/técnicos/titulares/reservas, substituições, estatísticas, patrocinadores, anúncios, arbitragem, equipe de transmissão e eventos.
- Os módulos estruturados podem ser editados pelo painel em JSON e são enviados aos overlays conectados em tempo real.
- Adiciona controles de visibilidade por módulo e validação da soma da posse de bola em 100%.
- O overlay continua com fundo transparente fora das áreas gráficas.
- A rota /api/token não entrega mais o token a visitantes sem autorização. Abra o painel pelo link completo impresso pelo servidor.

LIMITAÇÕES IMPORTANTES
Esta atualização não configura por si só hospedagem HTTPS, domínio, Cloudflare Tunnel, credenciais externas nem teste de acesso público pela internet. Portanto, não há URL pública HTTPS pronta neste ZIP. O endereço local é http://127.0.0.1:8787/overlay.html. Para OBS em outro computador/cidade, publique somente o overlay por um túnel HTTPS e mantenha o painel e APIs de controle protegidos; não exponha a porta 8787 diretamente. Configure e teste essa infraestrutura separadamente antes de usar ao vivo.
Os módulos avançados são campos estruturados editáveis em JSON; esta versão ainda não inclui formulários visuais completos para cada jogador/evento, temporizadores automáticos de aviso de substituição, alternância temporizada de patrocinadores/anúncios, nem renderização gráfica especializada para cada módulo. Os dados são persistidos e sincronizados, mas essas automações específicas não devem ser consideradas concluídas.
TESTES EXECUTADOS NESTA ATUALIZAÇÃO
- node --check em server.js, panel.js e overlay.js: aprovado.
- Inicialização local do servidor e GET /api/health: aprovado (HTTP 200).
- GET /overlay.html e /panel.html: aprovado (HTTP 200).
- GET /api/state somente leitura: aprovado (HTTP 200).
- GET /api/token sem autenticação: bloqueado (HTTP 403).
- Não foram realizados testes em OBS real, navegador de outro computador, túnel HTTPS, nem teste de reinicialização com dados de produção.

ATUALIZAÇÃO — CADASTRO MANUAL DOS MÓDULOS
=========================================
O painel agora possui campos de texto para preencher manualmente:
- Escalações / titulares
- Banco de reservas
- Substituições
- Equipe de arbitragem
- Equipe de transmissão

Use o botão "Salvar informações manuais" para salvar no servidor. Cada módulo tem seu próprio botão Ativar/Desativar, que controla somente a exibição no overlay e preserva os dados escritos. As alterações são sincronizadas com as fontes de navegador conectadas.

Os campos aceitam texto livre. Sugestão: use uma linha por jogador ou profissional e indique número, nome e função. Acesse o painel pelo endereço exibido no terminal e use a URL /overlay.html no OBS.

ATUALIZAÇÃO 1.2 — PATROCINADORES E ANÚNCIO EM L INVERTIDO POR PNG
=================================================================
PATROCINADORES
- Abra o módulo “Patrocinadores e anúncio em L — imagens PNG”.
- Informe o nome da marca, selecione um arquivo PNG e clique em “Adicionar patrocinador PNG”.
- É possível cadastrar até 10 patrocinadores por partida; cada PNG deve ter até 300 KB.
- Use “Ativar/Desativar” para mostrar ou ocultar todos os patrocinadores no overlay. Ocultar não apaga as imagens.
- “Remover” apaga somente o patrocinador escolhido; “Limpar lista” apaga a lista inteira após confirmação.

ANÚNCIO EM L INVERTIDO
- Envie um PNG para a faixa horizontal superior e outro PNG para a faixa vertical da lateral direita.
- Ajuste as dimensões em pixels e clique em “Salvar imagens e dimensões”.
- Use “Ativar anúncio em L” para exibir ou ocultar as duas áreas. A posição é superior/esquerda para a faixa horizontal e superior/direita para a faixa vertical.
- Os arquivos devem ser PNG com transparência onde desejado. A página do overlay permanece transparente fora das imagens e dos elementos gráficos.
- Cada PNG deve ter até 300 KB. A alteração é salva no servidor e sincronizada com os overlays conectados.


ATUALIZAÇÃO 1.2.0 — ACESSO MÓVEL
================================
- Abra http://localhost:8787/mobile.html no computador para acessar o gerador de links.
- Para celular na mesma rede Wi-Fi, use um endereço IP local mostrado pelo servidor ou pela página de acesso móvel. Não use localhost no celular.
- O link do painel exige o token mostrado na janela do servidor. Não compartilhe o token publicamente.
- A página mobile gera link seguro, permite copiar/compartilhar e apresenta QR Code (a imagem do QR depende de internet/serviço externo).
- Inclui manifest e service worker para PWA. A instalação PWA normalmente exige HTTPS ou localhost; em HTTP por IP local, utilize o site pelo navegador.
- Para configurar uma URL pública, defina LLTV_PUBLIC_URL com um domínio HTTPS no ambiente de execução. Essa variável apenas informa a URL; não cria hospedagem, DNS, HTTPS ou túnel automaticamente.
- Nenhum APK Android compilado acompanha este ZIP. A versão móvel entregue é web/PWA; não há link de APK falso.
- Acesso remoto pela internet exige hospedagem/proxy HTTPS seguro. Não exponha o servidor diretamente à internet sem uma camada de segurança.
- Porta padrão: 8787. Para mudar, defina PORT no ambiente.

OBSERVAÇÃO DE SEGURANÇA
======================
O token no link permite controlar o placar. Evite capturas de tela públicas com o token e reinicie o token em data/access-token.txt somente com o servidor parado; depois reinicie o servidor. O estado e as imagens são armazenados localmente em data/state.json.


CORREÇÃO DE TOKEN (versão atualizada)
------------------------------------
Ao abrir o painel no próprio computador por http://localhost:8787/panel.html, o painel pode recuperar o token localmente. A rota de token só o entrega a conexões de loopback (o próprio computador). Para abrir pelo celular ou por outro dispositivo, use o endereço seguro com ?token=... que aparece na janela do servidor. Não compartilhe esse link publicamente.

Se o painel já estiver aberto, feche a aba e abra novamente após reiniciar o servidor atualizado.


ATUALIZAÇÃO: Escalações e substituições agora possuem campos separados para Mandante e Visitante no painel. Os dois lados continuam controlados pelo botão de visibilidade do respectivo módulo.

NOVO MÓDULO — CENTRAL DE TRANSMISSÃO AO VIVO
Acesse pelo botão “Central de transmissão” no topo do painel ou diretamente em /central.html?token=SEU_TOKEN.
Consulte public/INSTRUCOES_CENTRAL_TRANSMISSAO.txt para recursos implementados e limitações técnicas.

ATUALIZAÇÃO 1.3.0 — INTEGRAÇÃO OBS WEBSOCKET
- A Central agora possui conexão real com OBS WebSocket 5.x (OBS Studio 28+), consulta de status, cenas, troca de cena, início/fim de transmissão e gravação.
- Instale as dependências com: npm install
- No OBS: Ferramentas > Configurações do servidor WebSocket, habilite o servidor, configure a porta (padrão 4455) e senha; informe os mesmos dados na Central.
- Para conectar ao OBS no mesmo computador, use 127.0.0.1. O processo Node.js deve estar no computador que alcança o OBS. Um painel hospedado em Render não consegue acessar 127.0.0.1 do computador do operador sem um agente local/túnel seguro.
- Os endpoints de estado mantêm compatibilidade com overlay público, mas removem chaves RTMP do estado público e do fluxo de eventos. A interface administrativa autenticada pode ler o cadastro de destinos.
- A conexão OBS é mantida em memória no processo Node.js e precisa ser refeita após reiniciar o servidor.
- A central ainda não implementa codificação independente horizontal+vertical, relay RTMP, mixer de múltiplas câmeras, gravação centralizada em servidor ou controle PTZ universal. Essas funções dependem de pipeline local (OBS/FFmpeg/MediaMTX) e hardware compatível.

- Chaves RTMP salvas no estado são criptografadas com AES-256-GCM em repouso. O segredo local fica em data/secret.key (ignorado pelo Git); em hospedagem, defina LLTV_SECRET_KEY com 64 caracteres hexadecimais e use armazenamento persistente/seguro. Faça backup protegido desse segredo: sem ele, credenciais criptografadas não poderão ser recuperadas.


PAINEL SEPARADO DE ESTATÍSTICAS
--------------------------------
Acesse /statistics.html?token=SEU_TOKEN para abrir o painel independente de estatísticas.
O painel usa o mesmo estado da partida, salva os dados em data/state.json e sincroniza via /api/state e /api/events.
No painel principal há um atalho “Painel de estatísticas”. Os valores são preenchidos manualmente pela equipe de produção; não são dados oficiais automáticos.


ATUALIZAÇÃO 1.4.0 — MULTITRANSMISSÃO FFmpeg LOCAL E AJUSTES DE MONITOR
====================================================================

NOVOS RECURSOS IMPLEMENTADOS
- A Central possui controles independentes de zoom, largura, altura e posição para o monitor PREVIEW e para o monitor PROGRAMA. Os ajustes de Preview não alteram os valores do Programa. “Ajustar à tela” e “Restaurar original” retornam os parâmetros do respectivo monitor.
- A Multitransmissão ganhou integração real com FFmpeg executado no mesmo ambiente Node.js: descoberta dos encoders listados e teste prático de codificação com padrão de vídeo; seleção manual/automática; início/parada do processo; status, tempo, bitrate/FPS quando informados pelo FFmpeg e trecho de log técnico.
- Encoders são apresentados somente quando passaram pelo teste de codificação deste ambiente. A presença de NVENC/QSV/AMF na lista de compilação não significa que a GPU/driver esteja disponível; o teste pode rejeitá-los.
- O processo FFmpeg não utiliza o OBS. O OBS WebSocket continua disponível separadamente.
- Destinos RTMP/RTMPS podem ser ativados/desativados individualmente. Chaves são removidas do estado público e criptografadas em repouso pelo mecanismo AES-256-GCM já existente.
- A parada encerra o processo FFmpeg iniciado pela plataforma.

COMO USAR A MULTITRANSMISSÃO NO WINDOWS 11
1. Instale FFmpeg com suporte aos codecs desejados e adicione a pasta que contém ffmpeg.exe ao PATH.
2. Feche e reabra o terminal para atualizar o PATH.
3. Inicie o projeto com INICIAR_PLACAR.bat ou npm start.
4. Abra Central de Transmissão e clique em DESCOBRIR ENCODERS. A lista mostra apenas encoders que passaram no teste de codificação do computador atual.
5. Selecione um encoder e clique em TESTAR ENCODER.
6. Cadastre um ou mais destinos RTMP/RTMPS, informe a URL base e a chave, e deixe ativados os destinos que receberão o sinal.
7. Selecione a fonte que o FFmpeg deve capturar: URL HTTP/RTMP/SRT, arquivo local ou dispositivo DirectShow. Para DirectShow, informe o nome exato do dispositivo de vídeo e, se necessário, o nome do dispositivo de áudio.
8. Configure resolução/FPS na seção de saída e clique INICIAR TRANSMISSÃO. Acompanhe o status e os logs. Use PARAR TRANSMISSÃO para encerrar.

LIMITAÇÕES TÉCNICAS IMPORTANTES DESTA VERSÃO
- A captura FFmpeg direta aceita URL de mídia compatível, arquivo local e dispositivos DirectShow do Windows. O stream de câmera capturado dentro de outra aba do navegador, arquivo selecionado no browser e conteúdo de iframe não são automaticamente encaminhados ao processo FFmpeg. Para isso é necessário implementar e configurar uma ponte WebRTC/WHIP/SRT/MediaMTX ou agente de captura dedicado.
- “Ajustes de imagem” nesta entrega controlam os monitores visuais da Central; ainda não são filtros de composição aplicados ao sinal de saída FFmpeg.
- A descoberta de encoder valida a capacidade de codificar um padrão local, mas não garante a disponibilidade de todos os drivers, a estabilidade em carga prolongada, a largura de banda nem a aceitação do destino RTMP. Faça teste privado antes de uma transmissão pública.
- A saída multi-destino usa uma codificação e replica o fluxo para os destinos configurados. Destinos com exigências de resolução/formato diferentes podem exigir pipelines separados.
- O painel principal ainda não recebe uma prévia de vídeo ao vivo compartilhada entre dispositivos. A prévia local permanece no navegador da Central; compartilhar vídeo real entre módulos/dispositivos exige transporte de mídia (WebRTC/MediaMTX), não apenas sincronização de estado.
- Render pode não ter FFmpeg, dispositivos de captura, GPU ou aceleração de hardware. Esta função deve ser executada em um computador local Windows/Linux com FFmpeg instalado. Em Render, defina FFMPEG_PATH apenas se o binário estiver realmente instalado e acessível no serviço. Não coloque chaves RTMP em variáveis públicas, logs ou repositório.

CONFIGURAÇÃO
- Consulte .env.example para variáveis opcionais.
- No Windows, se FFmpeg não estiver no PATH, defina FFMPEG_PATH para o caminho completo, por exemplo C:\ffmpeg\bin\ffmpeg.exe.
- Em ambiente hospedado, defina LLTV_SECRET_KEY com 64 caracteres hexadecimais aleatórios e preserve o mesmo valor entre deploys. Sem a chave original, destinos já criptografados não podem ser descriptografados.
- O processo que executa o servidor Node precisa permanecer ligado durante a multitransmissão.

ATUALIZAÇÃO NO RENDER
1. Faça backup de data/state.json e preserve LLTV_SECRET_KEY. Não envie data/access-token.txt, data/secret.key, chaves RTMP ou arquivos .env reais ao Git.
2. Atualize o repositório GitHub conectado ao serviço Render com os arquivos desta versão.
3. No Render, abra o serviço e faça Manual Deploy > Deploy latest commit (ou aguarde o deploy automático da branch conectada).
4. Configure as variáveis necessárias no Environment e confirme que o build/start command executa npm install e npm start conforme o projeto.
5. O Render hospeda o painel, mas a codificação deve ficar no computador local se o serviço não tiver FFmpeg e hardware adequados. Não presuma GPU no Render.
6. Após o deploy, teste /api/health, placar, overlay e painel de estatísticas. A multitransmissão deve ser testada no agente local que possui FFmpeg e as fontes de vídeo.

TESTES DESTA ENTREGA
- node --check server.js e scripts JS: aprovado.
- npm test: aprovado.
- Inicialização local do servidor e GET /api/health: HTTP 200.
- Descoberta real de encoders FFmpeg no ambiente de teste: libx264 e libx265 passaram no teste; NVENC/QSV não foram considerados disponíveis para codificação utilizável neste ambiente. Os resultados podem variar conforme computador, drivers e build do FFmpeg.
- Não foi realizado envio a destino RTMP real, nem teste com câmera DirectShow física, OBS físico ou serviço Render do usuário.
