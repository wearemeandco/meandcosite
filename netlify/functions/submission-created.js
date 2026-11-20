/* ============================================================
   Me&Co.: thank-you email for the interest form ("Let's Talk")
   ------------------------------------------------------------
   Netlify runs this function on its own after every form
   submission (the name submission-created is Netlify's form
   event), and signs the call, so it is not publicly invocable.

   It acts only on the "interest" form. It sends the person a
   thank-you email through Resend with Melody's booking link.
   Every other form is ignored. The submission itself is already
   saved by Netlify Forms, so this function always returns 200:
   a missing setting or a failed send never fails the submission.

   Needs, in the site's environment variables:
     RESEND_API_KEY, INTEREST_MAIL_FROM
   INTEREST_MAIL_FROM looks like "Melody Estrada <melody@weareme.co>"
   and must be on a domain verified in Resend. No npm packages.
   ============================================================ */

const RESEND_API = 'https://api.resend.com/emails';
const BOOK_URL = 'https://calendly.com/melodyestrada1/90';
const SUBJECT = 'Gracias for reaching out to Me&Co.';
const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

const ok = () => ({ statusCode: 200, body: '' });

const maskEmail = (email) => String(email).replace(/^(.{0,2})[^@]*@/, '$1***@');

const escapeHtml = (s) =>
  String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

function firstName(name) {
  const word = String(name || '').trim().split(/\s+/)[0];
  return word || '';
}

function buildText(first) {
  return [
    first ? `Hi ${first},` : 'Hi,',
    '',
    'Gracias for reaching out to Me&Co. Melody reads every one of these herself, and you will hear back within two business days.',
    '',
    'If you would like to talk sooner, you can book a time with her right away:',
    BOOK_URL,
    '',
    'Con cariño,',
    'Melody',
    '',
    'Me&Co. | SYSTEMS, NOT JUST SERVICES.',
    'https://weareme.co',
    'Community over competition, always.',
  ].join('\n');
}

function buildHtml(first) {
  const hello = first ? `Hi ${escapeHtml(first)},` : 'Hi,';
  const serif = "Fraunces, Georgia, serif";
  const sans = "'DM Sans', Arial, sans-serif";
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="supported-color-schemes" content="light dark">
<title>${escapeHtml(SUBJECT)}</title>
<style>
  @media (prefers-color-scheme: dark) {
    body, .page { background: #22315E !important; }
    .card { background: #22315E !important; border-color: #3A4D80 !important; }
    .logo-row { border-color: #3A4D80 !important; }
    .hero { background: #2B3C6E !important; }
    .head, .label { color: #FFFCF5 !important; }
    .body-text { color: #C9D6F2 !important; }
    .btn-cell { background: #FFFCF5 !important; }
    .btn-link { color: #22315E !important; }
    .sign { color: #FFFCF5 !important; }
  }
</style>
</head>
<body class="page" style="margin:0;padding:0;background:#F3ECDF;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" class="page" style="background:#F3ECDF;">
<tr><td align="center" style="padding:24px 12px;">
  <table role="presentation" width="640" cellpadding="0" cellspacing="0" border="0" class="card" style="width:100%;max-width:640px;background:#FFFCF5;border:1px solid #E6DCD0;border-radius:20px;overflow:hidden;">
    <tr><td class="logo-row" style="padding:24px 32px;border-bottom:1px solid #E6DCD0;">
      <img src="https://weareme.co/assets/logo-blue.png" width="120" alt="Me&amp;Co." style="display:block;width:120px;height:auto;border:0;">
    </td></tr>
    <tr><td class="hero" style="background:#EFE8DC;padding:32px;">
      <div class="label" style="font-family:${sans};font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#7B4A2E;font-weight:700;">LET'S TALK</div>
      <h1 class="head" style="margin:12px 0 14px;font-family:${serif};font-weight:600;font-size:30px;line-height:1.2;color:#2A4FBF;">Gracias for reaching out.</h1>
      <img src="https://meandco-portal.netlify.app/email/squiggle-rose.png" width="120" alt="" style="display:block;width:120px;height:auto;border:0;">
    </td></tr>
    <tr><td style="padding:32px;">
      <p class="body-text" style="margin:0 0 16px;font-family:${sans};font-size:16px;line-height:1.6;color:#3A3630;">${hello}</p>
      <p class="body-text" style="margin:0 0 16px;font-family:${sans};font-size:16px;line-height:1.6;color:#3A3630;">Gracias for reaching out to Me&amp;Co. Melody reads every one of these herself, and you will hear back within two business days.</p>
      <p class="body-text" style="margin:0 0 24px;font-family:${sans};font-size:16px;line-height:1.6;color:#3A3630;">If you would like to talk sooner, you can book a time with her right away.</p>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 28px;">
        <tr><td class="btn-cell" align="center" style="background:#2A4FBF;border-radius:999px;">
          <a class="btn-link" href="${BOOK_URL}" style="display:inline-block;padding:14px 28px;font-family:${sans};font-size:13px;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;color:#FFFCF5;text-decoration:none;border-radius:999px;">Book a time with Melody</a>
        </td></tr>
      </table>
      <table role="presentation" cellpadding="0" cellspacing="0" border="0">
        <tr>
          <td style="padding-right:14px;vertical-align:middle;">
            <img src="https://weareme.co/assets/headshot.jpg" width="56" height="56" alt="Melody" style="display:block;width:56px;height:56px;border-radius:50%;border:0;">
          </td>
          <td style="vertical-align:middle;">
            <div class="body-text" style="font-family:${sans};font-size:16px;line-height:1.4;color:#3A3630;">Con cari&ntilde;o,</div>
            <div class="sign" style="font-family:${serif};font-style:italic;font-size:24px;line-height:1.3;color:#7B4A2E;">Melody</div>
          </td>
        </tr>
      </table>
    </td></tr>
    <tr><td align="center" style="background:#22315E;padding:28px 32px;">
      <img src="https://weareme.co/assets/logo-cream-primary.png" width="110" alt="Me&amp;Co." style="display:block;width:110px;height:auto;border:0;margin:0 auto 14px;">
      <div style="font-family:${sans};font-size:11px;letter-spacing:2px;text-transform:uppercase;color:#C9D6F2;">SYSTEMS, NOT JUST SERVICES.</div>
      <div style="margin:10px 0;font-family:${sans};font-size:13px;"><a href="https://weareme.co" style="color:#C9D6F2;text-decoration:underline;">weareme.co</a></div>
      <div style="font-family:${sans};font-size:13px;color:#C9D6F2;">Community over competition, always.</div>
    </td></tr>
  </table>
</td></tr>
</table>
</body>
</html>`;
}

exports.handler = async (event) => {
  let payload;
  try {
    payload = JSON.parse(event.body || '{}').payload;
  } catch (err) {
    console.error('submission-created: body was not JSON');
    return ok();
  }
  if (!payload || payload.form_name !== 'interest') return ok();

  const data = payload.data || {};
  const email = String(data.email || '').trim();
  if (!EMAIL_RE.test(email)) return ok();

  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INTEREST_MAIL_FROM;
  if (!apiKey || !from) {
    const missing = [!apiKey && 'RESEND_API_KEY', !from && 'INTEREST_MAIL_FROM'].filter(Boolean).join(', ');
    console.error(`submission-created: thank-you email not sent, missing setting: ${missing}`);
    return ok();
  }

  const first = firstName(data.name);
  try {
    const res = await fetch(RESEND_API, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `interest-thanks/${payload.id}`,
      },
      body: JSON.stringify({
        from,
        to: [email],
        reply_to: 'melody@weareme.co',
        subject: SUBJECT,
        html: buildHtml(first),
        text: buildText(first),
      }),
    });
    if (!res.ok) {
      const detail = (await res.text()).slice(0, 300);
      console.error(`submission-created: Resend ${res.status} for ${maskEmail(email)}: ${detail}`);
    }
  } catch (err) {
    console.error(`submission-created: send failed for ${maskEmail(email)}: ${err.message}`);
  }
  return ok();
};

exports.buildHtml = buildHtml;
exports.buildText = buildText;
