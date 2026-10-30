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
