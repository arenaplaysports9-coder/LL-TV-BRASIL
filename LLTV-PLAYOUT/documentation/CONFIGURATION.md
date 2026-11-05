# Configuração

Variáveis principais em `.env`:

- `PORT`: porta HTTP da API (padrão 4000).
- `HOST`: endereço de bind (padrão 127.0.0.1; não altere sem configurar firewall/autenticação).
- `DATABASE_URL`: conexão PostgreSQL.
- `DATABASE_SSL`: ativa SSL com validação de certificado.
- `FFMPEG_PATH`: executável FFmpeg ou caminho absoluto.
- `MEDIA_ROOT`: raiz permitida para arquivos de entrada.
- `CORS_ORIGIN`: origens web autorizadas, separadas por vírgula.

Resoluções cadastráveis: SD 720×480, HD 1280×720, FULL_HD 1920×1080 e UHD_4K 3840×2160. O motor atual usa H.264/AAC por CPU. A resolução 4K exige hardware, banda e armazenamento adequados; não significa que o computador seja capaz de codificar em tempo real.
