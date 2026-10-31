# Checklist de streaming para produção

- [ ] Definir domínio de ingestão e distribuição.
- [ ] Configurar RTMPS/TLS na borda de ingestão.
- [ ] Implementar autenticação de publicação por chave individual.
- [ ] Guardar somente hash/segredo protegido; nunca publicar chaves no front-end.
- [ ] Configurar limites de bitrate, resolução, conexões e tempo.
- [ ] Configurar transcodificação multi-bitrate e áudio.
- [ ] Configurar HLS com segmentos e playlists consistentes.
- [ ] Configurar CDN, cache e CORS restrito aos domínios oficiais.
- [ ] Configurar armazenamento persistente e política de retenção.
- [ ] Monitorar ingestão, encoder, origem, CDN e player.
- [ ] Testar falha de origem, reconexão e troca para sinal de contingência.
- [ ] Testar carga real com audiência prevista.
- [ ] Validar direitos de transmissão e permissões de cada conteúdo.

A configuração NGINX RTMP incluída é somente um gateway local de desenvolvimento. Não exponha diretamente à internet sem hardening, autenticação e TLS.
