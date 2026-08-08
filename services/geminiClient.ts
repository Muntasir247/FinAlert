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

  try {
    for (const model of models) {
      const endpoint = `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`;
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify(body),
      });

      if (response.ok) {
        return { response, model };
      }

      // Read the body to release the connection before retrying.
      await response.text();

      if (response.status !== 429) {
        return { response, model };
      }

      console.warn(`[Gemini] ${model} rate limited (429), trying next model...`);
    }

    throw new GeminiAllRateLimitedError();
  } finally {
    clearTimeout(timer);
  }
}
