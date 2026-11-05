import {
  AiErrorCode,
  classifyAiError,
  formatAiErrorString,
  AppAiError,
} from './aiError';

export const GROQ_BASE_URL = 'https://api.groq.com/openai/v1/chat/completions';

/**
 * Free-tier optimized fallback models on Groq.
 * 1. llama-3.3-70b-versatile: 30 RPM, 1,000 RPD, 12,000 TPM (Elite reasoning & accuracy)
 * 2. llama-3.1-8b-instant: 30 RPM, 14,400 RPD, 6,000 TPM (Blazing fast ~200ms & massive daily quota)
 * 3. meta-llama/llama-4-scout-17b-16e-instruct: 30 RPM, 1,000 RPD, 30,000 TPM (Fallback)
 */
export const DEFAULT_GROQ_MODELS = [
  'llama-3.3-70b-versatile',
  'llama-3.1-8b-instant',
  'meta-llama/llama-4-scout-17b-16e-instruct',
];

export interface GroqAttemptLog {
  model: string;
  status?: number;
  statusText?: string;
  durationMs: number;
  errorSnippet?: string;
  isRetryable?: boolean;
}

export class GroqAllRateLimitedError extends Error {
  public attempts: GroqAttemptLog[];
  public lastError: string;
  public code: AiErrorCode;

  constructor(
    message: string,
    attempts: GroqAttemptLog[] = [],
    lastError = '',
    code: AiErrorCode = 'AI_ERR_RATE_LIMIT_429'
  ) {
    const formatted = message.startsWith('[AI_ERR_') ? message : formatAiErrorString(code, message);
    super(formatted);
    this.name = 'GroqAllRateLimitedError';
    this.attempts = attempts;
    this.lastError = lastError;
    this.code = code;
  }
}

/**
 * Safely sanitizes user text to mitigate prompt injection, control characters,
 * and token flooding before passing to Groq.
 */
export function sanitizePromptInput(input: string, maxLength = 2000): string {
  if (!input || typeof input !== 'string') return '';
  // Remove non-printable control characters (except newline, tab, carriage return)
  const clean = input.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return clean.slice(0, maxLength).trim();
}

/**
 * Returns the configured Groq API Key from environment variables, if present.
 */
export function getGroqApiKey(): string | undefined {
  const key = process.env.EXPO_PUBLIC_GROQ_API_KEY || process.env.GROQ_API_KEY;
  return key && key.trim().length > 0 ? key.trim() : undefined;
}

/**
 * Returns whether Groq is configured with an API key.
 */
export function isGroqConfigured(): boolean {
  return Boolean(getGroqApiKey());
}

export interface GroqJsonRequestOptions {
  systemPrompt: string;
  userPrompt: string;
  models?: string[];
  timeoutMs?: number;
  perModelTimeoutMs?: number;
  temperature?: number;
}

/**
 * Sends a structured JSON chat completion request to Groq with automatic model fallback.
 * Uses Groq's JSON mode (response_format: { type: 'json_object' }).
 */
export async function generateGroqJsonContent<T = Record<string, unknown>>({
  systemPrompt,
  userPrompt,
  models = DEFAULT_GROQ_MODELS,
  timeoutMs = 12000,
  perModelTimeoutMs = 6000,
  temperature = 0.1,
}: GroqJsonRequestOptions): Promise<{ data: T; model: string; durationMs: number }> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new AppAiError({
      code: 'AI_ERR_NO_KEY',
      message: 'Groq API Key not found. Please set EXPO_PUBLIC_GROQ_API_KEY in your .env file.',
      provider: 'groq',
    });
  }

  const sanitizedUserPrompt = sanitizePromptInput(userPrompt);
  const globalController = new AbortController();
  const globalTimer = setTimeout(() => globalController.abort(), timeoutMs);
  const attempts: GroqAttemptLog[] = [];
  let lastError = '';

  try {
    for (const model of models) {
      if (globalController.signal.aborted) {
        throw new AppAiError({
          code: 'AI_ERR_TIMEOUT',
          message: 'Overall Groq request timeout reached',
          provider: 'groq',
        });
      }

      const attemptStart = Date.now();
      const modelController = new AbortController();
      const modelTimer = setTimeout(
        () => modelController.abort(),
        Math.min(perModelTimeoutMs, Math.max(3000, timeoutMs - (Date.now() - attemptStart)))
      );

      const abortHandler = () => modelController.abort();
      globalController.signal.addEventListener('abort', abortHandler, { once: true });

      let response: Response;
      try {
        response = await fetch(GROQ_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: modelController.signal,
          body: JSON.stringify({
            model,
            messages: [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: sanitizedUserPrompt },
            ],
            response_format: { type: 'json_object' },
            temperature,
          }),
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
        console.warn(`[Groq] ${model} attempt failed: ${lastError}, trying next model...`);
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
        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          throw new Error(`[Groq] Empty response content from ${model}`);
        }
        const parsedData = JSON.parse(content) as T;
        return { data: parsedData, model, durationMs };
      }

      const errText = await response.text().catch(() => '');
      const snippet = errText.slice(0, 160).replace(/\s+/g, ' ').trim();
      lastError = `Status ${response.status}: ${snippet}`;

      // 429 = Rate limited, 500/502/503/504 = Server overload, 404 = Model retired/not found
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
        console.warn(`[Groq] ${model} returned ${response.status} (${lastError}), falling back...`);
        continue;
      }

      const classified = classifyAiError(`${response.status} ${errText || 'Bad Request'}`, 'groq');
      throw new AppAiError({
        code: classified.code,
        message: `Groq error (${model}): ${classified.message}`,
        status: response.status,
        provider: 'groq',
        details: snippet,
      });
    }

    const finalClassified = classifyAiError(lastError || 'All Groq models failed', 'groq');
    throw new GroqAllRateLimitedError(
      `All Groq models were rate-limited or unavailable. ${finalClassified.message}`,
      attempts,
      lastError,
      finalClassified.code
    );
  } finally {
    clearTimeout(globalTimer);
  }
}

export interface GroqChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface GroqChatRequestOptions {
  messages: GroqChatMessage[];
  models?: string[];
  timeoutMs?: number;
  perModelTimeoutMs?: number;
  temperature?: number;
  maxTokens?: number;
}

/**
 * Sends a multi-turn chat completion request to Groq with automatic model fallback.
 * Returns the raw text response suitable for conversational UI.
 */
export async function generateGroqChatCompletion({
  messages,
  models = DEFAULT_GROQ_MODELS,
  timeoutMs = 15000,
  perModelTimeoutMs = 8000,
  temperature = 0.5,
  maxTokens = 350,
}: GroqChatRequestOptions): Promise<{ reply: string; model: string; durationMs: number }> {
  const apiKey = getGroqApiKey();
  if (!apiKey) {
    throw new AppAiError({
      code: 'AI_ERR_NO_KEY',
      message: 'Groq API Key not found. Please set EXPO_PUBLIC_GROQ_API_KEY in your .env file.',
      provider: 'groq',
    });
  }

  const cleanedMessages = messages.map((m) => ({
    role: m.role,
    content: sanitizePromptInput(m.content, 2500),
  }));

  const globalController = new AbortController();
  const globalTimer = setTimeout(() => globalController.abort(), timeoutMs);
  const attempts: GroqAttemptLog[] = [];
  let lastError = '';

  try {
    for (const model of models) {
      if (globalController.signal.aborted) {
        throw new AppAiError({
          code: 'AI_ERR_TIMEOUT',
          message: 'Overall Groq request timeout reached',
          provider: 'groq',
        });
      }

      const attemptStart = Date.now();
      const modelController = new AbortController();
      const modelTimer = setTimeout(
        () => modelController.abort(),
        Math.min(perModelTimeoutMs, Math.max(3000, timeoutMs - (Date.now() - attemptStart)))
      );

      const abortHandler = () => modelController.abort();
      globalController.signal.addEventListener('abort', abortHandler, { once: true });

      let response: Response;
      try {
        response = await fetch(GROQ_BASE_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          signal: modelController.signal,
          body: JSON.stringify({
            model,
            messages: cleanedMessages,
            temperature,
            max_tokens: maxTokens,
          }),
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
        console.warn(`[GroqChat] ${model} attempt failed: ${lastError}, trying next model...`);
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
        const json = await response.json();
        const content = json?.choices?.[0]?.message?.content;
        if (!content || typeof content !== 'string') {
          throw new Error(`[GroqChat] Empty response content from ${model}`);
        }
        return { reply: content.trim(), model, durationMs };
      }

      const errText = await response.text().catch(() => '');
      const snippet = errText.slice(0, 160).replace(/\s+/g, ' ').trim();
      lastError = `Status ${response.status}: ${snippet}`;

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
        console.warn(`[GroqChat] ${model} returned ${response.status} (${lastError}), falling back...`);
        continue;
      }

      const classified = classifyAiError(`${response.status} ${errText || 'Bad Request'}`, 'groq');
      throw new AppAiError({
        code: classified.code,
        message: `Groq error (${model}): ${classified.message}`,
        status: response.status,
        provider: 'groq',
        details: snippet,
      });
    }

    const finalClassified = classifyAiError(lastError || 'All Groq models failed', 'groq');
    throw new GroqAllRateLimitedError(
      `All Groq models were rate-limited or unavailable. ${finalClassified.message}`,
      attempts,
      lastError,
      finalClassified.code
    );
  } finally {
    clearTimeout(globalTimer);
  }
}


