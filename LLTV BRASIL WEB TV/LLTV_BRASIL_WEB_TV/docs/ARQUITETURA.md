# Arquitetura da LLTV BRASIL WEB TV

Visitante → Front-end React → API Node/Express → PostgreSQL

OBS Studio → Ingestão RTMP → Processamento/transcodificação → HLS → CDN → Player público

A programação linear deve ser executada por um serviço worker independente da interface web. O worker seleciona a fonte de mídia ou evento ao vivo, controla o encoder e atualiza o estado da programação na API.

## Ambientes
- Desenvolvimento: Docker local.
- Homologação: infraestrutura isolada para testes.
- Produção: domínio, TLS, banco gerenciado, mídia e CDN.

## Segurança mínima para produção
- Nunca expor chaves de ingestão no navegador público.
- Armazenar senhas somente com hash forte (Argon2id/bcrypt).
- Usar autenticação e autorização no back-end.
- Restringir CORS e endpoints administrativos.
- Validar uploads e limitar tamanho/tipo.
- Usar HTTPS e segredos fora do repositório.
