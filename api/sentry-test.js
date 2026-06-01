import { withSentry } from './_lib/sentry.js';

export default withSentry(async function handler(req, res) {
  throw new Error('sentry backend test');
});
