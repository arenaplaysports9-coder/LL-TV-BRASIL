LL TV BRASIL — VERSÃO 2.5.0

INSTALAÇÃO LOCAL
1. Instale Node.js 18 ou superior.
2. Extraia a pasta do projeto.
3. Copie .env.example para .env e preencha os segredos necessários.
4. Execute npm start (ou INICIAR_PLACAR.bat no Windows).
5. Acesse http://localhost:8787/.
6. O token administrativo local é gerado na primeira execução e exibido no terminal. Guarde-o em local seguro.

TESTES
Execute npm test para validar a sintaxe dos arquivos JavaScript.

SEGURANÇA
- Nunca publique .env, data/secret.key, data/access-token.txt, data/state.json ou data/saas.json.
- Em Render/X10 configure LLTV_SECRET_KEY como variável persistente e use armazenamento persistente para os dados.
- Configure HTTPS, credenciais oficiais da Meta/Asaas e permissões no painel do provedor.
- Não inclua chaves de API no GitHub ou no navegador.

NOVOS PAINÉIS
- /whatsapp-admin.html — integração WhatsApp Business.
- /asaas-admin.html — integração Asaas.
- /gestao-admin.html?token=TOKEN — dashboard financeiro, despesas, chamados, auditoria e backup.
- /atendimento.html — atendimento autenticado do cliente.

IMPORTANTE
O pacote não contém credenciais da Meta ou Asaas. A integração real exige credenciais próprias e templates aprovados pela Meta. A fila automática depende de processo sempre ativo e armazenamento persistente. Consulte VERSAO_2.5.0_FINALIZACAO_MODULOS.txt para limitações que ainda exigem configuração ou desenvolvimento adicional antes de produção.

VERSÃO 2.6.0 — SEGURANÇA E AUTOMAÇÃO
Consulte VERSAO_2.6.0_SEGURANCA_AUTOMACAO.txt e .env.example.
A central de configuração fica em /seguranca-automacao.html?token=SEU_TOKEN_ADMIN.
O 2FA administrativo é obrigatório por padrão. No primeiro acesso, configure o aplicativo autenticador nesta central e confirme o código para ativá-lo. Depois da ativação, envie x-lltv-otp nas chamadas administrativas.
Backups externos automáticos exigem armazenamento WebDAV e credenciais configuradas no ambiente. O worker diário depende do processo Node permanecer ativo.

CENTRAL DE AGENDAMENTO — VERSÃO 2.7.0
Acesse /agendamento.html pelo botão “Central de Agendamento” no painel.
O acesso administrativo utiliza o mesmo token e a política de 2FA já configurada.
Para OAuth YouTube, cadastre Client ID, Client Secret e Redirect URI na central e configure a mesma URI no Google Cloud. Em produção, configure LLTV_PUBLIC_URL com HTTPS e mantenha LLTV_SECRET_KEY estável entre deploys.
A criação de eventos YouTube exige API habilitada, OAuth autorizado, canal elegível e cota disponível. Os outros destinos aparecem como pendentes até que suas APIs oficiais e permissões sejam validadas; não são simulados.
O agendador não inicia remotamente o OBS do computador. Para início automático de sinal é necessário agente local integrado ao OBS WebSocket ou distribuição RTMP em infraestrutura ativa.

VERSÃO 2.8.0 — INTEGRAÇÕES MULTIPLATAFORMA
A Central contempla YouTube, Facebook, Instagram, TikTok, Twitch, X, LinkedIn e Kick.
Cadastre as credenciais no Painel e use Testar integração. Para as plataformas com
validação de identidade implementada, o teste consulta a API oficial e registra a conta
quando o token/escopos são aceitos. Isso não garante permissão de LIVE ou agendamento.
A criação nativa de eventos ao vivo já existente nesta versão continua implementada para
YouTube. Nos demais destinos, use somente os recursos liberados oficialmente e RTMP
quando a plataforma permitir. Consulte VERSAO_2.8.0_INTEGRACOES_MULTIPLATAFORMA.txt.
