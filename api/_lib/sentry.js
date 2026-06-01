import * as Sentry from '@sentry/node';

const dsn = process.env.SENTRY_DSN;
if (dsn && !global.__sentryInited) {
  Sentry.init({
    dsn,
    environment: process.env.VERCEL_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  global.__sentryInited = true;
}

export function withSentry(handler) {
  return async (req, res) => {
    try {
      return await handler(req, res);
    } catch (err) {
      Sentry.captureException(err);
      await Sentry.flush(2000);
      throw err;
    }
  };
}

export { Sentry };
