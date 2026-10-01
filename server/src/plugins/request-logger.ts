import { FastifyInstance, FastifyPluginAsync, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { env } from '../config/env.js';

const SENSITIVE_PARAM_NAMES = new Set([
  'password',
  'token',
  'refreshtoken',
  'accesstoken',
  'authtoken',
  'temptoken',
  'secret',
  'otp',
  'code',
  'authorization',
  'cookie',
  'key',
  'apikey',
  'hash',
  'session',
  'sessionid',
  'signature'
]);

/**
 * Checks if a parameter name is sensitive (case, underscore, and hyphen insensitive).
 */
export function isSensitiveParam(key: string): boolean {
  const normalized = key.toLowerCase().replace(/[-_]/g, '');
  return SENSITIVE_PARAM_NAMES.has(normalized);
}

/**
 * Strips or redacts sensitive query parameter values in URLs for safe logging.
 * Handles normal query strings, normalized keys (access_token, api_key), and URL-encoded delimiters (%3D).
 */
export function sanitizeUrl(rawUrl: string): string {
  try {
    const qIndex = rawUrl.indexOf('?');
    if (qIndex === -1) return rawUrl;

    const pathname = rawUrl.slice(0, qIndex);
    let rawQuery = rawUrl.slice(qIndex + 1);

    // Normalize URL-encoded delimiters if present (e.g. %3D for '=' or %26 for '&')
    if (/%3[Dd]|%26/i.test(rawQuery)) {
      rawQuery = rawQuery.replace(/%3[Dd]/g, '=').replace(/%26/g, '&');
    }

    const searchParams = new URLSearchParams(rawQuery);
    const sanitizedParams = new URLSearchParams();

    for (const [key, value] of searchParams.entries()) {
      if (isSensitiveParam(key)) {
        sanitizedParams.set(key, '[REDACTED]');
      } else {
        sanitizedParams.set(key, value);
      }
    }

    const cleanedQuery = sanitizedParams.toString();
    return cleanedQuery ? `${pathname}?${cleanedQuery}` : pathname;
  } catch {
    return rawUrl;
  }
}

/**
 * Strips secrets, bearer tokens, or connection strings from error messages.
 */
export function sanitizeErrorMessage(msg?: string): string {
  if (!msg) return '';
  let safe = msg.replace(/Bearer\s+[A-Za-z0-9-_=.]+/gi, 'Bearer [REDACTED]');
  safe = safe.replace(/:\/\/([^:]+):([^@]+)@/g, '://$1:[REDACTED]@');
  safe = safe.replace(/([?&](?:token|password|secret|key|access_token|refresh_token)=)[^&\s]+/gi, '$1[REDACTED]');
  const singleLine = safe.replace(/[\r\n]+/g, ' ').trim();
  return singleLine.length > 150 ? `${singleLine.slice(0, 147)}...` : singleLine;
}

/**
 * Formats a UTC timestamp as [HH:MM:SS UTC]
 */
function formatUtcTimestamp(date: Date = new Date()): string {
  const hours = String(date.getUTCHours()).padStart(2, '0');
  const minutes = String(date.getUTCMinutes()).padStart(2, '0');
  const seconds = String(date.getUTCSeconds()).padStart(2, '0');
  return `[${hours}:${minutes}:${seconds} UTC]`;
}

// Configurable slow request threshold in ms (defaults to 1000ms)
const SLOW_REQUEST_THRESHOLD_MS = Number(process.env.SLOW_REQUEST_THRESHOLD_MS) || 1000;

// ANSI color codes for local dev terminal readability
const ANSI = {
  reset: '\x1b[0m',
  bold: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m'
};

const requestLoggerPluginImpl: FastifyPluginAsync = async (app: FastifyInstance) => {
  const isDev = env.NODE_ENV === 'development';

  // Capture error on request so onResponse can format it in a single line
  app.addHook('onError', async (request: FastifyRequest, _reply: FastifyReply, error: Error) => {
    (request as any)._errorMsg = error.message || 'Internal Server Error';
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = Math.round(reply.elapsedTime || 0);
    const method = request.method.padEnd(7, ' ');
    const safeUrl = sanitizeUrl(request.url);
    const statusCode = reply.statusCode;
    const reqId = request.id || 'req-?';
    const isOptions = request.method === 'OPTIONS';
    const isSlow = !isOptions && duration >= SLOW_REQUEST_THRESHOLD_MS;
    const isError = statusCode >= 500;
    const isWarn = isSlow;

    const level = isError ? 'ERROR' : isWarn ? 'WARN ' : 'INFO ';
    const timestamp = formatUtcTimestamp();

    if (isDev) {
      // Pick status color
      const statusColor =
        statusCode >= 500
          ? ANSI.red
          : statusCode >= 400
          ? ANSI.yellow
          : statusCode >= 300
          ? ANSI.cyan
          : ANSI.green;

      // Pick level color
      const levelColor = isError ? ANSI.red : isWarn ? ANSI.yellow : ANSI.blue;

      const slowTag = isSlow ? `  ${ANSI.bold}${ANSI.yellow}SLOW${ANSI.reset}` : '';

      const baseLine = `${ANSI.gray}${timestamp}${ANSI.reset} ${levelColor}${level}${ANSI.reset} ${ANSI.magenta}${reqId}${ANSI.reset}  ${ANSI.bold}${method}${ANSI.reset} ${safeUrl}  →  ${statusColor}${statusCode}${ANSI.reset} ${duration}ms${slowTag}`;

      const rawErrorMsg = (request as any)._errorMsg;
      if (isError && rawErrorMsg) {
        const safeErrorMsg = sanitizeErrorMessage(rawErrorMsg);
        // eslint-disable-next-line no-console
        console.log(`${baseLine}  ${ANSI.red}error=${safeErrorMsg}${ANSI.reset}`);
      } else {
        // eslint-disable-next-line no-console
        console.log(baseLine);
      }
    } else {
      // Production: structured single JSON entry
      request.log.info({
        reqId,
        method: request.method,
        url: safeUrl,
        statusCode,
        responseTimeMs: duration,
        isSlow,
        error: (request as any)._errorMsg ? sanitizeErrorMessage((request as any)._errorMsg) : undefined
      });
    }
  });
};

export const registerRequestLogger = fp(requestLoggerPluginImpl, {
  name: 'request-logger'
});
