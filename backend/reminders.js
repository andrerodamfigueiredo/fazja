// Sends push notifications for timed tasks at -30min, -15min, 0, every 15min overdue
// Uses an in-memory Set to avoid duplicates within a server session.

const sent = new Set(); // key: `${taskId}:${type}`

function key(taskId, type) { return `${taskId}:${type}`; }

function minutesUntil(dueDateISO) {
  return (new Date(dueDateISO) - new Date()) / 60000;
}

async function checkAndNotify(db, sendFn) {
  const tasks = db.prepare(`
    SELECT * FROM tasks
    WHERE has_time = 1 AND done = 0 AND due_at IS NOT NULL
  `).all();

  const subs = db.prepare('SELECT subscription FROM push_subscriptions').all();
  if (!subs.length) return;

  for (const task of tasks) {
    const diff = minutesUntil(task.due_at);

    // Stop nagging after 4 hours overdue
    if (diff < -240) continue;

    const notifs = [
      { type: '30min',  condition: diff <= 31 && diff > 20,   title: `⏰ Em 30 min`,  body: `${task.emoji} ${task.title}` },
      { type: '15min',  condition: diff <= 16 && diff > 5,    title: `⚡ Em 15 min!`, body: `${task.emoji} ${task.title} — vai lá!` },
      { type: 'now',    condition: diff <= 5  && diff > -5,   title: `🔴 AGORA`,      body: `${task.emoji} ${task.title}` },
    ];

    for (const n of notifs) {
      if (n.condition && !sent.has(key(task.id, n.type))) {
        sent.add(key(task.id, n.type));
        await notify(subs, db, { title: n.title, body: n.body, tag: `task-${task.id}-${n.type}`, data: { taskId: task.id } }, sendFn);
      }
    }

    // Overdue every 15 min — up to 16 times (4h)
    if (diff < -5) {
      const overdueSlot = Math.floor((-diff - 5) / 15);
      const overdueKey  = key(task.id, `overdue_${overdueSlot}`);
      if (!sent.has(overdueKey)) {
        sent.add(overdueKey);
        await notify(subs, db, {
          title: `😤 Ainda por fazer`,
          body:  `${task.emoji} ${task.title}`,
          tag:   `task-${task.id}-overdue`,
          data:  { taskId: task.id },
        }, sendFn);
      }
    }
  }
}

async function notify(subs, db, payload, sendFn) {
  for (const { subscription } of subs) {
    try {
      await sendFn(subscription, payload);
    } catch (err) {
      if (err.expired) {
        db.prepare('DELETE FROM push_subscriptions WHERE subscription = ?').run(subscription);
      }
    }
  }
}

function startReminders(db, sendFn) {
  setInterval(() => checkAndNotify(db, sendFn), 60 * 1000);
  // Also run once after 10 seconds to catch immediate tasks
  setTimeout(() => checkAndNotify(db, sendFn), 10000);
  console.log('[reminders] Activo — verificação a cada minuto');
}

module.exports = { startReminders };
