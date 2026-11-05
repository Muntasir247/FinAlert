/**
 * Standard AI Error Codes for FinAlert.
 * Every AI error surfaces one of these distinct codes so users and developers
 * can instantly identify the root cause on real mobile devices.
 */
export type AiErrorCode =
  | 'AI_ERR_NO_KEY'          // Missing or unconfigured API key in .env
  | 'AI_ERR_RATE_LIMIT_429'  // Rate limit / daily quota exhausted
  | 'AI_ERR_TIMEOUT'         // Request took too long (network slow / server stalled)
  | 'AI_ERR_NETWORK'         // Device offline / DNS failure / no internet
  | 'AI_ERR_AUTH_401'        // 401 Unauthorized (Invalid API key)
  | 'AI_ERR_FORBIDDEN_403'   // 403 Forbidden (API disabled or geo-restricted)
  | 'AI_ERR_MODEL_404'       // 404 Model identifier not found or retired
  | 'AI_ERR_SERVER_503'      // 503 Service overloaded / High demand
  | 'AI_ERR_SERVER_500'      // 500 / 502 / 504 Internal server error
  | 'AI_ERR_BAD_REQUEST_400' // 400 Bad request (payload or image format rejected)
  | 'AI_ERR_PARSE'           // Model output could not be parsed into expected JSON
  | 'AI_ERR_UNKNOWN';        // Unclassified error

export interface ClassifiedAiError {
  code: AiErrorCode;
  message: string;
  provider?: 'gemini' | 'groq' | 'all';
  status?: number;
  details?: string;
}

/**
 * Inspects any raw error from fetch, Gemini, Groq, or timeouts and classifies it into
 * a standardized AiErrorCode with an actionable human-readable message.
 */
export function classifyAiError(
  error: unknown,
  provider?: 'gemini' | 'groq' | 'all'
): ClassifiedAiError {
  if (error instanceof AppAiError) {
    return {
      code: error.code,
      message: error.rawMessage || error.message,
      provider: error.provider || provider,
      status: error.status,
      details: error.details,
    };
  }

  const msg = error instanceof Error ? error.message : String(error || '');
  const errName = error instanceof Error ? error.name : '';

  // 1. Missing Key
  if (
    msg.includes('not configured') ||
    msg.includes('Missing') ||
    (msg.includes('not found') && msg.includes('API_KEY'))
  ) {
    return {
      code: 'AI_ERR_NO_KEY',
      message: 'AI API key is missing. Add EXPO_PUBLIC_GEMINI_API_KEY or EXPO_PUBLIC_GROQ_API_KEY in your .env file.',
      provider,
      details: msg,
    };
  }

  // 2. Timeout
  if (
    errName === 'AbortError' ||
    msg.toLowerCase().includes('timeout') ||
    msg.toLowerCase().includes('timed out')
  ) {
    return {
      code: 'AI_ERR_TIMEOUT',
      message: 'AI request timed out. The server is responding too slowly; please check your connection and retry.',
      provider,
      details: msg,
    };
  }

  // 3. Network / Connection
  if (
    msg.toLowerCase().includes('network') ||
    msg.toLowerCase().includes('failed to fetch') ||
    msg.toLowerCase().includes('cannot connect') ||
    msg.toLowerCase().includes('offline')
  ) {
    return {
      code: 'AI_ERR_NETWORK',
      message: 'Cannot connect to AI servers. Please check your WiFi or mobile data connection.',
      provider,
      details: msg,
    };
  }

  // 4. Rate limit 429
  if (
    msg.includes('429') ||
    msg.toLowerCase().includes('rate limit') ||
    msg.toLowerCase().includes('quota') ||
    msg.toLowerCase().includes('resource has been exhausted')
  ) {
    return {
      code: 'AI_ERR_RATE_LIMIT_429',
      message: 'AI rate limit or free-tier quota reached. Please wait 30 seconds and try again.',
      provider,
      status: 429,
      details: msg,
    };
  }

  // 5. Auth 401 / 403
  if (msg.includes('401') || msg.toLowerCase().includes('unauthorized') || msg.toLowerCase().includes('invalid api key')) {
    return {
      code: 'AI_ERR_AUTH_401',
      message: 'Invalid or expired API key. Please check your API key in .env.',
      provider,
      status: 401,
      details: msg,
    };
  }
  if (msg.includes('403') || msg.toLowerCase().includes('forbidden') || msg.toLowerCase().includes('permission_denied')) {
    return {
      code: 'AI_ERR_FORBIDDEN_403',
      message: 'AI API access forbidden. The API key does not have permission or the region is restricted.',
      provider,
      status: 403,
      details: msg,
    };
  }

  // 6. Model 404
  if (msg.includes('404') || msg.toLowerCase().includes('not found')) {
    return {
      code: 'AI_ERR_MODEL_404',
      message: 'Requested AI model was not found or has been retired by the provider.',
      provider,
      status: 404,
      details: msg,
    };
  }

  // 7. Server 503 / 500
  if (
    msg.includes('503') ||
    msg.toLowerCase().includes('overloaded') ||
    msg.toLowerCase().includes('high demand') ||
    msg.toLowerCase().includes('service unavailable')
  ) {
    return {
      code: 'AI_ERR_SERVER_503',
      message: 'AI servers are temporarily overloaded with high demand (503). Please retry in a few moments.',
      provider,
      status: 503,
      details: msg,
    };
  }
  if (msg.includes('500') || msg.includes('502') || msg.includes('504')) {
    return {
      code: 'AI_ERR_SERVER_500',
      message: 'AI server encountered a temporary internal error. Please try again.',
      provider,
      status: 500,
      details: msg,
    };
  }

  // 8. Bad Request 400
  if (msg.includes('400') || msg.toLowerCase().includes('bad request') || msg.toLowerCase().includes('invalid argument')) {
    return {
      code: 'AI_ERR_BAD_REQUEST_400',
      message: 'AI request was rejected (400 Bad Request). Input format or image size may be unsupported.',
      provider,
      status: 400,
      details: msg,
    };
  }

  // 9. JSON Parse error
  if (msg.toLowerCase().includes('json') || msg.toLowerCase().includes('parse')) {
    return {
      code: 'AI_ERR_PARSE',
      message: 'AI model returned an unparseable or malformed response structure.',
      provider,
      details: msg,
    };
  }

  // Fallback
  return {
    code: 'AI_ERR_UNKNOWN',
    message: msg || 'An unexpected error occurred while communicating with the AI service.',
    provider,
    details: msg,
  };
}

/**
 * Formats an error string guaranteed to have `[AI_ERR_...]` prefix.
 */
export function formatAiErrorString(
  code: AiErrorCode,
  message: string,
  extraSnippet?: string
): string {
  const base = `[${code}] ${message}`;
  return extraSnippet && extraSnippet.trim() ? `${base} (${extraSnippet.trim()})` : base;
}

/**
 * Standard Application AI Error.
 * Automatically prefixes the message with `[AI_ERR_...]`.
 */
export class AppAiError extends Error {
  public code: AiErrorCode;
  public provider?: 'gemini' | 'groq' | 'all';
  public status?: number;
  public details?: string;
  public rawMessage: string;

  constructor({
    code,
    message,
    provider,
    status,
    details,
  }: {
    code: AiErrorCode;
    message: string;
    provider?: 'gemini' | 'groq' | 'all';
    status?: number;
    details?: string;
  }) {
    const formatted = formatAiErrorString(code, message);
    super(formatted);
    this.name = 'AppAiError';
    this.code = code;
    this.provider = provider;
    this.status = status;
    this.details = details;
    this.rawMessage = message;
  }
}

