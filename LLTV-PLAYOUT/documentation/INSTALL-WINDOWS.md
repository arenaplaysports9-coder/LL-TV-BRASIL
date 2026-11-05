# Instalação no Windows 10/11

1. Instale Node.js 20 LTS ou superior.
2. Instale Git.
3. Instale Docker Desktop e aguarde o serviço iniciar.
4. Instale FFmpeg e adicione `bin` ao PATH (ou configure `FFMPEG_PATH`).
5. Extraia o ZIP em uma pasta de trabalho, por exemplo `C:\LLTV-PLAYOUT`.
6. Copie `.env.example` para `.env`. Altere `DATABASE_URL` e `POSTGRES_PASSWORD` para senhas fortes e iguais.
7. Abra Prompt de Comando na pasta e execute `scripts\setup-windows.bat`.
8. Execute `scripts\start-database.bat`.
9. Execute `npm run db:migrate`.
10. Execute `npm run dev`.
11. Em outro terminal: `cd apps\web`, `npm install`, `npm run dev`.
12. Acesse o endereço exibido pelo Vite; API: `http://127.0.0.1:4000/api/health`.

## Desktop Electron (opcional)

Em `apps\desktop`, execute `npm install` e `npm start`, mantendo a API e a interface web em execução. Configure `LLTV_WEB_URL` se a interface estiver em endereço diferente.
