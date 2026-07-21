/* ============================================================
   Me&Co. — gated client proposals
   ------------------------------------------------------------
   One function serves every /proposals/<slug> request:

     GET  + valid session cookie -> the proposal HTML
     GET  without                -> the lock screen
     POST { password }           -> checked against the client's
                                    env var, sets a session cookie

   The proposal HTML lives in ./content/ which is bundled with
   the function and is NOT part of the published static site, so
   it is never in the page source before authentication.
   ============================================================ */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const { getClient } = require('./clients');
const { renderLockScreen } = require('./lock-screen');

const COOKIE_PREFIX = 'mc_prop_';
const TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12h ceiling on top of the session cookie
const WRONG_PASSWORD_MESSAGE = 'That password didn’t work. Please check it and try again.';

/* ---------- helpers ---------- */

function cookieName(slug) {
  return COOKIE_PREFIX + slug.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/** Compare two strings without leaking length or position via timing. */
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a), 'utf8').digest();
  const hb = crypto.createHash('sha256').update(String(b), 'utf8').digest();
  return crypto.timingSafeEqual(ha, hb);
}

function b64url(buf) {
  return Buffer.from(buf).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromB64url(str) {
  return Buffer.from(String(str).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8');
}

/**
 * Session token = base64url(payload) + "." + HMAC(payload).
 * The HMAC key is derived from the password itself, so rotating a
 * client's password automatically invalidates every issued session.
 */
function sign(payload, secret, slug) {
  return crypto.createHmac('sha256', secret + '::' + slug).update(payload).digest('hex');
}

function makeToken(slug, secret) {
  const payload = b64url(JSON.stringify({ s: slug, e: Date.now() + TOKEN_TTL_MS }));
  return payload + '.' + sign(payload, secret, slug);
}

function verifyToken(token, slug, secret) {
  if (!token || typeof token !== 'string') return false;
  const dot = token.lastIndexOf('.');
  if (dot < 1) return false;

  const payload = token.slice(0, dot);
  const mac = token.slice(dot + 1);

  const expected = sign(payload, secret, slug);
  if (mac.length !== expected.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(expected))) return false;

  try {
    const data = JSON.parse(fromB64url(payload));
    return data && data.s === slug && typeof data.e === 'number' && data.e > Date.now();
  } catch (err) {
    return false;
  }
}

function readCookie(headers, name) {
  const raw = (headers && (headers.cookie || headers.Cookie)) || '';
  const parts = raw.split(';');
  for (let i = 0; i < parts.length; i++) {
    const eq = parts[i].indexOf('=');
    if (eq === -1) continue;
    if (parts[i].slice(0, eq).trim() === name) {
      return decodeURIComponent(parts[i].slice(eq + 1).trim());
    }
  }
  return null;
}

function buildCookie(name, value, secure) {
  // No Max-Age/Expires => session cookie: gone when the browser closes.
  const bits = [
    name + '=' + encodeURIComponent(value),
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
  ];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

function clearCookie(name, secure) {
  const bits = [name + '=', 'Path=/', 'HttpOnly', 'SameSite=Lax', 'Max-Age=0'];
  if (secure) bits.push('Secure');
  return bits.join('; ');
}

/** Locate the bundled proposal file. Candidates cover both Netlify bundlers. */
function loadProposal(file) {
  const candidates = [
    path.join(__dirname, 'content', file),
    path.resolve(process.env.LAMBDA_TASK_ROOT || '.', 'netlify/functions/proposal/content', file),
    path.resolve(process.cwd(), 'netlify/functions/proposal/content', file),
  ];
  for (let i = 0; i < candidates.length; i++) {
    try {
      return fs.readFileSync(candidates[i], 'utf8');
    } catch (err) {
      /* try the next candidate */
    }
  }
  throw new Error('Proposal file not found: ' + file + ' (looked in: ' + candidates.join(', ') + ')');
}

/* ---------- responses ---------- */

const NO_STORE = {
  'Cache-Control': 'no-store, private, max-age=0',
  'X-Robots-Tag': 'noindex, nofollow, noarchive',
  'Referrer-Policy': 'no-referrer',
  'X-Content-Type-Options': 'nosniff',
};

function html(statusCode, body, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({ 'Content-Type': 'text/html; charset=utf-8' }, NO_STORE, extraHeaders || {}),
    body,
  };
}

function json(statusCode, obj, extraHeaders) {
  return {
    statusCode,
    headers: Object.assign({ 'Content-Type': 'application/json' }, NO_STORE, extraHeaders || {}),
    body: JSON.stringify(obj),
  };
}

function notFound() {
  return html(
    404,
    '<!DOCTYPE html><meta charset="utf-8"><title>Not found</title>' +
      '<div style="font-family:system-ui,sans-serif;padding:60px;text-align:center">' +
      '<h1 style="font-weight:600">Not found</h1>' +
      '<p><a href="/" style="color:#2A4FBF">Back to weareme.co</a></p></div>'
  );
}

/* ---------- request parsing ---------- */

function getSlug(event) {
  const q = (event.queryStringParameters && event.queryStringParameters.slug) || '';
  if (q) return q;
  // Fallback if the function is hit directly at /proposals/<slug>.
  const p = (event.path || '').replace(/\/+$/, '');
  const m = p.match(/\/proposals\/([^/]+)$/);
  return m ? decodeURIComponent(m[1]) : '';
}

function parseBody(event) {
  let raw = event.body || '';
  if (event.isBase64Encoded) raw = Buffer.from(raw, 'base64').toString('utf8');

  const type = String(
    (event.headers && (event.headers['content-type'] || event.headers['Content-Type'])) || ''
  ).toLowerCase();

  if (type.indexOf('application/json') !== -1) {
    try {
      const parsed = JSON.parse(raw);
      return { fields: parsed && typeof parsed === 'object' ? parsed : {}, wantsJson: true };
    } catch (err) {
      return { fields: {}, wantsJson: true };
    }
  }

  // Form-encoded => no-JS fallback, respond with a full page.
  const fields = {};
  new URLSearchParams(raw).forEach(function (v, k) {
    fields[k] = v;
  });
  return { fields, wantsJson: false };
}

/* ---------- handler ---------- */

exports.handler = async function (event) {
  const slug = getSlug(event);
  const client = getClient(slug);

  // Unknown slug: identical 404 whether or not a proposal exists.
  if (!client) return notFound();

  const secure = String(
    (event.headers && (event.headers['x-forwarded-proto'] || event.headers['X-Forwarded-Proto'])) || 'https'
  ).indexOf('https') !== -1;

  const password = process.env[client.envKey];
  const name = cookieName(client.slug);

  if (!password) {
    // Misconfiguration — never fall open.
    console.error('[proposal] Missing environment variable ' + client.envKey + ' for slug "' + client.slug + '".');
    return html(
      503,
      '<!DOCTYPE html><meta charset="utf-8"><title>Not available</title>' +
        '<div style="font-family:system-ui,sans-serif;padding:60px;text-align:center">' +
        '<h1 style="font-weight:600">This proposal isn’t available yet</h1>' +
        '<p style="color:#5A544A">Please contact melody@weareme.co.</p></div>'
    );
  }

  const method = (event.httpMethod || 'GET').toUpperCase();

  /* ----- password submission ----- */
  if (method === 'POST') {
    const parsed = parseBody(event);
    const attempt = typeof parsed.fields.password === 'string' ? parsed.fields.password : '';

    // Small constant-ish delay to blunt rapid online guessing.
    await new Promise(function (r) { setTimeout(r, 350); });

    if (!attempt || !safeEqual(attempt, password)) {
      if (parsed.wantsJson) return json(401, { ok: false, error: WRONG_PASSWORD_MESSAGE });
      return html(401, renderLockScreen(client, { error: WRONG_PASSWORD_MESSAGE }), {
        'Set-Cookie': clearCookie(name, secure),
      });
    }

    const cookie = buildCookie(name, makeToken(client.slug, password), secure);

    if (parsed.wantsJson) return json(200, { ok: true }, { 'Set-Cookie': cookie });

    // No-JS path: hand back the proposal immediately.
    try {
      return html(200, loadProposal(client.file), { 'Set-Cookie': cookie });
    } catch (err) {
      console.error('[proposal] ' + err.message);
      return html(500, '<!DOCTYPE html><meta charset="utf-8"><p>Proposal temporarily unavailable.</p>');
    }
  }

  if (method !== 'GET' && method !== 'HEAD') {
    return json(405, { ok: false, error: 'Method not allowed' }, { Allow: 'GET, POST' });
  }

  /* ----- page load ----- */
  const token = readCookie(event.headers, name);

  if (verifyToken(token, client.slug, password)) {
    try {
      return html(200, loadProposal(client.file));
    } catch (err) {
      console.error('[proposal] ' + err.message);
      return html(500, '<!DOCTYPE html><meta charset="utf-8"><p>Proposal temporarily unavailable.</p>');
    }
  }

  // No/expired/invalid cookie -> lock screen, and drop the stale cookie.
  return html(200, renderLockScreen(client), token ? { 'Set-Cookie': clearCookie(name, secure) } : {});
};
