/**
 * Rate limiter for auth endpoints.
 * Limits: 5 attempts per IP per role per 15-minute window.
 * On lockout, returns 429 Too Many Requests.
 *
 * Supports Upstash Redis REST API when UPSTASH_REDIS_REST_URL and
 * UPSTASH_REDIS_REST_TOKEN are configured. Gracefully falls back to
 * in-memory Map store when unset, errored, or timed out.
 */

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes
const WINDOW_SECONDS = 15 * 60; // 900 seconds
const MAX_ATTEMPTS = 5;

// In-memory fallback map: `${ip}:${roleId}` → { count, firstAttemptAt }
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

function getUpstashConfig() {
  const url = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (url && token && url.trim() && token.trim()) {
    return { url: url.trim().replace(/\/$/, ""), token: token.trim() };
  }
  return null;
}

async function upstashCommand(command) {
  const cfg = getUpstashConfig();
  if (!cfg) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(cfg.url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(command),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

async function upstashPipeline(commands) {
  const cfg = getUpstashConfig();
  if (!cfg) return null;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 2000);
  try {
    const res = await fetch(`${cfg.url}/pipeline`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${cfg.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(commands),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json) ? json.map((r) => r?.result) : null;
  } catch {
    clearTimeout(timeoutId);
    return null;
  }
}

/**
 * Check if the given IP+role is rate-limited.
 * @returns {Promise<{ limited: boolean, remaining: number, resetInMs?: number }>}
 */
export async function checkRateLimit(ip, roleId, maxAttempts = MAX_ATTEMPTS) {
  const cfg = getUpstashConfig();
  const redisKey = `ratelimit:${getKey(ip, roleId)}`;

  if (cfg) {
    try {
      const results = await upstashPipeline([
        ["GET", redisKey],
        ["TTL", redisKey],
      ]);
      if (results && results.length === 2) {
        const countVal = results[0];
        const ttlVal = results[1];
        const count = countVal ? parseInt(countVal, 10) : 0;
        const ttl = typeof ttlVal === "number" ? ttlVal : -1;

        if (count >= maxAttempts) {
          const resetInMs = ttl > 0 ? ttl * 1000 : WINDOW_MS;
          return { limited: true, remaining: 0, resetInMs };
        }
        return { limited: false, remaining: Math.max(0, maxAttempts - count) };
      }
    } catch {
      // Fall through to in-memory check
    }
  }

  // In-memory fallback
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
export async function recordFailedAttempt(ip, roleId) {
  const cfg = getUpstashConfig();
  const redisKey = `ratelimit:${getKey(ip, roleId)}`;

  if (cfg) {
    try {
      const incrResult = await upstashCommand(["INCR", redisKey]);
      if (typeof incrResult === "number") {
        if (incrResult === 1) {
          await upstashCommand(["EXPIRE", redisKey, WINDOW_SECONDS]);
        }
        return;
      }
    } catch {
      // Fall through to in-memory record
    }
  }

  // In-memory fallback
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
export async function clearRateLimit(ip, roleId) {
  const cfg = getUpstashConfig();
  const redisKey = `ratelimit:${getKey(ip, roleId)}`;

  if (cfg) {
    try {
      await upstashCommand(["DEL", redisKey]);
    } catch {
      // Fall through
    }
  }

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
