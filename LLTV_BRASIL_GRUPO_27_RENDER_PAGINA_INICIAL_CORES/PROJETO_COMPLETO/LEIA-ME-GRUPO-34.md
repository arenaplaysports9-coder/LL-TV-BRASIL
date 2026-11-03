# LLTV Brasil — Grupo 34: Central de Notícias integrada

Esta atualização parte do ZIP do Grupo 33 recebido nesta conversa e adiciona a Central de Notícias ao mesmo servidor Express, ao mesmo repositório e à mesma aplicação LLTV Brasil.

## O que foi incluído
- Link **Central de Notícias** na navegação do painel principal.
- Painel administrativo em `/noticias/admin`.
- Portal público em `/noticias`.
- Editor de notícias com título, subtítulo, texto, categoria, autor, competição, clube, fonte, tags, imagem, legenda e crédito.
- Fluxo de rascunho, revisão, agendamento e publicação.
- Busca e gerenciamento de matérias e categorias.
- Upload de capa em PNG, JPG, WEBP ou GIF (máximo 8 MB).
- Persistência em `data/news.json` e `data/news-uploads/`.
- Endpoints REST `/api/news` e `/api/news/upload`.
- Health endpoint identifica a versão `5.34-grupo34`.

## Como testar localmente
1. Faça uma cópia de segurança do projeto atual.
2. Extraia o conteúdo do ZIP na raiz do repositório, preservando as pastas.
3. Execute `npm install` se necessário.
4. Configure `NEWS_ADMIN_TOKEN` no ambiente (obrigatório em `NODE_ENV=production`).
5. Execute `npm start`.
6. Acesse `http://localhost:8787/noticias/admin` para administrar e `http://localhost:8787/noticias` para visualizar o portal.

## Render
- Configure `NEWS_ADMIN_TOKEN` nas Environment Variables.
- O diretório `data/` precisa estar em disco persistente no Render para preservar matérias e imagens entre deploys. Sem disco persistente, o armazenamento local do serviço pode ser perdido em novo deploy/recriação.
- O painel administrativo solicita o token quando a API responde 401; o token fica no armazenamento local do navegador. Não compartilhe o token.

## Integração e limites desta versão
- O módulo está integrado ao servidor e à navegação do projeto existente, sem criar outro servidor ou repositório.
- A Central de Notícias mantém cadastro próprio de matérias e categorias. Campos de clube/competição aceitam referência textual; a vinculação por ID às estruturas internas de clubes, competições e partidas requer uma etapa posterior de integração com os cadastros específicos existentes.
- Não inclui publicação automática em redes sociais, envio de newsletter, comentários públicos, analytics de terceiros ou geração de texto por IA. Esses recursos dependem de APIs, credenciais e decisões adicionais.
- O sistema atual não tinha autenticação geral no painel principal; o Grupo 34 protege as operações editoriais por `NEWS_ADMIN_TOKEN`, mas isso não substitui autenticação individual por usuário.

## Verificações realizadas
- `node --check server.js`
- `node --check public/app.js`
- `node --check public/overlay.js`
- `node --check public/noticias-admin.js`
- `node --check public/noticias.js`

Não foi executado deploy no GitHub/Render nem teste visual em navegador/OBS nesta sessão.

## Atualização visual — Central de Notícias
Esta revisão corrige também os caminhos dos arquivos CSS e JavaScript para URLs absolutas (`/noticias.css`, `/noticias-admin.js` e `/noticias.js`). Isso é importante porque o painel administrativo é aberto em `/noticias/admin`; caminhos relativos poderiam fazer o navegador procurar os arquivos em `/noticias/` e exibir a página sem o estilo correto.

O visual foi atualizado para a identidade LLTV Brasil: fundo escuro com degradês discretos, detalhes dourados, painéis em cinza-escuro, campos de formulário com foco destacado, botões refinados e melhor adaptação para celulares. As funcionalidades e rotas existentes foram preservadas.
