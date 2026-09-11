/* Newsletter signup: posts to Me&Co.'s Kit form 3037622 and shows the
   thank-you in place. On any failure it hands the visitor the hosted Kit
   form so nobody is stranded. */
(function () {
  'use strict';
  var form = document.getElementById('signup-form');
  if (!form) return;

  var ok = document.getElementById('signup-thanks');
  var errBox = document.getElementById('signup-error');
  var btn = form.querySelector('button[type="submit"]');
  var ACTION = form.getAttribute('action');

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    if (errBox) { errBox.hidden = true; errBox.textContent = ''; }

    var email = (form.querySelector('[name="email_address"]') || {}).value || '';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email.trim())) {
      if (errBox) { errBox.textContent = 'Please enter a valid email address.'; errBox.hidden = false; }
      return;
    }

    var original = btn ? btn.textContent : '';
    if (btn) { btn.disabled = true; btn.textContent = 'Subscribing…'; }

    fetch(ACTION, {
      method: 'POST',
      body: new FormData(form),
      headers: { 'Accept': 'application/json' }
    })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (data) {
        if (data && (data.subscription || data.url || data.status === 'success')) {
          form.hidden = true;
          if (ok) ok.hidden = false;
        } else {
          throw new Error('unexpected response');
        }
      })
      .catch(function () {
        if (errBox) {
          errBox.innerHTML = 'Something went wrong on our end. You can still ' +
            '<a class="link-underline" href="https://witty-artist-5576.kit.com/a8d461a1b3" target="_blank" rel="noopener">subscribe here</a>.';
          errBox.hidden = false;
        }
      })
      .finally(function () {
        if (btn) { btn.disabled = false; btn.textContent = original; }
      });
  });
})();
