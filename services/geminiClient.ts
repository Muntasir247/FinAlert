export const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

export interface ModelAttemptLog {
  model: string;
  status?: number;
  statusText?: string;
  durationMs: number;
  errorSnippet?: string;
  isRetryable?: boolean;
}

/**
 * Thrown when every model in the fallback chain returned HTTP 429
 * (rate limit / quota exhausted) or other retryable server errors (503, 500, etc.).
 */
export class GeminiAllRateLimitedError extends Error {
  public attempts: ModelAttemptLog[];
  public lastError: string;

  constructor(message: string, attempts: ModelAttemptLog[] = [], lastError = '') {
    super(message);
    this.name = 'GeminiAllRateLimitedError';
    this.attempts = attempts;
    this.lastError = lastError;
  }
}

export interface GeminiContentResponse {
  response: Response;
  model: string;
  attempts: ModelAttemptLog[];
}

/**
 * Sends one generateContent request to the Gemini API, trying each model in
 * order. If a model returns 429 (rate limit / quota) or 503/500, the request is retried
 * against the next model in the chain. Each model attempt has an individual timeout
 * to prevent hanging models from stalling the entire chain.
 */
export async function generateGeminiContent({
  apiKey,
  models,
  body,
  timeoutMs,
  perModelTimeoutMs = 25000,
}: {
  apiKey: string;
  models: string[];
  body: unknown;
  timeoutMs: number;
  perModelTimeoutMs?: number;
}): Promise<GeminiContentResponse> {
  const globalController = new AbortController();
  const globalTimer = setTimeout(() => globalController.abort(), timeoutMs);
  const attempts: ModelAttemptLog[] = [];
  let lastError = '';

  try {
    for (const model of models) {
      if (globalController.signal.aborted) {
        throw new Error('Overall request timeout reached');
      }

      const attemptStart = Date.now();
      const modelController = new AbortController();
      const modelTimer = setTimeout(
        () => modelController.abort(),
        Math.min(perModelTimeoutMs, Math.max(5000, timeoutMs - (Date.now() - attemptStart)))
      );

      // Link global abortion to model controller
      const abortHandler = () => modelController.abort();
      globalController.signal.addEventListener('abort', abortHandler, { once: true });

      const endpoint = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
      let response: Response;

      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: modelController.signal,
          body: JSON.stringify(body),
        });
      } catch (networkErr: unknown) {
        clearTimeout(modelTimer);
        globalController.signal.removeEventListener('abort', abortHandler);
        const durationMs = Date.now() - attemptStart;
        const errObj = networkErr as Error;
        const isTimeout = errObj?.name === 'AbortError' && !globalController.signal.aborted;
        const errMsg = isTimeout
          ? `Timed out after ${Math.round(durationMs / 1000)}s`
          : errObj?.message || 'Network request failed';

        lastError = `${model}: ${errMsg}`;
        console.warn(`[Gemini] ${model} attempt failed: ${lastError}, falling back...`);
        attempts.push({
          model,
          durationMs,
          errorSnippet: errMsg,
          isRetryable: true,
        });
        continue;
      } finally {
        clearTimeout(modelTimer);
        globalController.signal.removeEventListener('abort', abortHandler);
      }

      const durationMs = Date.now() - attemptStart;

      if (response.ok) {
        attempts.push({
          model,
          status: response.status,
          statusText: response.statusText,
          durationMs,
        });
        return { response, model, attempts };
      }

      const errText = await response.text().catch(() => '');
      const snippet = errText.slice(0, 160).replace(/\s+/g, ' ').trim();
      lastError = `Status ${response.status}: ${snippet}`;

      // Retry on rate limits (429), model retirement/not found (404), high demand / overload (503), or server errors (500, 502, 504)
      const isRetryable =
        response.status === 429 ||
        response.status === 404 ||
        response.status === 503 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 504;

      attempts.push({
        model,
        status: response.status,
        statusText: response.statusText,
        durationMs,
        errorSnippet: snippet || response.statusText,
        isRetryable,
      });

      if (isRetryable) {
        console.warn(`[Gemini] ${model} returned ${response.status} (${lastError}), falling back to next model...`);
        continue;
      }

      // For non-retryable errors (e.g. 400 Bad Request), throw clear error with details
      throw new Error(`Gemini API error (${model} returned ${response.status}): ${errText || 'Bad Request'}`);
    }

    throw new GeminiAllRateLimitedError(
      `All Gemini AI models were temporarily unavailable or rate-limited. Last error: ${lastError}`,
      attempts,
      lastError
    );
  } finally {
    clearTimeout(globalTimer);
  }
}

/**
 * Pings a specific Gemini model with a lightweight test prompt to check status.
 */
export async function testGeminiModel(
  apiKey: string,
  model: string,
  timeoutMs = 7000
): Promise<{
  model: string;
  status: number | 'network_error';
  statusText: string;
  durationMs: number;
  errorSnippet?: string;
  ok: boolean;
}> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const endpoint = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: 'Respond with OK.' }] }],
      }),
    });

    const durationMs = Date.now() - start;
    if (res.ok) {
      return {
        model,
        status: res.status,
        statusText: 'OK',
        durationMs,
        ok: true,
      };
    }

    const txt = await res.text().catch(() => '');
    const snippet = txt.slice(0, 140).replace(/\s+/g, ' ').trim();
    return {
      model,
      status: res.status,
      statusText: res.statusText || 'Error',
      durationMs,
      errorSnippet: snippet,
      ok: false,
    };
  } catch (err: unknown) {
    const durationMs = Date.now() - start;
    const isTimeout = (err as Error)?.name === 'AbortError';
    return {
      model,
      status: 'network_error',
      statusText: isTimeout ? `Timeout (${timeoutMs / 1000}s)` : 'Network Error',
      durationMs,
      errorSnippet: (err as Error)?.message || 'Failed to connect',
      ok: false,
    };
  } finally {
    clearTimeout(timer);
  }
}
