/* ============================================================
   Me&Co.: add paid event registrants to Kit
   ------------------------------------------------------------
   Two ways in, both end in the same register() step:

   A. The thank-you page posts { session_id } after Stripe sends
      the buyer back. The session is fetched from Stripe here, so
      a visitor cannot fake a registration.
   B. Optional Stripe webhook (checkout.session.completed or
      checkout.session.async_payment_succeeded). The signature is
      checked, then the session is fetched from Stripe again.

   register() only acts on a known event that is paid. It creates
   or updates the subscriber in Kit, tags people who unticked the
   newsletter box with "event-only-no-newsletter", then applies the
   event's tag. Kit rules on that tag start the event's sequence.
   Every step is safe to repeat, so A and B can both fire.

   Needs, in the site's environment variables:
     KIT_API_KEY             Kit v4 API key
     STRIPE_SECRET_KEY       already used by event-checkout.js
     STRIPE_WEBHOOK_SECRET   only for path B (whsec_...)
   No npm packages.
   ============================================================ */

const crypto = require('crypto');

// Keep the slugs in step with EVENTS in event-checkout.js.
const EVENT_TAGS = {
  'capital-and-craft': 24702589, // capital-and-craft-registered
  'coquito-conmigo': 24702590, // coquito-conmigo-registered
};

const NO_NEWSLETTER_TAG = 'event-only-no-newsletter';
const KIT_API = 'https://api.kit.com/v4';
const SESSION_ID = /^cs_(live|test)_[A-Za-z0-9]+$/;
const MAX_AGE_SECONDS = 10 * 60;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

const maskEmail = (email) => String(email).replace(/^(.{0,2})[^@]*@/, '$1***@');

function rawBody(event) {
  const body = event.body || '';
  return event.isBase64Encoded ? Buffer.from(body, 'base64').toString('utf8') : body;
}

function header(event, name) {
  const headers = event.headers || {};
  const key = Object.keys(headers).find((k) => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

// Stripe signs `${t}.${body}` with HMAC-SHA256; the header carries t and one or more v1.
function validStripeSignature(sigHeader, body, secret) {
  let timestamp = null;
  const signatures = [];
  for (const part of String(sigHeader).split(',')) {
    const [k, v] = part.split('=');
    if (k === 't') timestamp = v;
    else if (k === 'v1' && v) signatures.push(v);
  }
  if (!timestamp || !signatures.length || !/^\d+$/.test(timestamp)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp)) > MAX_AGE_SECONDS) return false;

  const expected = Buffer.from(
    crypto.createHmac('sha256', secret).update(`${timestamp}.${body}`, 'utf8').digest('hex'),
    'utf8'
  );
  return signatures.some((sig) => {
    const given = Buffer.from(sig, 'utf8');
    return given.length === expected.length && crypto.timingSafeEqual(given, expected);
  });
}

async function fetchSession(stripeKey, id) {
  const res = await fetch('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(id), {
    headers: { Authorization: `Bearer ${stripeKey}` },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(`Stripe answered ${res.status}`);
    err.notFound = res.status === 404;
    throw err;
  }
  return data;
}

async function kit(apiKey, path, payload) {
  const res = await fetch(KIT_API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'X-Kit-Api-Key': apiKey },
    body: JSON.stringify(payload),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Kit ${path} answered ${res.status} ${text.slice(0, 300)}`);
  try {
    return JSON.parse(text);
  } catch (e) {
    return {};
  }
}

async function register(apiKey, session) {
  const meta = session.metadata || {};
  const tagId = EVENT_TAGS[meta.event];
  if (!tagId) return { skipped: 'unknown event' };
  if (session.payment_status !== 'paid') return { skipped: 'not paid' };

  const email = String((session.customer_details && session.customer_details.email) || session.customer_email || '').trim();
  if (!email) return { skipped: 'no email' };
  const firstName = String(meta.name || '').trim().split(/\s+/)[0] || '';

  const subscriber = { email_address: email };
  if (firstName) subscriber.first_name = firstName;
  await kit(apiKey, '/subscribers', subscriber);

  if (meta.newsletter === 'no') {
    const created = await kit(apiKey, '/tags', { name: NO_NEWSLETTER_TAG });
    const noNewsletterId = created && created.tag && created.tag.id;
    if (!noNewsletterId) throw new Error('Kit /tags returned no tag id');
    await kit(apiKey, `/tags/${noNewsletterId}/subscribers`, { email_address: email });
  }

  await kit(apiKey, `/tags/${tagId}/subscribers`, { email_address: email });
  return { registered: meta.event };
}

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const apiKey = process.env.KIT_API_KEY;
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!apiKey || !stripeKey) {
    console.error('event-registered: KIT_API_KEY or STRIPE_SECRET_KEY is not set');
    return json(500, { error: 'Not configured' });
  }

  const body = rawBody(event);
  const sigHeader = header(event, 'stripe-signature');
  let sessionId;

  if (sigHeader) {
    // Path B: Stripe webhook.
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret || !validStripeSignature(sigHeader, body, secret)) {
      return json(400, { error: 'Bad signature' });
    }
    let payload;
    try {
      payload = JSON.parse(body);
    } catch (e) {
      return json(400, { error: 'Bad request' });
    }
    const type = payload && payload.type;
    if (type !== 'checkout.session.completed' && type !== 'checkout.session.async_payment_succeeded') {
      return json(200, { ignored: type || 'unknown' });
    }
    sessionId = payload.data && payload.data.object && payload.data.object.id;
  } else {
    // Path A: thank-you page.
    let input;
    try {
      input = JSON.parse(body || '{}');
    } catch (e) {
      return json(400, { error: 'Bad request' });
    }
    sessionId = input && input.session_id;
  }

  if (typeof sessionId !== 'string' || !SESSION_ID.test(sessionId)) {
    return json(400, { error: 'Bad session_id' });
  }

  let session;
  try {
    session = await fetchSession(stripeKey, sessionId);
  } catch (e) {
    if (e.notFound) return json(400, { error: 'Unknown session' });
    console.error('event-registered: Stripe lookup failed', sessionId, e.message);
    return json(502, { error: 'Could not check the payment' });
  }

  try {
    const result = await register(apiKey, session);
    if (result.skipped) console.log('event-registered: skipped', sessionId, result.skipped);
    return json(200, result);
  } catch (e) {
    const email = (session.customer_details && session.customer_details.email) || session.customer_email || '';
    console.error('event-registered: Kit failed for', maskEmail(email), sessionId, e.message.split(email).join('[email]'));
    return json(502, { error: 'Could not add the registration' });
  }
};
