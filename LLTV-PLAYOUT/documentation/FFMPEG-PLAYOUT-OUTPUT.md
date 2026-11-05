# Motor FFmpeg — saída HLS do Playout

## Implementado nesta atualização

- A Central de Playout carrega a fila com o caminho físico dos arquivos já cadastrados na biblioteca.
- PLAY inicia um processo FFmpeg independente por canal e lê a mídia em tempo real (`-re`).
- A saída de vídeo é convertida para HLS (`index.m3u8` + segmentos MPEG-TS), dentro de `PLAYOUT_OUTPUT_ROOT/<canal>`.
- A playlist HLS e os segmentos são entregues por uma URL-capability com token aleatório de 192 bits, efêmero e gerado ao carregar a fila, para permitir leitura por VLC/OBS sem cabeçalhos de autenticação. O token perde validade quando a fila é recarregada ou a API reinicia.
- NEXT/PREVIOUS encerram o item atual e iniciam o item selecionado na fila; ao concluir um vídeo, o motor avança automaticamente para o próximo.
- STOP encerra o processo atual. O estado e os erros do processo ficam disponíveis no snapshot do console.
- Os processos são iniciados sem `shell`, com `windowsHide`, caminho limitado a `MEDIA_ROOT` e identificador de canal validado.

## Perfil padrão econômico

- Resolução: usa a resolução cadastrada no canal; se indisponível, HD.
- FPS: 25 (`PLAYOUT_FPS`).
- Bitrate: 2.500 kb/s (`PLAYOUT_BITRATE_KBPS`).
- Encoder: H.264 `ultrafast` (`PLAYOUT_PRESET`), áudio AAC 96 kb/s.
- HLS: segmentos de 4 segundos, lista de 8 segmentos.

Para o notebook Intel Celeron N3350, recomenda-se começar em SD ou HD com 25 FPS e bitrate baixo. A codificação H.264 por CPU pode sobrecarregar esse equipamento; não há garantia de desempenho em tempo real. 1080p/4K devem ser usados apenas em hardware capaz.

## Como abrir a saída

1. Carregue uma playlist e pressione PLAY.
2. Aguarde a criação dos primeiros segmentos HLS.
3. Use o endereço exibido pela Central de Playout (playlist `index.m3u8`) em VLC ou como fonte de mídia no OBS. A URL contém um token aleatório temporário de acesso; não a publique em locais abertos. Ela deixa de funcionar ao recarregar a fila ou reiniciar a API.

## Limitações conhecidas

- PAUSE é suportado por sinal de suspensão apenas em sistemas POSIX; no Windows a API retorna uma mensagem explícita de não suporte. STOP e PLAY reiniciam o item atual.
- A saída HLS é independente da publicação RTMP/RTMPS de arquivo único, documentada em `RTMP-PUBLISHING.md`. A Central ainda não envia sua fila HLS diretamente para RTMP.
- Áudio isolado não é aceito pelo motor de playout de vídeo nesta versão.
- Não há ainda watchdog persistente, recuperação após reinício da API, persistência de estado, controle de ganho, normalização de loudness ou aceleração GPU.
- O diretório HLS não deve ser publicado diretamente; sirva os arquivos apenas pela rota com token temporário.
- A integração ponta a ponta com PostgreSQL e navegador/OBS precisa ser testada no Windows do usuário.

## Configuração

Copie os campos de `.env.example` para `.env` e ajuste `FFMPEG_PATH`, `MEDIA_ROOT`, `PLAYOUT_OUTPUT_ROOT`, `PLAYOUT_FPS`, `PLAYOUT_BITRATE_KBPS` e `PLAYOUT_PRESET` conforme a instalação.
