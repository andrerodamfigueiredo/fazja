const webpush = require('web-push');

let configured = false;

function configure() {
  const pub  = process.env.VAPID_PUBLIC_KEY;
  const priv = process.env.VAPID_PRIVATE_KEY;
  const mail = process.env.VAPID_EMAIL || 'mailto:fazja@local.app';
  if (pub && priv) {
    webpush.setVapidDetails(mail, pub, priv);
    configured = true;
  }
}

async function sendNotification(subscriptionJSON, payload) {
  if (!configured) return;
  try {
    const sub = typeof subscriptionJSON === 'string'
      ? JSON.parse(subscriptionJSON)
      : subscriptionJSON;
    await webpush.sendNotification(sub, JSON.stringify(payload));
  } catch (err) {
    if (err.statusCode === 410 || err.statusCode === 404) {
      // Subscription expired — caller should remove it
      throw Object.assign(err, { expired: true });
    }
    // Other errors: log but don't crash
    console.error('[push] send error:', err.message);
  }
}

function getPublicKey() {
  return process.env.VAPID_PUBLIC_KEY || null;
}

module.exports = { configure, sendNotification, getPublicKey };
