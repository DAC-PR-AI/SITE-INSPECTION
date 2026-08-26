/**
 * In-memory rate limiter for auth endpoints.
 * Limits: 5 attempts per IP per role per 15-minute window.
 * On lockout, returns 429 Too Many Requests.
 *
 * NOTE: This is a process-level store — in multi-instance deployments
 * use Redis or Upstash for shared state. For single-instance Vercel
 * serverless (cold-start isolation per function), this still provides
 * meaningful protection against rapid sequential attacks on the same instance.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const MAX_ATTEMPTS = 5;

// Map: `${ip}:${roleId}` → { count, firstAttemptAt }
const attempts = new Map();
const MAX_MAP_SIZE = 5000;

function pruneExpired(now) {
  for (const [k, v] of attempts.entries()) {
    if (now - v.firstAttemptAt > WINDOW_MS) {
      attempts.delete(k);
    }
  }
}

// Automatically prune expired keys every 5 minutes in background
if (typeof setInterval !== "undefined") {
  const cleanupTimer = setInterval(() => pruneExpired(Date.now()), 5 * 60 * 1000);
  if (cleanupTimer.unref) cleanupTimer.unref(); // prevent timer from holding process open
}

function getKey(ip, roleId) {
  return `${ip}:${roleId}`;
}

/**
 * Check if the given IP+role is rate-limited.
 * @returns {{ limited: boolean, remaining: number, resetInMs: number }}
 */
export function checkRateLimit(ip, roleId, maxAttempts = MAX_ATTEMPTS) {
  const key = getKey(ip, roleId);
  const now = Date.now();
  
  if (attempts.size > MAX_MAP_SIZE) {
    pruneExpired(now);
  }

  const record = attempts.get(key);

  if (!record) {
    return { limited: false, remaining: maxAttempts };
  }

  const elapsed = now - record.firstAttemptAt;
  if (elapsed > WINDOW_MS) {
    // Window expired — reset
    attempts.delete(key);
    return { limited: false, remaining: maxAttempts };
  }

  if (record.count >= maxAttempts) {
    return {
      limited: true,
      remaining: 0,
      resetInMs: WINDOW_MS - elapsed,
    };
  }

  return { limited: false, remaining: maxAttempts - record.count };
}

/**
 * Record a failed attempt for this IP+role.
 */
export function recordFailedAttempt(ip, roleId) {
  const key = getKey(ip, roleId);
  const now = Date.now();
  
  if (attempts.size > MAX_MAP_SIZE) {
    pruneExpired(now);
  }

  const record = attempts.get(key);

  if (!record || now - record.firstAttemptAt > WINDOW_MS) {
    attempts.set(key, { count: 1, firstAttemptAt: now });
  } else {
    record.count++;
  }
}

/**
 * Clear the rate limit for this IP+role on successful auth.
 */
export function clearRateLimit(ip, roleId) {
  attempts.delete(getKey(ip, roleId));
}

/**
 * Get the client IP from a Next.js Request object.
 */
export function getClientIp(req) {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}
