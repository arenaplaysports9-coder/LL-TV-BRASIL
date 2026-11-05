# Revisão de segurança da versão integrada

- JWT com validade de 8 horas e bcrypt cost 12 para senhas.
- Requer segredo JWT de 32 caracteres.
- Middleware de papéis básico.
- Upload limitado por tamanho e lista MIME; MIME informado pelo cliente não comprova o conteúdo.
- FFmpeg usa spawn sem shell e limita entrada ao diretório MEDIA_ROOT.
- API permanece em localhost por padrão.

**Pendências antes de qualquer exposição externa:** autenticação nas rotas legadas, rate limiting, CSRF quando houver cookies, TLS, gestão de segredos, antivírus, validação por magic bytes, quotas por tenant, trilha de auditoria, política de retenção, revisão de isolamento multi-tenant, rotação/revogação de tokens, MFA, proteção contra abuso e testes de penetração.
