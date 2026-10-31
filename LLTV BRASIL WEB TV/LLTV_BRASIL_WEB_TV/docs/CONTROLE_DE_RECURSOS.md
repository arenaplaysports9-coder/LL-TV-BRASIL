# Controle de recursos e andamento

| Módulo | Escopo definido | Base técnica incluída | Implementação/validação pendente |
|---|---:|---:|---:|
| Identidade e site público | Sim | Sim | Ajustes e testes |
| Player HLS | Sim | Base inicial | Integração com sinal real |
| API e PostgreSQL | Sim | Base inicial | CRUD, validações e migrations |
| Painel administrativo | Sim | Não completo | Construção integral |
| Login e permissões | Sim | Schema inicial | Implementação e testes |
| OBS/RTMP(S) | Sim | Gateway de desenvolvimento | Autenticação e monitoramento |
| Programação 24/7 | Sim | Especificação | Worker e motor de playout |
| Multicanal | Sim | Schema e catálogo inicial | Operação simultânea |
| Agenda esportiva | Sim | Schema | CRUD e páginas públicas |
| Notícias | Sim | API de leitura inicial | Editor e CRUD |
| Biblioteca/VOD | Sim | Schema | Upload, transcode e player |
| Programas/episódios | Sim | Schema | CRUD e páginas |
| Publicidade | Sim | Schema | Gestão e medição |
| Audiência | Sim | Schema | Coleta, dashboards e relatórios |
| Segurança/LGPD | Sim | Diretrizes | Implementação e auditoria |
| Produção/CDN/domínio | Sim | Arquitetura | Contratação e configuração |
| Testes/documentação | Sim | Documentação inicial | Testes e manuais finais |

**Legenda:** “Base técnica incluída” não significa módulo concluído em produção. A coluna pendente deve ser encerrada com evidências de teste.


## Catálogo dos 65 módulos
O projeto agora inclui catálogo centralizado com 65 módulos em nove áreas, painel inicial em `/admin` com busca e filtro por categoria e endpoint `GET /api/modules`. Consulte `docs/CATALOGO_65_MODULOS.md`. A interface é uma estrutura inicial de gestão; os fluxos CRUD, integrações, autenticação/autorização robustas, automações e operação em produção permanecem como etapas de desenvolvimento e testes.
