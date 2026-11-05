# Streaming Engine

O primeiro serviço de transcodificação RTMP está implementado em `backend/src/services/ffmpeg.js`. Nesta fase, o processo aceita arquivo local dentro de `MEDIA_ROOT`, escala para SD/HD/Full HD/4K e codifica H.264/AAC via CPU (`libx264`).

Pendências: seleção real de encoder GPU (NVENC/QSV/AMF com detecção de hardware), H.265, SRT, HLS segmentado, áudio avançado, presets por canal, preview/program, transições e supervisão persistente de processos.
