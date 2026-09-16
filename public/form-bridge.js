/*
 * Connects the prototype's forms to the backend.
 *
 * The prototype validates input itself and signals success uniformly, by
 * putting the class `sent` on the form's card. Rather than rewrite those
 * handlers - which would mean duplicating their validation and risking the
 * design - this watches for that signal and posts the form when it appears.
 * The prototype's own JavaScript is untouched.
 */
(function () {
  var FORMS = [
    { form: 'checkForm', card: 'fcard', endpoint: '/api/exposure-check' },
    { form: 'reportForm', card: 'rcard', endpoint: '/api/report-request' },
    { form: 'contactForm', card: 'ccard', endpoint: '/api/contact' },
  ];

  FORMS.forEach(function (cfg) {
    var form = document.getElementById(cfg.form);
    var card = document.getElementById(cfg.card);
    if (!form || !card) return;

    // The pages also set `sent` from a `?state=sent` demo link with no real
    // submission behind it, so only a genuine submit arms the post.
    var armed = false;
    form.addEventListener('submit', function () {
      armed = true;
    });

    new MutationObserver(function () {
      if (!armed || !card.classList.contains('sent')) return;
      armed = false;
      send(form, card, cfg.endpoint);
    }).observe(card, { attributes: true, attributeFilter: ['class'] });
  });

  function send(form, card, endpoint) {
    var data = { source_path: location.pathname };
    new FormData(form).forEach(function (value, key) {
      data[key] = value;
    });

    fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
      })
      .catch(function (err) {
        // Never let a submission look accepted when it was not.
        console.error('[form-bridge]', endpoint, err);
        card.classList.remove('sent');
        fail(form);
      });
  }

  function fail(form) {
    var id = 'form-bridge-error';
    var msg = form.querySelector('#' + id);
    if (!msg) {
      msg = document.createElement('p');
      msg.id = id;
      msg.setAttribute('role', 'alert');
      msg.style.cssText =
        'margin:14px 0 0;padding:12px 14px;border-radius:10px;font-size:14px;' +
        'line-height:1.45;background:#FDECEC;color:#8E1B1B;border:1px solid #F5C2C2';
      form.appendChild(msg);
    }
    msg.textContent =
      'We could not send that just now. Please try again, or email services@customsdatalock.com.';
    msg.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
})();
