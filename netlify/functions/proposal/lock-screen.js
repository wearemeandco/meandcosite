/* ============================================================
   Me&Co. — proposal lock screen
   ------------------------------------------------------------
   Rendered server-side by the proposal function whenever a
   request arrives without a valid session cookie. It contains
   NO proposal content and NO password — the only thing it can
   do is POST a guess to the function.
   ============================================================ */

function escapeHtml(str) {
  return String(str == null ? '' : str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * @param {object} client   entry from clients.js (slug, name, kicker, blurb)
 * @param {object} [opts]   { error: string }  server-rendered error state
 */
function renderLockScreen(client, opts) {
  const options = opts || {};
  const slug = escapeHtml(client.slug);
  const name = escapeHtml(client.name || 'this proposal');
  const kicker = escapeHtml(client.kicker || 'Private proposal');
  const blurb = escapeHtml(
    client.blurb ||
      'This page is private. Enter the password you were sent to open the proposal.'
  );
  const initialError = options.error ? escapeHtml(options.error) : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow, noarchive">
<title>Me&amp;Co. · Private proposal</title>
<link rel="icon" href="/assets/logo-blue.png">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght@0,9..144,400;0,9..144,500;0,9..144,600;0,9..144,700;1,9..144,500&family=DM+Sans:opsz,wght@9..40,400;9..40,500;9..40,600;9..40,700&display=swap" rel="stylesheet">
<link rel="stylesheet" href="/styles.css?v=4">
<style>
  /* Layout: the gate is a single centred card on the sand background.
     Sized in relative units so it holds together from 320px up. */
  body { background: var(--sand); }

  .gate {
    position: relative;
    min-height: 100vh;
    min-height: 100svh;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: clamp(20px, 6vw, 56px) 0;
  }
  .gate .wrap {
    position: relative;
    z-index: 1;
    width: 100%;
    display: flex;
    justify-content: center;
  }

  .gate-card {
    width: 100%;
    max-width: 460px;
    background: var(--cream);
    border: 1px solid var(--sand-line);
    border-radius: 24px;
    padding: clamp(28px, 6vw, 44px) clamp(22px, 5.5vw, 40px);
    box-shadow: 0 34px 70px -40px rgba(34, 49, 94, 0.4);
    text-align: center;
  }

  .gate-logo { height: 54px; width: auto; display: block; margin: 0 auto 22px; }

  .gate-lock {
    width: 62px;
    height: 62px;
    margin: 0 auto 20px;
    border-radius: 50%;
    background: var(--sand-light);
    border: 1px solid var(--sand-line);
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .gate-lock svg { width: 26px; height: 26px; display: block; }

  .gate-card h1 {
    font-size: clamp(25px, 6vw, 32px);
    font-weight: 600;
    line-height: 1.15;
    color: var(--blue);
    margin: 14px 0 0;
    text-wrap: balance;
  }
  .gate-for {
    font-size: 14px;
    font-weight: 600;
    color: var(--brown);
    margin: 8px 0 0;
  }
  .gate-blurb {
    font-size: 14.5px;
    line-height: 1.6;
    color: var(--ink-soft);
    margin: 14px auto 0;
    max-width: 34ch;
    text-wrap: pretty;
  }

  .gate-form {
    margin-top: 26px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    text-align: left;
  }

  /* .field comes from the site's form styling; only the extras live here. */
  .field { display: flex; flex-direction: column; gap: 8px; }
  .field label {
    font-size: 12px; font-weight: 700; letter-spacing: 0.08em;
    text-transform: uppercase; color: var(--brown);
  }
  .field input {
    font-family: var(--sans);
    font-size: 16px; /* 16px keeps iOS Safari from zooming on focus */
    color: var(--ink);
    background: var(--cream);
    border: 1px solid var(--sand-line-2);
    border-radius: 12px;
    padding: 14px 46px 14px 16px;
    outline: none;
    width: 100%;
    transition: border-color 0.2s var(--ease), box-shadow 0.2s var(--ease);
  }
  .field input:focus {
    border-color: var(--blue);
    box-shadow: 0 0 0 4px rgba(42, 79, 191, 0.12);
  }

  .pw-wrap { position: relative; display: block; }
  .pw-toggle {
    position: absolute;
    top: 50%;
    right: 6px;
    transform: translateY(-50%);
    width: 38px;
    height: 38px;
    border: none;
    background: transparent;
    border-radius: 50%;
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--ink-soft);
    transition: color 0.2s var(--ease), background 0.2s var(--ease);
  }
  .pw-toggle:hover { color: var(--blue); background: var(--sand-light); }
  .pw-toggle svg { width: 19px; height: 19px; display: block; }
  .pw-toggle .eye-off { display: none; }
  .pw-toggle.is-shown .eye-on { display: none; }
  .pw-toggle.is-shown .eye-off { display: block; }

  /* Error state — announced, not just coloured. */
  .gate-error {
    display: none;
    align-items: flex-start;
    gap: 9px;
    background: rgba(228, 87, 46, 0.08);
    border: 1px solid rgba(228, 87, 46, 0.28);
    color: #A8391B;
    border-radius: 12px;
    padding: 11px 14px;
    font-size: 13.5px;
    line-height: 1.5;
  }
  .gate-error.show { display: flex; }
  .gate-error svg { width: 16px; height: 16px; flex: none; margin-top: 2px; }

  .gate-card.shake { animation: gateShake 0.42s cubic-bezier(0.36, 0.07, 0.19, 0.97); }
  @keyframes gateShake {
    10%, 90% { transform: translateX(-2px); }
    20%, 80% { transform: translateX(4px); }
    30%, 50%, 70% { transform: translateX(-7px); }
    40%, 60% { transform: translateX(7px); }
  }
  .field input.is-invalid { border-color: var(--orange); box-shadow: 0 0 0 4px rgba(228, 87, 46, 0.12); }

  .gate-form .btn { width: 100%; }
  .btn[disabled] { opacity: 0.6; pointer-events: none; }

  .gate-foot {
    margin-top: 22px;
    font-size: 12.5px;
    line-height: 1.6;
    color: var(--ink-soft);
  }
  .gate-foot a { font-weight: 600; }

  @media (max-width: 400px) {
    .gate-card { border-radius: 20px; }
    .gate-logo { height: 46px; }
  }
  @media (prefers-reduced-motion: reduce) {
    .gate-card.shake { animation: none; }
  }
</style>
</head>
<body>
<div class="grain" aria-hidden="true"></div>

<main class="gate hero-services">
  <div class="hero-blob" aria-hidden="true" style="width:46vw;max-width:520px;aspect-ratio:1;background:rgba(42,79,191,0.16);top:-12%;left:-10%;"></div>
  <div class="hero-blob" aria-hidden="true" style="width:40vw;max-width:440px;aspect-ratio:1;background:rgba(217,165,160,0.28);bottom:-14%;right:-8%;animation-delay:-7s;"></div>

  <div class="wrap">
    <div class="gate-card" id="card">

      <img class="gate-logo" src="/assets/logo-blue.png" alt="Me&amp;Co." width="160" height="54">

      <div class="gate-lock" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" stroke="#2A4FBF" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">
          <rect x="4" y="10.5" width="16" height="10.5" rx="3"></rect>
          <path d="M8 10.5V7a4 4 0 0 1 8 0v3.5"></path>
          <circle cx="12" cy="15.6" r="1.35" fill="#2A4FBF" stroke="none"></circle>
          <path d="M12 16.6v1.9"></path>
        </svg>
      </div>

      <div class="eyebrow">${kicker}</div>
      <h1>A little something we made for you</h1>
      <p class="gate-for">${name}</p>
      <p class="gate-blurb">${blurb}</p>

      <form class="gate-form" id="gate-form" method="post" action="/proposals/${slug}" autocomplete="on">
        <div class="field">
          <label for="password">Password</label>
          <span class="pw-wrap">
            <input id="password" name="password" type="password" placeholder="Enter your password"
                   autocomplete="current-password" autocapitalize="off" autocorrect="off"
                   spellcheck="false" required aria-describedby="gate-error">
            <button type="button" class="pw-toggle" id="pw-toggle" aria-label="Show password">
              <svg class="eye-on" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z"></path><circle cx="12" cy="12" r="2.75"></circle></svg>
              <svg class="eye-off" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M3 3l18 18"></path><path d="M10.6 6.1A9.9 9.9 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17.6 17.6 0 0 1-3.5 4.2"></path><path d="M6.3 8A17.4 17.4 0 0 0 2 12s3.6 6.5 10 6.5c1.4 0 2.7-.3 3.8-.8"></path><path d="M9.6 9.7a2.75 2.75 0 0 0 3.8 3.9"></path></svg>
            </button>
          </span>
        </div>

        <div class="gate-error${initialError ? ' show' : ''}" id="gate-error" role="alert" aria-live="assertive">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9.2"></circle><path d="M12 7.6v5"></path><path d="M12 16.1h.01"></path></svg>
          <span id="gate-error-text">${initialError}</span>
        </div>

        <button type="submit" class="btn btn-blue" id="gate-submit">Open the proposal</button>
      </form>

      <p class="gate-foot">
        Lost the password? Email
        <a href="mailto:melody@weareme.co?subject=Proposal%20access">melody@weareme.co</a>
        and we'll resend it.
      </p>

    </div>
  </div>
</main>

<script>
(function () {
  var form   = document.getElementById('gate-form');
  var input  = document.getElementById('password');
  var submit = document.getElementById('gate-submit');
  var card   = document.getElementById('card');
  var errBox = document.getElementById('gate-error');
  var errTxt = document.getElementById('gate-error-text');
  var toggle = document.getElementById('pw-toggle');
  var slug   = ${JSON.stringify(client.slug)};

  // Show/hide password. Purely cosmetic — nothing is validated here.
  toggle.addEventListener('click', function () {
    var shown = input.type === 'text';
    input.type = shown ? 'password' : 'text';
    toggle.classList.toggle('is-shown', !shown);
    toggle.setAttribute('aria-label', shown ? 'Show password' : 'Hide password');
    input.focus();
  });

  function showError(msg) {
    errTxt.textContent = msg;
    errBox.classList.add('show');
    input.classList.add('is-invalid');
    card.classList.remove('shake');
    void card.offsetWidth; // restart the animation
    card.classList.add('shake');
    input.focus();
    input.select();
  }

  function clearError() {
    errBox.classList.remove('show');
    input.classList.remove('is-invalid');
  }

  input.addEventListener('input', clearError);

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var value = input.value;
    if (!value) { showError('Please enter the password.'); return; }

    clearError();
    submit.disabled = true;
    submit.textContent = 'Checking…';

    // The password leaves the browser and is only ever compared
    // server-side, inside the Netlify Function.
    fetch('/.netlify/functions/proposal?slug=' + encodeURIComponent(slug), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ password: value })
    })
    .then(function (res) {
      return res.json().then(function (data) { return { ok: res.ok, status: res.status, data: data }; });
    })
    .then(function (r) {
      if (r.ok && r.data && r.data.ok) {
        // Cookie is set; reload and the function will serve the proposal.
        window.location.replace('/proposals/' + slug);
        return;
      }
      submit.disabled = false;
      submit.textContent = 'Open the proposal';
      showError((r.data && r.data.error) || 'That password didn\\u2019t work. Please try again.');
    })
    .catch(function () {
      submit.disabled = false;
      submit.textContent = 'Open the proposal';
      showError('Something went wrong on our end. Please try again in a moment.');
    });
  });

  input.focus();
})();
</script>
</body>
</html>`;
}

module.exports = { renderLockScreen, escapeHtml };
