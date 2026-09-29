/* ============================================================
   Me&Co. — paid event registration
   ------------------------------------------------------------
   POST { event, name, email }  ->  { url } of a Stripe Checkout
   page. The price lives here, never in the page, so nobody can
   change what they pay by editing the form.

   Needs STRIPE_SECRET_KEY in the site's environment variables.
   No npm packages: it calls the Stripe API directly.
   ============================================================ */

const EVENTS = {
  'capital-and-craft': {
    name: 'Capital & Craft, all three sessions',
    description: 'Founder funding readiness series with Melody Estrada and Dyasha Arauz. Wed 27 Jan, 10 Feb and 24 Feb 2027, 6:30 to 8:30 PM ET, Arauz Inc., Cutler Bay, Florida.',
    amount: 8000, // cents
    page: '/events/event-one.html',
  },
};

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body),
});

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(500, { error: 'Payments are not set up yet.' });

  let input;
  try {
    input = JSON.parse(event.body || '{}');
  } catch (e) {
    return json(400, { error: 'Bad request' });
  }

  const item = EVENTS[input.event];
  if (!item) return json(400, { error: 'Unknown event' });

  const email = String(input.email || '').trim();
  const name = String(input.name || '').trim().slice(0, 200);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json(400, { error: 'Please enter a valid email.' });

  const origin = process.env.URL || `https://${event.headers.host}`;
  const form = new URLSearchParams({
    mode: 'payment',
    customer_email: email,
    'line_items[0][quantity]': '1',
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(item.amount),
    'line_items[0][price_data][product_data][name]': item.name,
    'line_items[0][price_data][product_data][description]': item.description,
    'metadata[event]': input.event,
    'metadata[name]': name,
    'payment_intent_data[metadata][event]': input.event,
    'payment_intent_data[metadata][name]': name,
    success_url: `${origin}/rsvp-thanks.html?paid=1`,
    cancel_url: `${origin}${item.page}#rsvp`,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });
  const data = await res.json();
  if (!res.ok || !data.url) {
    console.error('Stripe checkout error', res.status, data && data.error && data.error.message);
    return json(502, { error: 'Checkout could not start. Please try again or email melody@weareme.co.' });
  }
  return json(200, { url: data.url });
};
