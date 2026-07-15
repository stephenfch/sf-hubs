// =============================================================================
// Travel Journal Worker — CF Workers + KV
// Endpoints:
//   GET  /journal/:tripId    → read journal entries from KV
//   POST /journal/:tripId    → append {day, time, spot, caption, photo} to KV
//
// KV key format:  journal::<tripId>
// Value: JSON array of journal entry objects
//
// Rate limit: ~30 POSTs/min per IP (sliding window, in-memory)
// =============================================================================

// ── KV binding ──────────────────────────────────────────────────────────────
// Bound via wrangler.toml → [[kv_namespaces]] binding = "JOURNAL_KV"

// ── In-memory rate limiter (per-IP sliding window) ──────────────────────────
const rateWindowMs = 60_000;       // 1 minute
const maxReqsPerWindow = 30;       // from RATE_LIMIT var

/**
 * @param {Request} request
 * @param {Env} env
 * @param {ExecutionContext} ctx
 */
export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // ── CORS preflight ────────────────────────────────────────────────────
    if (request.method === "OPTIONS") {
      return corsResponse(null, 204, env);
    }

    // ── Route: GET /journal/:tripId ───────────────────────────────────────
    const getMatch = path.match(/^\/journal\/([\w-]+)$/);
    if (request.method === "GET" && getMatch) {
      return handleGet(getMatch[1], env);
    }

    // ── Route: POST /journal/:tripId ──────────────────────────────────────
    const postMatch = path.match(/^\/journal\/([\w-]+)$/);
    if (request.method === "POST" && postMatch) {
      // Rate limit check
      const clientIP = request.headers.get("CF-Connecting-IP") || "unknown";
      if (!rateLimitOK(clientIP, env)) {
        return corsResponse({ error: "rate_limited", message: "Too many requests. Try again later." }, 429, env);
      }
      return handlePost(postMatch[1], request, env);
    }

    // ── Health check ─────────────────────────────────────────────────────
    if (path === "/health") {
      return corsResponse({ ok: true, ts: Date.now() }, 200, env);
    }

    // ── 404 ──────────────────────────────────────────────────────────────
    return corsResponse({ error: "not_found" }, 404, env);
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// GET /journal/:tripId
// ═══════════════════════════════════════════════════════════════════════════
async function handleGet(tripId, env) {
  try {
    const key = `journal::${tripId}`;
    const raw = await env.JOURNAL_KV.get(key);

    let entries = [];
    if (raw) {
      try {
        entries = JSON.parse(raw);
        if (!Array.isArray(entries)) entries = [];
      } catch (e) {
        entries = [];
      }
    }

    return corsResponse({ tripId, count: entries.length, entries }, 200, env);
  } catch (err) {
    return corsResponse({ error: "kv_read_error", message: err.message }, 500, env);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// POST /journal/:tripId
// Body: { day: number, time: string, spot: string, caption?: string, photo?: string }
// ═══════════════════════════════════════════════════════════════════════════
async function handlePost(tripId, request, env) {
  let body;
  try {
    body = await request.json();
  } catch (e) {
    return corsResponse({ error: "invalid_json", message: "Request body must be valid JSON" }, 400, env);
  }

  // Validate required fields
  if (!body || typeof body.day !== "number" || typeof body.spot !== "string" || !body.spot.trim()) {
    return corsResponse({
      error: "validation_failed",
      message: "Missing required fields: day (number), spot (string)",
      received: body,
    }, 400, env);
  }

  // Build entry
  const entry = {
    day: body.day,
    time: String(body.time || ""),
    spot: String(body.spot).trim(),
    caption: String(body.caption || ""),
    photo: String(body.photo || ""),
    postedAt: new Date().toISOString(),
  };

  try {
    const key = `journal::${tripId}`;

    // Read existing entries, append, write back
    const raw = await env.JOURNAL_KV.get(key);
    let entries = [];
    if (raw) {
      try {
        entries = JSON.parse(raw);
        if (!Array.isArray(entries)) entries = [];
      } catch (e) {
        entries = [];
      }
    }

    entries.push(entry);

    await env.JOURNAL_KV.put(key, JSON.stringify(entries));

    return corsResponse({ ok: true, tripId, entry, total: entries.length }, 201, env);
  } catch (err) {
    return corsResponse({ error: "kv_write_error", message: err.message }, 500, env);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// CORS helper
// ═══════════════════════════════════════════════════════════════════════════
function corsResponse(body, status, env) {
  const origin = (env && env.ALLOWED_ORIGIN) || "*";
  const headers = new Headers({
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Max-Age": "86400",
  });

  if (body !== null) {
    headers.set("Content-Type", "application/json; charset=utf-8");
    return new Response(JSON.stringify(body), { status, headers });
  }
  return new Response(null, { status, headers });
}

// ═══════════════════════════════════════════════════════════════════════════
// Simple in-memory rate limiter (per-IP sliding window)
// Uses a global Map; resets on Worker cold start (acceptable for free tier)
// ═══════════════════════════════════════════════════════════════════════════
const rateMap = new Map(); // IP → { count, windowStart }

function rateLimitOK(ip, env) {
  const limit = parseInt((env && env.RATE_LIMIT) || "30", 10);
  const now = Date.now();

  let record = rateMap.get(ip);
  if (!record || (now - record.windowStart) > rateWindowMs) {
    // New window
    rateMap.set(ip, { count: 1, windowStart: now });
    return true;
  }

  record.count++;
  if (record.count > limit) {
    return false;
  }
  return true;
}
