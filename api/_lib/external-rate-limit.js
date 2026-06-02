const DEFAULT_RETRY_AFTER_SECONDS = 60;
const RETRY_DELAY_MS = 1500;

export function retryAfterSecondsFromResponse(response) {
  const raw = response?.headers?.get?.('retry-after');
  if (!raw) return DEFAULT_RETRY_AFTER_SECONDS;
  const seconds = parseInt(String(raw).trim(), 10);
  if (Number.isFinite(seconds) && seconds > 0) return seconds;
  return DEFAULT_RETRY_AFTER_SECONDS;
}

export function rateLimitedPayload(retryAfterSeconds = DEFAULT_RETRY_AFTER_SECONDS) {
  return {
    error: 'rate_limited',
    retryAfterSeconds,
    message: 'For mange forespørsler akkurat nå. Prøv igjen om litt.',
  };
}

export function respondRateLimited(res, response) {
  return res.status(429).json(rateLimitedPayload(retryAfterSecondsFromResponse(response)));
}

export function isOpenAiRateLimited(status) {
  return status === 429 || status === 503;
}

export function isSerpApiRateLimitedResponse(status, data) {
  if (status === 429) return true;
  if (!data || typeof data !== 'object') return false;
  const err = data.error;
  const text =
    typeof err === 'string'
      ? err
      : err && typeof err === 'object'
        ? String(err.message ?? err.reason ?? '')
        : '';
  if (!text) return false;
  const lower = text.toLowerCase();
  return (
    lower.includes('rate') ||
    lower.includes('limit') ||
    lower.includes('throttl') ||
    lower.includes('quota') ||
    lower.includes('too many')
  );
}

/**
 * Ett valgfritt retry ved 429/503 (OpenAI).
 */
export async function fetchExternalWithOptionalRetry(url, options = {}) {
  let res = await fetch(url, options);
  if (isOpenAiRateLimited(res.status)) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    res = await fetch(url, options);
  }
  return res;
}

/**
 * Ett valgfritt retry ved 429 (SerpAPI / PageSpeed).
 */
export async function fetchExternalWithOptionalRetry429(url, options = {}) {
  let res = await fetch(url, options);
  if (res.status === 429) {
    await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    res = await fetch(url, options);
  }
  return res;
}
