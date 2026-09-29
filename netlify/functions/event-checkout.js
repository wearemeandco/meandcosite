/* ============================================================
   Me&Co. — paid event registration
   ------------------------------------------------------------
   GET  ?event=<slug>                  ->  { left, capacity, maxPerOrder }
   POST { event, name, email, seats }  ->  { url } of a Stripe Checkout page
   POST { event, name, email, donation }  for a donation event: whole
        dollars, between the event's minimum and maximum

   Price and capacity live here, never in the page, so nobody can
   change what they pay by editing the form. Seats taken = paid
   checkouts plus checkouts opened in the last 30 minutes (each
   checkout expires after 30 minutes), so two people cannot buy
   the last seat at the same time.

   Needs STRIPE_SECRET_KEY in the site's environment variables.
   No npm packages: it calls the Stripe API directly.
   ============================================================ */

const EVENTS = {
  'capital-and-craft': {
    name: 'Capital & Craft, all three sessions',
    description: 'Founder funding readiness series with Melody Estrada and Dyasha Arauz. Wed 27 Jan, 10 Feb and 24 Feb 2027, 6:30 to 8:30 PM ET, Arauz Inc., Cutler Bay, Florida.',
    amount: 8000, // cents, per seat
    capacity: 12,
    maxPerOrder: 4,
    page: '/events/event-one.html',
  },
  'coquito-conmigo': {
    name: 'Coquito Conmigo donation',
    description: 'Saturday 14 November 2026, 10:00 to 11:30 AM on Zoom. All proceeds go to Puerto Rico relief and recovery.',
    donation: { min: 5, max: 1000 }, // whole dollars
    page: '/events/event-two.html',
  },
};

const HOLD_SECONDS = 30 * 60;

const json = (statusCode, body) => ({
  statusCode,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  body: JSON.stringify(body),
});

async function seatsTaken(key, slug) {
  const recent = Math.floor(Date.now() / 1000) - HOLD_SECONDS;
  let taken = 0;
  let after = null;
  for (let page = 0; page < 20; page++) {
    const q = new URLSearchParams({ limit: '100' });
    if (after) q.set('starting_after', after);
    const res = await fetch('https://api.stripe.com/v1/checkout/sessions?' + q, {
      headers: { Authorization: `Bearer ${key}` },
    });
    const data = await res.json();
    if (!res.ok) throw new Error((data && data.error && data.error.message) || 'Stripe list failed');
    for (const s of data.data) {
      if (!s.metadata || s.metadata.event !== slug) continue;
      const held = s.payment_status === 'paid' || (s.status === 'open' && s.created >= recent);
      if (held) taken += parseInt(s.metadata.seats || '1', 10);
    }
    if (!data.has_more || !data.data.length) break;
    after = data.data[data.data.length - 1].id;
  }
  return taken;
}

exports.handler = async (event) => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return json(500, { error: 'Payments are not set up yet.' });

  if (event.httpMethod === 'GET') {
    const slug = (event.queryStringParameters || {}).event;
    const item = EVENTS[slug];
    if (!item) return json(400, { error: 'Unknown event' });
    if (item.donation) return json(200, { donation: item.donation });
    try {
      const left = Math.max(0, item.capacity - (await seatsTaken(key, slug)));
      return json(200, { left, capacity: item.capacity, maxPerOrder: item.maxPerOrder });
    } catch (e) {
      console.error('Seat check failed', e.message);
      return json(502, { error: 'Could not check seats.' });
    }
  }

  if (event.httpMethod !== 'POST') return json(405, { error: 'Method not allowed' });

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

  let seats = 1;
  let amount = item.amount;
  if (item.donation) {
    const dollars = Number(input.donation);
    if (!(Number.isInteger(dollars) && dollars >= item.donation.min && dollars <= item.donation.max)) {
      return json(400, { error: `Please give a whole-dollar amount from $${item.donation.min} to $${item.donation.max}.` });
    }
    amount = dollars * 100;
  } else {
    seats = parseInt(input.seats, 10);
    if (!(seats >= 1 && seats <= item.maxPerOrder)) {
      return json(400, { error: `Choose between 1 and ${item.maxPerOrder} seats.` });
    }

    let left;
    try {
      left = item.capacity - (await seatsTaken(key, input.event));
    } catch (e) {
      console.error('Seat check failed', e.message);
      return json(502, { error: 'Could not check seats. Please try again.' });
    }
    if (left <= 0) return json(409, { error: 'This series is sold out. Email melody@weareme.co to join the waitlist.', left: 0 });
    if (seats > left) return json(409, { error: `Only ${left} seat${left === 1 ? '' : 's'} left.`, left });
  }

  const origin = process.env.URL || `https://${event.headers.host}`;
  const form = new URLSearchParams({
    mode: 'payment',
    customer_email: email,
    expires_at: String(Math.floor(Date.now() / 1000) + HOLD_SECONDS),
    'line_items[0][quantity]': String(seats),
    'line_items[0][price_data][currency]': 'usd',
    'line_items[0][price_data][unit_amount]': String(amount),
    'line_items[0][price_data][product_data][name]': item.name,
    'line_items[0][price_data][product_data][description]': item.description,
    'metadata[event]': input.event,
    'metadata[name]': name,
    'metadata[seats]': String(seats),
    'payment_intent_data[metadata][event]': input.event,
    'payment_intent_data[metadata][name]': name,
    'payment_intent_data[metadata][seats]': String(seats),
    success_url: `${origin}/rsvp-thanks.html?paid=1&e=${input.event}`,
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
