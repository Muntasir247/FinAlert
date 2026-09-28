const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';

/**
 * Thrown when every model in the fallback chain returned HTTP 429
 * (rate limit / quota exhausted).
 */
export class GeminiAllRateLimitedError extends Error {}

export interface GeminiContentResponse {
  response: Response;
  model: string;
}

/**
 * Sends one generateContent request to the Gemini API, trying each model in
 * order. If a model returns 429 (rate limit / quota), the request is retried
 * against the next model in the chain. The first non-429 failure is returned
 * to the caller immediately, since retrying the same error on another model
 * would not help.
 *
 * Free-tier rate limits are enforced per model, so falling back to a different
 * model usually keeps the feature working until the primary quota resets.
 */
export async function generateGeminiContent({
  apiKey,
  models,
  body,
  timeoutMs,
}: {
  apiKey: string;
  models: string[];
  body: unknown;
  timeoutMs: number;
}): Promise<GeminiContentResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let lastError = '';

  try {
    for (const model of models) {
      const endpoint = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
      let response: Response;
      try {
        response = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify(body),
        });
      } catch (networkErr: unknown) {
        lastError = (networkErr as Error)?.message || 'Network request failed';
        console.warn(`[Gemini] ${model} network error: ${lastError}, trying next model...`);
        continue;
      }

      if (response.ok) {
        return { response, model };
      }

      const errText = await response.text().catch(() => '');
      lastError = `Status ${response.status}: ${errText.slice(0, 120)}`;

      // Retry on rate limits (429), model retirement/not found (404), high demand / overload (503), or server errors (500, 502, 504)
      const isRetryable =
        response.status === 429 ||
        response.status === 404 ||
        response.status === 503 ||
        response.status === 500 ||
        response.status === 502 ||
        response.status === 504;

      if (isRetryable) {
        console.warn(`[Gemini] ${model} returned ${response.status} (${lastError}), falling back to next model...`);
        continue;
      }

      // For non-retryable errors (e.g. 400 Bad Request), throw clear error with details
      throw new Error(`Gemini API error (${model} returned ${response.status}): ${errText || 'Bad Request'}`);
    }

    throw new GeminiAllRateLimitedError(
      `All Gemini AI models were temporarily unavailable or rate-limited. Last error: ${lastError}`
    );
  } finally {
    clearTimeout(timer);
  }
}
