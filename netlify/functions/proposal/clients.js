/* ============================================================
   Me&Co. — client proposal registry
   ------------------------------------------------------------
   ADDING A NEW CLIENT (three steps, no code changes elsewhere):

     1. Drop the proposal page at
          netlify/functions/proposal/content/<slug>.html
     2. Add one entry to CLIENTS below.
     3. In Netlify, set the env var named here (see `envKey`)
          Site configuration → Environment variables → Add a variable
        e.g.  PROPOSAL_PASSWORD_ACME = "some-long-passphrase"

   The proposal is then live at  /proposals/<slug>
   and is never linked from site navigation.
   ============================================================ */

const CLIENTS = {
  'moises-zamora': {
    // -> reads process.env.PROPOSAL_PASSWORD_MOISES
    envKey: 'PROPOSAL_PASSWORD_MOISES',
    file: 'moises-zamora.html',
    // Shown on the lock screen only. Safe to be public.
    name: 'Moisés Zamora & Slate',
    kicker: 'Private proposal',
    blurb: 'This proposal was prepared just for you. Enter the password Melody sent along with the link.',
  },
};

/** Env var naming convention: PROPOSAL_PASSWORD_<CLIENT>. */
const ENV_PREFIX = 'PROPOSAL_PASSWORD_';

/** Returns the client config for a slug, or null. */
function getClient(slug) {
  if (!slug || !Object.prototype.hasOwnProperty.call(CLIENTS, slug)) return null;
  const client = CLIENTS[slug];
  return {
    slug,
    ...client,
    // Fall back to the derived name if `envKey` is ever omitted.
    envKey: client.envKey || ENV_PREFIX + slug.toUpperCase().replace(/[^A-Z0-9]+/g, '_'),
  };
}

module.exports = { CLIENTS, ENV_PREFIX, getClient };
