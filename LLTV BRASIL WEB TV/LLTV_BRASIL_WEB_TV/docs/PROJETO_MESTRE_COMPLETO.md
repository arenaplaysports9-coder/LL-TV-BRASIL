# PROJETO MESTRE — LLTV BRASIL WEB TV
## A CASA DAS LIGAS ALTERNATIVAS

Este documento é a especificação central e obrigatória do Projeto Novo. Todos os módulos abaixo pertencem ao mesmo produto, compartilham identidade visual, autenticação, banco de dados, API e infraestrutura.

## 1. Produto e objetivos
Emissora esportiva digital, com site público, painel administrativo, ingestão de sinal OBS, distribuição de vídeo, canais, programação linear automatizada, conteúdo sob demanda, notícias, agenda esportiva, publicidade e análise de audiência.

## 2. Identidade visual
Usar a logo oficial fornecida. Paleta: preto `#050505`, dourado `#FFC400`, amarelo `#FFD700`, branco `#FFFFFF`, cinza `#171717`. Não redesenhar ou distorcer a logo. Interface responsiva, alto contraste, linguagem visual esportiva.

## 3. Ambientes e perfis
- Site público sem login para assistir e consultar conteúdo.
- Painel administrativo protegido.
- Central de operação de transmissão.
- Serviços de mídia/automação executados no servidor.
- Perfis: administrador principal, administrador, operador de transmissão, editor de notícias, programador, comercial/relatórios. Permissões por módulo e ação.

## 4. Site público — páginas e recursos
1. Início: destaque editorial, player ao vivo, próximos eventos, notícias, programas, canais, patrocinadores e chamadas para reprises.
2. TV ao vivo: player, status, canal, programa atual/próximo, qualidade, tela cheia e indicação AO VIVO.
3. Canais: catálogo, página individual, grade e histórico de cada canal.
4. Programação: grade diária/semanal, fuso horário, filtros por canal e categoria.
5. Agenda esportiva: competição, temporada, rodada, equipes, escudos, data, hora de Brasília e local, estádio, cidade, narrador, comentarista, capa, canal e estado do evento.
6. Notícias: categorias, tags, busca, matéria completa, autor e data.
7. Reprises/VOD: busca, filtros, duração, temporadas, competições e player.
8. Programas: apresentadores, equipe, periodicidade, episódios e reprises.
9. Sobre, contato, política de privacidade, termos e direitos de transmissão.
10. Páginas de patrocinadores e publicidade quando habilitadas.

## 5. Player e vídeo
- HLS como formato principal de reprodução web.
- Reprodução adaptativa quando houver renditions disponíveis.
- Controles: play/pause, volume, tela cheia, seleção de qualidade quando suportada, estado de carregamento e erro.
- Legendas/closed captions quando fornecidas.
- Compatibilidade testada em navegadores modernos, Android, iOS e navegadores de Smart TV compatíveis.
- Nunca expor chaves RTMP ou segredos no código do navegador.
- Player deve exibir fallback de manutenção/sem sinal, não simular transmissão ativa.

## 6. OBS Studio e ingestão
- Cadastro de canal e geração de chave individual.
- Exibir URL de servidor e chave somente a operadores autorizados.
- Ação de copiar URL/chave, rotacionar chave, revogar chave e testar sinal.
- Ingestão RTMP/RTMPS.
- Autenticação de publicação no servidor (callback/API ou gateway equivalente).
- Monitoramento de conexão, bitrate, resolução, FPS, início/fim e falhas.
- Separar ingestão privada da distribuição pública HLS.
- Suportar teste de sinal antes de colocar no ar.
- O painel não deve afirmar que iniciou OBS remotamente sem integração local/autorizada; pode fornecer configuração e monitorar ingestão.

## 7. Automação de programação 24/7
- Grade por canal com data/hora, duração, prioridade, recorrência e origem (arquivo, playlist ou evento ao vivo).
- Tipos: vídeo sob demanda, playlist, entrada ao vivo OBS, intervalo institucional e tela de espera.
- Worker de automação independente do navegador.
- Verificação de conflitos, sobreposição, lacunas e fuso horário.
- Prioridades configuráveis: emergência/ao vivo agendado > programa fixo > playlist > tela de espera.
- Iniciar/encerrar conteúdo, trocar fonte, registrar resultado e tentar recuperação após falha.
- Reinício automático do worker e recuperação de estado após reinicialização do servidor.
- Pré-visualização da grade e histórico de execução.
- Automação de playout exige motor de mídia/encoder e fontes acessíveis ao servidor; não é apenas um temporizador web.

## 8. Multicanal
Canais iniciais: LLTV BRASIL, LLTV FUTEBOL, LLTV FEMININO, LLTV BASE, LLTV INTERNACIONAL e LLTV OUTROS ESPORTES.
Cada canal possui slug, logo, descrição, status, ingestão, chave independente, player, grade, conteúdo, métricas e permissões. Permitir criar novos canais pelo painel. Concorrência depende de CPU, encoder, armazenamento, CDN e banda contratados.

## 9. Portal editorial
- CRUD de matérias com editor rico, imagem de capa, resumo, corpo, categoria, tags, autor e status.
- Rascunho, revisão, agendamento, publicação e arquivamento.
- SEO: slug, título e descrição para mecanismos de busca.
- Upload seguro e biblioteca de imagens.
- Histórico de alterações e registro de autor.

## 10. Agenda e eventos
- Cadastro de competições, temporadas, rodadas e partidas.
- Mandante/visitante, escudos, estádio, cidade, país, data/hora local, horário de Brasília, narrador, comentarista, capa, canal e link.
- Estados: agendado, ao vivo, encerrado, adiado e cancelado.
- Página pública do evento e botão assistir quando o canal estiver no ar.
- Importação/exportação CSV como recurso administrativo.

## 11. Biblioteca e VOD
- Upload direto ou integração com armazenamento de objetos.
- Metadados, capa, categoria, duração, direitos, visibilidade e estado de processamento.
- Transcodificação, thumbnails e geração HLS sob demanda.
- Busca, filtros, coleções e associação com programas/competições.
- Retenção, exclusão e controle de acesso.

## 12. Programas e episódios
Cadastro de programas, logotipo, capa, descrição, apresentador, equipe, periodicidade, horário, episódios, vídeos, temporadas e destaques na página inicial.

## 13. Publicidade e patrocínio
Cadastro de patrocinador, logo, banner, link, campanha, canal, posição, início/fim, prioridade e relatório de impressões/cliques.
Posições: home, páginas editoriais, páginas de canal, grade e áreas permitidas do player. Inserções no vídeo dependem de tecnologia de ad insertion e contratos; não prometer inserção automática sem integração.

## 14. Audiência e relatórios
Métricas agregadas: sessões de player, espectadores simultâneos estimados, visualizações, minutos assistidos, canal, programa, evento, origem e período. Painel com filtros, gráficos, exportação CSV e política de privacidade. Diferenciar sessões/players de pessoas únicas; não apresentar estimativas como contagem exata.

## 15. Administração e segurança
- Login, recuperação de senha e encerramento de sessão.
- MFA recomendado para administradores.
- RBAC por função e permissões.
- Hash de senha Argon2id/bcrypt; segredos fora do repositório.
- Proteção CSRF quando aplicável, rate limiting, validação de entrada e logs.
- HTTPS, CORS restrito, backups, monitoramento, auditoria.
- Rotação de chaves de ingestão e revogação imediata.
- Upload validado por tipo/tamanho e armazenamento fora da pasta pública.
- LGPD: aviso de privacidade, minimização, retenção e canal de contato.

## 16. Arquitetura recomendada
- Front-end: React/Next.js.
- API: Node.js/Express ou NestJS.
- Banco: PostgreSQL.
- Cache/fila: Redis quando necessário.
- Ingestão: RTMP/RTMPS.
- Motor de mídia: FFmpeg e/ou servidor de mídia especializado.
- Distribuição: HLS + CDN.
- Armazenamento: object storage compatível com S3.
- Observabilidade: logs centralizados, métricas e alertas.
- Worker: serviço separado para agendamento e playout.
- Ambientes: desenvolvimento, homologação e produção.

## 17. API — recursos previstos
- `/api/auth/*` autenticação e sessão.
- `/api/admin/users/*` usuários e permissões.
- `/api/channels/*` canais.
- `/api/streams/*` chaves, ingestão e status.
- `/api/schedule/*` grade e execução.
- `/api/broadcasts/*` eventos esportivos.
- `/api/news/*` matérias.
- `/api/media/*` biblioteca e VOD.
- `/api/shows/*` programas e episódios.
- `/api/sponsors/*` campanhas.
- `/api/analytics/*` audiência e relatórios.
- `/api/settings/*` configurações.
Todos os endpoints administrativos exigem autenticação e autorização no servidor.

## 18. Infraestrutura e publicação
- Domínio próprio e DNS.
- TLS/HTTPS.
- Hospedagem separada ou dimensionada para web/API e mídia.
- Banco com backup e recuperação.
- Armazenamento persistente.
- Servidor de ingestão e processamento.
- CDN para espectadores.
- Monitoramento e alertas.
- Plano de capacidade por resolução, bitrate, canais simultâneos e audiência.
- Plano de contingência e restauração.

## 19. Testes e critérios de aceite
- Fluxos de login e permissões.
- CRUD e persistência de todos os módulos.
- Publicação OBS com chave individual e chave revogada.
- Player reproduz HLS real e apresenta estado correto.
- Worker executa grade sem navegador aberto.
- Troca de conteúdo e recuperação após reinício.
- Testes simultâneos de espectadores e canais.
- Uploads, backups e restauração.
- Segurança, acessibilidade, responsividade e navegadores.
- Teste de carga e monitoramento.
- Aprovação final em homologação antes de produção.

## 20. Entregáveis
Código-fonte, migrations/schema, configuração de infraestrutura, arquivos Docker, documentação de instalação, manual do administrador, manual do operador OBS, manual de programação, variáveis de ambiente de exemplo, testes automatizados, plano de backup e checklist de publicação.

## 21. Etapas integradas de implementação
1. Fundação e repositório.
2. Banco e API.
3. Site público e identidade.
4. Autenticação e RBAC.
5. Painel administrativo.
6. Canais e ingestão OBS.
7. Player HLS.
8. Programação e worker 24/7.
9. Agenda esportiva.
10. Notícias.
11. Biblioteca/VOD.
12. Programas/episódios.
13. Publicidade.
14. Audiência/relatórios.
15. Segurança e LGPD.
16. Integração total.
17. Testes e carga.
18. Homologação.
19. Infraestrutura de produção.
20. Publicação.
21. Documentação, treinamento e entrega.

## 22. Regra de conclusão
O projeto só pode ser declarado concluído após implementação real, integração, testes e publicação de todos os módulos. Telas ilustrativas, dados de exemplo, endpoints sem persistência ou botões sem ação não contam como funcionalidade concluída.


## Catálogo dos 65 módulos
O projeto agora inclui catálogo centralizado com 65 módulos em nove áreas, painel inicial em `/admin` com busca e filtro por categoria e endpoint `GET /api/modules`. Consulte `docs/CATALOGO_65_MODULOS.md`. A interface é uma estrutura inicial de gestão; os fluxos CRUD, integrações, autenticação/autorização robustas, automações e operação em produção permanecem como etapas de desenvolvimento e testes.
