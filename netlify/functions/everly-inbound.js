/* ============================================================
   Me&Co.: wake Everly when mail reaches everly@admin.weareme.co
   ------------------------------------------------------------
   Resend sends an "email.received" webhook here. This checks the
   webhook signature, and if the sender is on Everly's instructor
   list, fires her routine with a pointer to the email. Everly then
   reads the real email through her Resend connector and verifies
   it herself. Mail from anyone else waits for her next clock run.

   Resend webhooks cannot carry the routine's Authorization header,
   which is why this relay exists.

   Needs, in the site's environment variables:
     RESEND_WEBHOOK_SECRET   signing secret of the Resend webhook (whsec_...)
     EVERLY_ROUTINE_URL      the routine's API trigger URL (.../fire)
     EVERLY_ROUTINE_TOKEN    the routine's API trigger token
   No npm packages.
   ============================================================ */

const crypto = require('crypto');

// Keep in step with "Who can instruct you" in the everly-agent CLAUDE.md.
const INSTRUCTORS = [
  'melody@weareme.co',
  'olivia@ops.morastudios.co',
  'michelle@morastudios.co',
  'succeedandrepeat@gmail.com',
];

const MAX_AGE_SECONDS = 5 * 60;

const reply = (statusCode, message) => ({
  statusCode,
  headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' },
  body: message,
});

// Resend signs webhooks the Svix way: HMAC-SHA256 over "id.timestamp.body"
// with the base64 secret after "whsec_", sent as one or more "v1,<sig>".
function signatureIsValid(headers, body, secret) {
  const id = headers['svix-id'];
  const timestamp = headers['svix-timestamp'];
  const signatures = headers['svix-signature'];
  if (!id || !timestamp || !signatures) return false;

  const age = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (!Number.isFinite(age) || age > MAX_AGE_SECONDS) return false;

  const key = Buffer.from(secret.replace(/^whsec_/, ''), 'base64');
  const expected = crypto.createHmac('sha256', key).update(`${id}.${timestamp}.${body}`).digest();

  return signatures.split(' ').some((entry) => {
    const [version, sig] = entry.split(',');
    if (version !== 'v1' || !sig) return false;
    const given = Buffer.from(sig, 'base64');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

// "Olivia <olivia@ops.morastudios.co>" -> "olivia@ops.morastudios.co"
const addressOf = (from) => {
  const match = String(from || '').match(/<([^>]+)>/);
  return (match ? match[1] : String(from || '')).trim().toLowerCase();
};

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return reply(405, 'POST only');

  const secret = process.env.RESEND_WEBHOOK_SECRET;
  const routineUrl = process.env.EVERLY_ROUTINE_URL;
  const routineToken = process.env.EVERLY_ROUTINE_TOKEN;
  if (!secret || !routineUrl || !routineToken) {
    console.error('everly-inbound: missing environment variables');
    return reply(500, 'Not configured');
  }

  const body = event.isBase64Encoded ? Buffer.from(event.body || '', 'base64').toString('utf8') : event.body || '';
  if (!signatureIsValid(event.headers, body, secret)) return reply(401, 'Bad signature');

  let payload;
  try {
    payload = JSON.parse(body);
  } catch (err) {
    console.error('everly-inbound: body is not JSON', err.message);
    return reply(400, 'Bad JSON');
  }

  if (payload.type !== 'email.received') return reply(200, 'Ignored: ' + payload.type);

  const mail = payload.data || {};
  const sender = addressOf(mail.from);
  if (!INSTRUCTORS.includes(sender)) return reply(200, 'Ignored: sender not on the list');

  // A pointer only. Everly fetches and verifies the real email herself.
  const text = `Resend: email received ${mail.email_id} from ${sender} subject ${String(mail.subject || '').slice(0, 200)}`;

  const res = await fetch(routineUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${routineToken}`,
      'anthropic-beta': 'experimental-cc-routine-2026-04-01',
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    console.error('everly-inbound: routine fire failed', res.status, await res.text());
    // A non-2xx makes Resend retry the webhook later.
    return reply(502, 'Routine did not accept the wake-up');
  }
  return reply(200, 'Everly woken');
};
