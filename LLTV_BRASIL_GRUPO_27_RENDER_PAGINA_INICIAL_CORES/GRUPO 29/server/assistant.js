"use strict";
const express = require("express");
const router = express.Router();
const WA = "https://wa.me/5527998663622";
const FAQ = [
  [/\b(plano|planos|preço|precos|valor|quanto custa)\b/i, "Planos informados: Inicial R$ 40/mês; Intermediário R$ 80/6 meses; Avançado R$ 100/ano. Consulte a equipe sobre recursos e condições antes de contratar."],
  [/\b(obs|transmiss|placar|overlay)\b/i, "O LLTV Brasil Placar Pro oferece placar e elementos gráficos para uso como fonte de navegador no OBS. É necessário configurar a fonte e manter o sistema acessível."],
  [/\b(whatsapp|atendente|humano|suporte|contato|contratar)\b/i, `O atendimento humano é pelo WhatsApp (27) 99866-3622: ${WA}`],
  [/\b(pagamento|pix|cartão|cartao|asaas)\b/i, "O checkout pode oferecer PIX ou cartão, conforme configuração do Asaas. A licença só é ativada após confirmação oficial do webhook; não envie dados de cartão ou senhas no chat."],
  [/\b(aplicativo|instalar|celular|iphone|android|pwa)\b/i, "A plataforma funciona pelo navegador e pode ser instalada como PWA em dispositivos e navegadores compatíveis."],
  [/\b(competição|competicao|equipe|time|rodada|classificação|classificacao|arbitragem|narrador)\b/i, "O sistema reúne módulos esportivos como competições, equipes, jogos, rodadas, classificação, arbitragem e equipe de transmissão. O acesso pode depender do plano/licença habilitado."]
];
const hits = new Map();
function fallback(message) { const item=FAQ.find(([re])=>re.test(message)); return item?item[1]:`Não tenho informação suficiente para confirmar isso. Nossa equipe pode ajudar pelo WhatsApp (27) 99866-3622: ${WA}`; }
router.post("/chat", async (req,res) => {
  const ip=String(req.ip||req.socket.remoteAddress||"unknown"); const now=Date.now(); const recent=(hits.get(ip)||[]).filter(t=>now-t<60000); if(recent.length>=15)return res.status(429).json({error:"Muitas mensagens em pouco tempo. Aguarde um minuto."}); recent.push(now); hits.set(ip,recent);
  const message=String(req.body?.message||"").trim().slice(0,1200); if(message.length<2)return res.status(400).json({error:"Digite uma pergunta."});
  if(!process.env.OPENAI_API_KEY)return res.json({reply:fallback(message),mode:"faq"});
  try {
    const response=await fetch(process.env.OPENAI_BASE_URL||"https://api.openai.com/v1/chat/completions",{method:"POST",headers:{Authorization:`Bearer ${process.env.OPENAI_API_KEY}`,"Content-Type":"application/json"},body:JSON.stringify({model:process.env.OPENAI_MODEL||"gpt-4o-mini",temperature:0.2,max_tokens:350,messages:[{role:"system",content:"Você é o Assistente LLTV Brasil Placar Pro. Responda em português brasileiro, de forma curta e cordial. Use somente estes fatos: planos Inicial R$40 por mês, Intermediário R$80 por seis meses, Avançado R$100 por ano; WhatsApp humano (27) 99866-3622; plataforma de placar, gestão esportiva e recursos para OBS por fonte de navegador; PWA em dispositivos compatíveis; checkout PIX/cartão via Asaas quando configurado. Não invente recursos, disponibilidade, garantias, descontos, status de pagamento ou ativação de licença. Nunca peça senha, token ou dados completos de cartão. Para dúvidas específicas ou não confirmadas, encaminhe ao WhatsApp https://wa.me/5527998663622. Não afirme que é um humano."},{role:"user",content:message}]})});
    const data=await response.json().catch(()=>({})); if(!response.ok)throw new Error("AI provider unavailable"); const reply=String(data.choices?.[0]?.message?.content||"").trim(); if(!reply)throw new Error("Empty AI response"); res.json({reply:reply.slice(0,1800),mode:"ai"});
  } catch (_) { res.json({reply:fallback(message),mode:"faq"}); }
});
module.exports=router;
