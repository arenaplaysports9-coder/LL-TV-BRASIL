# Persistência, recuperação e contingência RTMP

## Recursos desta etapa

1. **Persistência PostgreSQL:** cada publicação contínua é registrada em `rtmp_stream_jobs`, com tenant, playlist, estado, tentativas, heartbeat, erros e horários. O histórico é consultado por `GET /api/playout/rtmp/history`.
2. **Recuperação após reinício:** com `RTMP_RECOVER_ON_START=true`, a API procura jobs que estavam `starting`, `running` ou `reconnecting`, reconstrói a fila a partir da playlist e tenta iniciar novamente usando o mesmo ID do job.
3. **Monitoramento do encoder:** FFmpeg emite progresso a cada cinco segundos. O supervisor acompanha `out_time`, FPS, bitrate e speed. Se não houver heartbeat dentro de `RTMP_PROGRESS_TIMEOUT_MS`, o processo é encerrado e entra no fluxo limitado de reconexão.
4. **Alertas:** eventos de reconexão, falha e recuperação são gravados em `operation_logs`. Opcionalmente, `PLAYOUT_ALERT_WEBHOOK` recebe POST JSON. O webhook é best-effort; falha de entrega não interrompe o playout.
5. **Failover de destino:** a publicação contínua aceita `failoverUrl` opcional. Depois de esgotar as tentativas do destino principal, o supervisor troca uma vez para o destino alternativo e aplica novamente o limite de tentativas.
6. **Supervisor Windows:** foram adicionados scripts PowerShell para iniciar a API em segundo plano, verificar `/api/health` periodicamente, reiniciar a API se ela travar ou encerrar e registrar logs. Um instalador opcional cria uma tarefa agendada no logon do usuário. O shutdown controlado marca jobs como recuperáveis; a API pode reabri-los na próxima inicialização.

## Configuração necessária

Aplique o schema atualizado:

```bash
npm run db:migrate
```

No `.env`, gere uma chave de 32 bytes (64 caracteres hexadecimais) e mantenha-a estável e protegida:

```env
RTMP_SECRET_ENCRYPTION_KEY=64_caracteres_hexadecimais
RTMP_RECOVER_ON_START=true
RTMP_PROGRESS_TIMEOUT_MS=60000
RTMP_RECONNECT_RETRIES=3
PLAYOUT_ALERT_WEBHOOK=
```

Exemplo de geração da chave:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

**Não perca nem troque `RTMP_SECRET_ENCRYPTION_KEY`:** sem a mesma chave, destinos persistidos não podem ser descriptografados e a recuperação falha de forma segura. Não coloque o `.env` no GitHub. Faça backup seguro da chave separado do banco.

## Como configurar contingência

Na Central de Playout, informe o destino RTMP/RTMPS principal e, opcionalmente, um destino de contingência. Ambos devem aceitar o mesmo sinal codificado. A aplicação não verifica a disponibilidade comercial do destino antecipadamente; só tenta o alternativo depois de falhas do processo/conexão percebidas pelo FFmpeg.

## Supervisor do Windows 10/11

Execute PowerShell como administrador (se a política local exigir) e rode `scripts\install-lltv-startup-task.ps1`. A tarefa inicia o supervisor no logon do usuário atual. Para testar manualmente: `powershell -NoProfile -ExecutionPolicy Bypass -File scripts\lltv-supervisor.ps1`. Os logs ficam em `storage\logs`. Para remover a tarefa, rode `scripts\remove-lltv-startup-task.ps1`. O supervisor monitora a API local; não monitora diretamente o estado de ingestão da plataforma nem substitui UPS, redundância de internet ou servidor secundário.

## Limitações e segurança

- A recuperação é automática somente se PostgreSQL estiver acessível, o schema tiver sido migrado, a mídia continuar no mesmo caminho, a playlist continuar válida e a chave de criptografia estiver disponível.
- A verificação de saúde usa o progresso do FFmpeg, não uma confirmação independente de ingestão/visualização do YouTube ou Facebook.
- O failover é para um segundo destino RTMP, não para um segundo computador/servidor de playout. Se a máquina, energia ou internet local cair, este mesmo servidor não consegue continuar transmitindo.
- O webhook não possui fila de entrega garantida nem repetição independente.
- A URL com chave precisa ser entregue ao processo FFmpeg. Portanto, além da criptografia em repouso no PostgreSQL, restrinja acesso ao computador, usuários do sistema, logs e inspeção de processos. Use HTTPS para a interface/API.
- A recuperação automática fica desativada por padrão (`RTMP_RECOVER_ON_START=false`) até o operador aplicar a migração, configurar e guardar a chave de criptografia.
- Transmissões reais em plataformas externas, reconexão sob perda real de internet e failover ponta a ponta ainda precisam de teste controlado.
