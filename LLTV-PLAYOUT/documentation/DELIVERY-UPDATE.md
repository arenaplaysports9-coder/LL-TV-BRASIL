# Atualização de desenvolvimento — interface integrada

Esta revisão evolui a interface web de uma página de status para um painel administrativo navegável com:
- Visão geral e indicadores.
- Login e primeiro cadastro de tenant/owner.
- Cadastro/listagem de canais.
- Upload e listagem de mídias.
- Criação/listagem de playlists.
- Registro/listagem de agendamentos.
- Cadastro/listagem de campanhas comerciais.
- Painel de métricas básicas e jobs FFmpeg.

Os formulários usam as APIs existentes. O painel exibe avisos explícitos onde há apenas cadastro e ainda não há automação de execução (scheduler/comerciais). A central Preview/Program, player HLS, gráficos, placar e integração OBS continuam pendentes conforme o status dos módulos.

## Atualização — Console de Playout (transporte lógico)
- Criada a Central Playout no dashboard com seleção de canal e playlist, carregamento de fila, NOW PLAYING e comandos PLAY/PAUSE/STOP/NEXT/PREVIOUS.
- Criada API autenticada por canal para carregar fila e comandar transporte, validando vínculo entre canal, playlist e tenant.
- Criado serviço de estado de sessão em memória e testes unitários do fluxo de transporte.
- Limitação explícita: o console ainda não controla a reprodução audiovisual real nem o FFmpeg. O estado de sessão é volátil e reinicia junto com o backend. A integração do transporte com o motor audiovisual é a próxima etapa.

## Atualização — motor FFmpeg e saída HLS

A Central de Playout agora chama um serviço FFmpeg por canal para reproduzir arquivos de vídeo em tempo real e produzir uma saída HLS local autenticada. A fila contém os caminhos de mídia, o motor valida que os arquivos estejam dentro de MEDIA_ROOT, cria playlist e segmentos MPEG-TS, avança automaticamente quando um arquivo termina e oferece STOP/NEXT/PREVIOUS. O endereço HLS aparece na Central.

Limites: PAUSE não está disponível no Windows nesta versão; áudio isolado não é aceito; a publicação RTMP/RTMPS de arquivo único foi adicionada em atualização posterior; a reprodução precisa ser validada no computador-alvo e com o OBS/player usado. O perfil padrão foi reduzido para HD/25 FPS/2.500 kb/s/ultrafast, mas o Celeron N3350 pode não sustentar essa codificação em tempo real.


## Atualização 1.3.1 — diagnóstico e prontidão operacional

- Adicionado `npm run doctor` para verificar Node.js, FFmpeg/FFprobe, pastas graváveis, segredos e PostgreSQL/tabelas essenciais.
- Separados os endpoints `/api/health/live` (liveness) e `/api/health` (readiness com banco, schema e armazenamento).
- Supervisor Windows passou a consultar o endpoint de liveness para não reiniciar a API apenas porque o banco está temporariamente indisponível.
- Incluída documentação de instalação e homologação no Windows 10/11.
- Validação nesta sessão: `npm test` com 13/13 aprovados; `node --check` nos arquivos alterados. A execução do doctor depende das ferramentas e serviços instalados no ambiente-alvo.
