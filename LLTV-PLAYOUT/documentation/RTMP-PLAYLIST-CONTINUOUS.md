# Publicação RTMP contínua por playlist

## Disponível nesta atualização

- Endpoint autenticado `POST /api/playout/rtmp/start-playlist`.
- Seleção de uma playlist pertencente ao tenant autenticado e ao seu canal.
- Validação de que todos os itens são vídeos e que os caminhos estão dentro de `MEDIA_ROOT`.
- Arquivo temporário FFconcat criado pelo backend; os caminhos são gerados a partir dos registros da biblioteca, não enviados pelo navegador.
- FFmpeg usa concat demuxer, `-stream_loop -1`, H.264/AAC e saída FLV para RTMP/RTMPS.
- A playlist repete continuamente até o operador pressionar Parar.
- Se o processo FFmpeg encerrar inesperadamente, o supervisor tenta reiniciá-lo com espera progressiva de 1, 2, 4... segundos, respeitando `RTMP_RECONNECT_RETRIES` (padrão 3; permitido 0 a 10).
- O estado do job informa número de vídeos e tentativas; URL completa/chave não é incluída no retorno público.
- A tela Central Playout permite escolher entre arquivo único e playlist contínua.

## Configurações

```env
RTMP_RECONNECT_RETRIES=3
MAX_RTMP_JOBS_PER_TENANT=1
MAX_RTMP_JOBS_GLOBAL=2
```

## Limitações importantes

- A repetição é realizada pelo concat demuxer. Para evitar falhas na transição, prefira vídeos com codecs, resolução, taxa de quadros e parâmetros de áudio compatíveis; o FFmpeg recodifica a saída, mas entradas muito diferentes podem produzir descontinuidades ou falha de leitura.
- As reconexões são reinícios do processo FFmpeg, não uma garantia de recuperação de rede. Não há ainda detecção de confirmação de ingestão do YouTube/Facebook, failover entre destinos ou alerta de queda para o operador.
- A persistência e recuperação pós-reinício foram adicionadas na etapa seguinte; veja `RTMP-RESILIENCE-PERSISTENCE.md` e aplique as configurações antes de habilitar.
- A chave RTMP é passada ao FFmpeg em argumento de processo e permanece em memória durante o job. O banco guarda apenas o destino criptografado. Use HTTPS e proteja o acesso administrativo ao Windows.
- Não foi testada uma transmissão real para uma plataforma externa nesta entrega.
- Para notebooks modestos, iniciar em SD, 25 FPS, 1.500–1.800 kb/s e preset `ultrafast`. HD/Full HD/4K dependem da capacidade de CPU, GPU e rede.
