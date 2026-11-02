# LLTV Brasil – Placar Esportivo PRO v5.0

## Atualização v5.0
- Central geral com ativar/desativar individual para módulos e recursos.
- Ações ATIVAR TUDO, DESATIVAR TUDO e RESTAURAR PADRÃO. A desativação preserva os dados.
- Controles globais sincronizados com o overlay OBS para placar, relógio, estatísticas, escalações, GC, jogador, patrocinadores, escudos e informações da competição/rodada.
- Ativação individual de competições, times, jogos e equipes da Taça das Favelas.
- Aba de controles gerais permanece acessível mesmo quando outros módulos são desativados.
- Scripts VERIFICAR-NODE.bat e INSTALAR-DEPENDENCIAS.bat.
- Configuração inicial de implantação Render com disco persistente para a pasta data.

## Instalação local
1. Instale Node.js LTS pelo site oficial: https://nodejs.org/
2. Extraia o ZIP.
3. Se Node.js não estiver instalado, execute `INSTALAR-NODE-LTS.bat`; se o winget falhar, o script abre a página oficial do Node.js.
4. Execute `VERIFICAR-NODE.bat`.
5. Execute `INSTALAR-DEPENDENCIAS.bat` (ou `npm install`).
6. Execute `INICIAR-LLTV.bat` ou `npm start`.
7. Acesse `http://localhost:8787`.

## GitHub e Render
- Envie o conteúdo do projeto ao repositório GitHub, incluindo `package.json`, `package-lock.json` (gerado por `npm install`) e `render.yaml`.
- No Render, crie um Blueprint usando `render.yaml` ou crie um Web Service Node.
- Build Command: `npm install`; Start Command: `npm start`; Health Check: `/health`.
- O `render.yaml` configura disco persistente montado em `data`. O plano do Render precisa suportar disco persistente; sem ele, o arquivo JSON local não é armazenamento durável.
- Não envie `node_modules`, `.env`, tokens ou arquivos pessoais ao GitHub.

## Observações de implantação
Esta versão mantém a persistência JSON do projeto local em `data/match.json`. Para múltiplas instâncias, vários operadores simultâneos ou escala horizontal, será necessário migrar o estado para PostgreSQL e as imagens para armazenamento de objetos. O arquivo `render.yaml` utiliza um único serviço e disco persistente, adequado a uma implantação simples de instância única.

## Segurança
A versão atual não implementa autenticação administrativa multiusuário. Não exponha o painel publicamente sem adicionar login e proteção de acesso.

---

# LLTV Brasil – Placar Esportivo PRO v3.0

## Incluído nesta versão
- Central responsiva para computador e celular.
- Sincronização em tempo real por Socket.IO.
- Overlay transparente para OBS Studio (Fonte de Navegador).
- Placar, cronômetro, período e acréscimos.
- Escudos locais em imagem.
- Estatísticas: posse, finalizações, finalizações no gol, impedimentos, defesas, escanteios, faltas e cartões.
- Cadastro de 11 titulares por equipe (limite validado) e banco de reservas separado.
- Cores personalizadas para mandante e visitante, aplicadas atrás dos nomes no overlay.
- Upload local da logo do canal, exibida no painel e no placar do OBS.
- Período, relógio e acréscimos exibidos no overlay.
- Registro de substituições e ocorrências.
- Gerador de caracteres e identificação de jogador.
- Faixa de patrocinadores por texto.
- Cadastro manual de competições, temporada, organizador, modalidade, categoria, formato, número de equipes, pontuação, fases e grupos.
- Cadastro manual da Taça das Favelas por edição, região, ano, categoria, comunidade, equipe, responsável, grupo, status e atletas.
- Parâmetros configuráveis da Taça: limites de elenco, tamanho de grupo, jogos por equipe, classificados, pontuação, duração e critérios de desempate.
- Personalizador do placar: cores, posição, textos e exibição seletiva de competição, fase, escudos e relógio.
- Persistência local em `data/match.json`.
- Reinício de partida preservando identificação dos clubes e competição.

## Requisitos
Windows 10/11 64 bits e Node.js LTS instalado.

## Instalar e executar
1. Extraia o ZIP para uma pasta local.
2. Instale Node.js LTS.
3. Execute `INICIAR-LLTV.bat`.
4. O painel abre em `http://localhost:8787`.

## OBS Studio
Adicione uma Fonte de Navegador com:
- URL: `http://localhost:8787/overlay.html`
- Largura: `1920`
- Altura: `1080`

A página de overlay usa fundo transparente. Configure a posição e escala no OBS conforme a cena.

## Controle pelo celular
Conecte celular e computador à mesma rede Wi-Fi. O terminal informa o endereço LAN do computador, por exemplo `http://192.168.0.10:8787`. Abra esse endereço no navegador do celular. Se o Firewall perguntar, permita o Node.js somente em redes privadas.

## Plugin nativo do OBS
O diretório `native-plugin` agora contém o código C++ do dock LLTV, com atalhos para o painel e overlay, controles de iniciar/parar transmissão e gravação, salvar replay e indicadores de status. O dock é registrado pela API oficial `obs_frontend_add_dock_by_id` (OBS 30+).

**Atenção:** o ZIP inclui o código-fonte e o script `native-plugin/BUILD-WINDOWS.bat`, mas não uma DLL pré-compilada. Para gerar a DLL é necessário compilar no Windows com Visual Studio 2022, CMake 3.28+, SDK de desenvolvimento do OBS e Qt 6 compatível com a instalação. Consulte `native-plugin/README.md`. Execute primeiro `native-plugin/PREPARAR-AMBIENTE.bat`: ele instala Visual Studio 2022 Build Tools e CMake via winget e detecta automaticamente a versão instalada do OBS. Em seguida, `BUILD-WINDOWS.bat` verifica o SDK e compila. Atenção: a instalação comum do OBS não inclui necessariamente os headers, pacotes CMake e Qt do SDK; a detecção identifica a versão, mas não fabrica nem presume que o SDK esteja instalado. A integração utilizável imediatamente é a Central web via Fonte de Navegador do OBS.

## Limitações e segurança
- Dados e imagens ficam no computador que executa o servidor.
- Acesso pelo celular funciona apenas na mesma rede local.
- Não exponha a porta 8787 diretamente à internet.
- Não há API externa de estatísticas, sincronização em nuvem ou login multiusuário nesta versão.
- Faça backup periódico da pasta `data`.

## Iniciar sem janela preta (Windows 11)

Agora o servidor pode funcionar em segundo plano, sem manter uma janela de terminal aberta:

1. Dê dois cliques em `INICIAR-LLTV.bat` (ou `INICIAR-LLTV-OCULTO.vbs`).
2. O inicializador verifica se o servidor já está ativo, inicia o Node.js oculto e abre o painel em `http://localhost:8787`.
3. Os registros ficam em `data/server.log` e `data/server-error.log`.
4. Para encerrar, dê dois cliques em `PARAR-LLTV.bat`.

### Iniciar automaticamente com o Windows

Execute `INSTALAR-INICIALIZACAO-WINDOWS.bat` uma vez. O atalho será colocado na pasta Inicializar do Windows para iniciar o servidor em segundo plano quando você entrar na sua conta. Para desativar, execute `REMOVER-INICIALIZACAO-WINDOWS.bat`.

O computador precisa permanecer ligado para o painel funcionar no celular. O celular deve estar na mesma rede Wi-Fi. O firewall do Windows pode solicitar autorização para o Node.js; permita o acesso em redes privadas.

### Reiniciar o servidor sem janela preta
Execute `REINICIAR-LLTV.bat`. O processo encerra apenas o servidor LLTV desta pasta, aguarda a liberação da porta 8787 e inicia novamente em segundo plano. O painel será aberto no navegador quando o servidor estiver pronto. Se a porta estiver ocupada por outro programa, consulte `data/erro-reinicio.txt`.


## Regras e modelos esportivos
O módulo geral de competições é flexível: o operador cadastra manualmente o regulamento, formato, grupos, fases, pontuação e critérios de desempate de cada campeonato. Não fixa regras universais, pois cada federação/organizador publica seu Regulamento Geral e Regulamento Específico.

O formulário da Taça das Favelas parte como modelo editável com base no Regulamento Taça das Favelas Brasil 2026: categorias masculina e feminina; elenco de 18 a 22 atletas; grupos geralmente de quatro seleções, três jogos por seleção e oito melhores avançando para quartas, semifinal e final; vitória 3 pontos, empate 1; desempates por saldo, gols pró, menos cartões vermelhos, menos amarelos, confronto direto e sorteio. O documento também prevê jogos de 30 minutos por tempo e intervalo de 10 minutos como regra geral, com possíveis adequações. Regulamentos estaduais e edições locais podem alterar critérios, idades e formato, portanto os parâmetros ficam editáveis.

Referências consultadas:
- Regulamento Taça das Favelas Brasil 2026: https://tacadasfavelas.com.br/wp-content/uploads/2026/02/Regulamento-Taca-das-Favelas-2026.pdf
- Exemplo de inscrição regional e limite de elenco: https://tacadasfavelasceara.com.br/inscricoes/
- Princípios de estruturação de campeonatos e formatos: https://arena-site.sociofacil.app.br/central-de-campeonatos/como-organizar-um-campeonato-de-futebol


## Versão 4.0 — cadastro de times, jogos e classificação

### Cadastro de times
1. Cadastre uma competição na aba **Competições**.
2. Abra **Times** e escolha a competição.
3. Informe nome, sigla, cidade/comunidade, grupo, cor e escudo.
4. Clique em **Cadastrar time**. O cadastro fica salvo em `data/match.json`.

### Jogos e rodadas
1. Abra **Jogos e rodadas**.
2. Selecione a competição, fase, rodada, grupo, mandante e visitante.
3. Informe data, horário e estádio e clique em **Adicionar jogo à rodada**.
4. Para lançar o resultado, selecione o jogo, informe os gols e escolha o status.
5. Apenas jogos com status **Encerrado** entram no cálculo automático da classificação. W.O. mandante/visitante também pode ser lançado como status próprio; para que os pontos e gols do W.O. reflitam o regulamento específico, informe o placar administrativo e encerre o jogo.

### Tabela de classificação
- Selecione competição e, se necessário, fase e grupo.
- O modo automático calcula pontos, jogos, vitórias, empates, derrotas, gols pró, gols contra e saldo.
- Pontuação padrão: vitória 3, empate 1, derrota 0; os valores são editáveis.
- Critério automático padrão: pontos, vitórias, saldo de gols, gols pró e nome do time.
- No modo **Ordem manual**, use as setas ↑ e ↓ para enfileirar os times na ordem desejada.
- Use **Ajuste manual da equipe** para somar ou retirar pontos por decisão administrativa. O ajuste é registrado separadamente e pode ser removido.

### Dados e compatibilidade
Os novos dados são guardados no mesmo arquivo `data/match.json`. Antes de atualizar uma instalação existente, pare o servidor e faça cópia de segurança da pasta `data`. A atualização preserva os dados existentes; não substitua a pasta `data` por uma pasta vazia.


## Atualização 4.1 — placar editável diretamente na lista de jogos

Na aba **Jogos e rodadas**, cada confronto agora exibe o placar atual (inclusive 0 × 0) e dois campos numéricos para gols do mandante e do visitante.

- Edite os gols diretamente no cartão do jogo e clique em **Salvar placar**. O resultado fica gravado no cadastro daquele confronto e aparece na lista.
- Clique em **Enviar ao placar** para carregar os times, escudos, competição, rodada, estádio, data e o resultado salvo na tela principal do placar.
- O placar enviado à tela principal pode continuar sendo operado pelos controles normais do painel.
- Para que o resultado conte na classificação, altere o status para **Encerrado** no bloco Resultado / controle de jogo. Jogos agendados ou em andamento não contam na classificação.


## Overlay com fundo completo nas cores dos times (v5.1)
Na aba **Personalizar**, ative **Usar cores personalizadas no fundo completo dos times** e escolha uma cor para o mandante e outra para o visitante. As cores ocupam toda a área lateral do placar (escudo, nome, placar e espaços), enquanto o bloco central do cronômetro permanece separado. Salve para sincronizar com o OBS em tempo real. O botão **Restaurar cores padrão** usa as cores cadastradas para cada equipe.


## Atualização V5.2 – acabamento do overlay

- Mantém a dimensão e a estrutura original do placar.
- Mantém sem alterações o cronômetro/área central e os blocos laterais de competição e rodada.
- Completa o preenchimento visual somente nas áreas destinadas às equipes, respeitando as cores configuradas.
- Corrige a apresentação de escudos ausentes ou com caminho inválido: mostra um identificador CASA/FORA no espaço do escudo, sem ícone de imagem quebrada.
- Preserva a compatibilidade com OBS Studio por fonte de navegador.

Para aplicar no repositório existente, envie os arquivos deste Grupo 3 mantendo a estrutura `LLTV_Brasil_Placar_Pro/public/`.
