import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import moduleCatalog from './module-catalog.json' with { type: 'json' };

const app = express();
const port = Number(process.env.PORT || 8787);
const pool = process.env.DATABASE_URL ? new pg.Pool({ connectionString: process.env.DATABASE_URL }) : null;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (_req, res) => {
  let database = 'not_configured';
  if (pool) {
    try { await pool.query('SELECT 1'); database = 'connected'; }
    catch { database = 'unavailable'; }
  }
  res.json({ ok: true, service: 'LLTV BRASIL API', database });
});

app.get('/api/modules', (_req, res) => res.json(moduleCatalog));

app.get('/api/channels', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Banco de dados não configurado.' });
  try {
    const { rows } = await pool.query('SELECT id, name, slug, description, logo_url, is_active FROM channels WHERE is_active = true ORDER BY id');
    res.json(rows);
  } catch { res.status(500).json({ error: 'Não foi possível consultar os canais.' }); }
});

app.get('/api/programs', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Banco de dados não configurado.' });
  try {
    const { rows } = await pool.query('SELECT p.*, c.name AS channel_name FROM programs p LEFT JOIN channels c ON c.id=p.channel_id ORDER BY starts_at LIMIT 100');
    res.json(rows);
  } catch { res.status(500).json({ error: 'Não foi possível consultar a programação.' }); }
});

app.get('/api/news', async (_req, res) => {
  if (!pool) return res.status(503).json({ error: 'Banco de dados não configurado.' });
  try {
    const { rows } = await pool.query("SELECT id, title, slug, summary, image_url, category, published_at FROM news WHERE status='published' ORDER BY published_at DESC LIMIT 30");
    res.json(rows);
  } catch { res.status(500).json({ error: 'Não foi possível consultar as notícias.' }); }
});

app.listen(port, () => console.log(`LLTV API disponível em http://localhost:${port}`));
