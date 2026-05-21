require('dotenv').config({ path: require('path').join(__dirname, '../.env') });

const express    = require('express');
const cors       = require('cors');
const path       = require('path');
const Anthropic  = require('@anthropic-ai/sdk');
const { db }           = require('./db');
const { configure, sendNotification, getPublicKey } = require('./push');
const { startReminders } = require('./reminders');

configure();

const app    = express();
const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../frontend')));

// ── Helpers ───────────────────────────────────────────────────────────────────

function getStreak() {
  return db.prepare('SELECT * FROM streak WHERE id = 1').get();
}

function refreshStreakStats(streak) {
  const stats = db.prepare(`SELECT * FROM streak WHERE id = 1`).get();
  return stats;
}

function updateStreak() {
  const today = new Date().toISOString().slice(0, 10);
  const s = db.prepare('SELECT * FROM streak WHERE id = 1').get();
  let newStreak = s.current_streak;
  let longest   = s.longest_streak;

  if (s.last_active_date === today) {
    // Already counted today
  } else {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    newStreak = (s.last_active_date === yesterday) ? s.current_streak + 1 : 1;
    longest   = Math.max(longest, newStreak);
    db.prepare(`
      UPDATE streak SET
        current_streak   = ?,
        longest_streak   = ?,
        last_active_date = ?,
        total_tasks_done = total_tasks_done + 1
      WHERE id = 1
    `).run(newStreak, longest, today);
  }

  return db.prepare('SELECT * FROM streak WHERE id = 1').get();
}

// ── GET /api/tasks ─────────────────────────────────────────────────────────────
app.get('/api/tasks', (req, res) => {
  const tasks = db.prepare(`
    SELECT * FROM tasks ORDER BY slot, position, id
  `).all();
  const streak = getStreak();
  res.json({ tasks, streak, vapidPublicKey: getPublicKey() });
});

// ── POST /api/tasks ────────────────────────────────────────────────────────────
app.post('/api/tasks', (req, res) => {
  const { title, emoji = '⭐', slot = 'manha', has_time = 0, due_at = null } = req.body;
  if (!title) return res.status(400).json({ error: 'title required' });

  // Assign position at end of slot
  const maxPos = db.prepare('SELECT MAX(position) as m FROM tasks WHERE slot = ? AND done = 0').get(slot);
  const position = (maxPos?.m ?? -1) + 1;

  const { lastInsertRowid } = db.prepare(`
    INSERT INTO tasks (title, emoji, slot, position, has_time, due_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(title, emoji, slot, position, has_time ? 1 : 0, due_at);

  const task = db.prepare('SELECT * FROM tasks WHERE id = ?').get(lastInsertRowid);
  res.json({ task });
});

// ── PUT /api/tasks/:id/done ────────────────────────────────────────────────────
app.put('/api/tasks/:id/done', (req, res) => {
  const { id } = req.params;
  const now = new Date().toISOString();
  db.prepare('UPDATE tasks SET done = 1, done_at = ? WHERE id = ?').run(now, id);
  const streak = updateStreak();
  const task   = db.prepare('SELECT * FROM tasks WHERE id = ?').get(id);
  res.json({ task, streak });
});

// ── PUT /api/tasks/:id/move ────────────────────────────────────────────────────
app.put('/api/tasks/:id/move', (req, res) => {
  const { id } = req.params;
  const { slot, position } = req.body;
  db.prepare('UPDATE tasks SET slot = ?, position = ? WHERE id = ?').run(slot, position, id);
  res.json({ ok: true });
});

// ── PUT /api/tasks/reorder ────────────────────────────────────────────────────
app.put('/api/tasks/reorder', (req, res) => {
  const { order } = req.body; // { manha: [id, id, ...], tarde: [id, id, ...] }
  const stmt = db.prepare('UPDATE tasks SET slot = ?, position = ? WHERE id = ?');
  const update = db.transaction(() => {
    for (const [slot, ids] of Object.entries(order)) {
      ids.forEach((taskId, i) => stmt.run(slot, i, taskId));
    }
  });
  update();
  res.json({ ok: true });
});

// ── DELETE /api/tasks/:id ──────────────────────────────────────────────────────
app.delete('/api/tasks/:id', (req, res) => {
  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ ok: true });
});

// ── POST /api/parse ────────────────────────────────────────────────────────────
app.post('/api/parse', async (req, res) => {
  const { transcript } = req.body;
  if (!transcript) return res.status(400).json({ error: 'transcript required' });

  const now = new Date().toLocaleString('pt-PT', {
    timeZone: 'Europe/Lisbon',
    dateStyle: 'full',
    timeStyle: 'short',
  });

  try {
    const msg = await client.messages.create({
      model: 'claude-sonnet-4-5',
      max_tokens: 256,
      system: `És um parser de tarefas para um vendedor Mercedes-Benz português com ADHD.
Data/hora actual: ${now}

Devolve APENAS JSON válido, sem explicação, sem markdown:
{
  "title": "tarefa em português que começa com verbo (Ligar, Enviar, Marcar, Confirmar, Visitar, Preparar, Fechar, Seguir...)",
  "slot": "manha" ou "tarde",
  "emoji": "emoji mais relevante de: 📞🤝🚗📦💰✉️🔥📝🔁⭐🏎️👔💼📊🎯",
  "hasTime": true ou false,
  "due_at": "ISO datetime completo se hasTime=true, senão null"
}

Regras de slot:
- "de manhã", "esta manhã", "antes do almoço", hora < 13:00 → "manha"
- "à tarde", "depois do almoço", hora ≥ 13:00 → "tarde"
- Sem indicação de hora → "manha"

Regras de emoji (para Mercedes):
- Telefonemas/contacto → 📞
- Reuniões/visitas → 🤝
- Test drives/carros → 🚗
- Propostas/contratos → 💰
- Email/documentos → ✉️
- Urgente/prioritário → 🔥
- Notas/propostas → 📝
- Follow-up → 🔁
- Entrega/stock → 📦`,
      messages: [{ role: 'user', content: `Voz: ${transcript}` }],
    });

    const raw = msg.content[0].text.trim().replace(/```json|```/g, '');
    const parsed = JSON.parse(raw);
    res.json(parsed);
  } catch (err) {
    console.error('[parse] erro:', err.message);
    // Fallback inteligente sem AI
    const text = transcript.toLowerCase();
    const slot = (text.includes('tarde') || text.includes('depois do almoço')) ? 'tarde' : 'manha';
    res.json({
      title: transcript.charAt(0).toUpperCase() + transcript.slice(1),
      slot,
      emoji: '⭐',
      hasTime: false,
      due_at: null,
    });
  }
});

// ── POST /api/subscribe ────────────────────────────────────────────────────────
app.post('/api/subscribe', (req, res) => {
  const { subscription } = req.body;
  if (!subscription) return res.status(400).json({ error: 'subscription required' });
  const str = JSON.stringify(subscription);
  db.prepare(`INSERT OR REPLACE INTO push_subscriptions (subscription) VALUES (?)`).run(str);
  res.json({ ok: true });
});

// ── GET /api/status ────────────────────────────────────────────────────────────
app.get('/api/status', (req, res) => {
  const pending = db.prepare('SELECT COUNT(*) as n FROM tasks WHERE done = 0').get().n;
  const streak  = getStreak();
  res.json({ pending, streak, vapidPublicKey: getPublicKey() });
});

// ── GET /add?task=TEXT ─────────────────────────────────────────────────────────
app.get('/add', (req, res) => {
  const task = req.query.task;
  if (!task) return res.redirect('/');
  // Pre-fill voice modal with text from URL
  res.redirect(`/?prefill=${encodeURIComponent(task)}`);
});

// ── Start ─────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`\n🚀 Faz Já a correr na porta ${PORT}`);
  startReminders(db, sendNotification);
});
