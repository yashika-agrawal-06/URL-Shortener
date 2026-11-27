/**
 * Zero-dependency load-testing script for the URL Shortener service.
 *
 * Usage:
 *   node load-test/load-test.mjs
 *
 * Environment variables:
 *   TARGET_URL   Base URL of Nginx or backend service (default: http://localhost:8080)
 *   MODE         "mixed" | "shorten" | "redirect" | "health" (default: mixed)
 *   STAGES       Comma-separated concurrency:durationSec pairs
 *                (default: "5:15,15:20,30:30,50:30")
 *   TIMEOUT_MS   Per-request timeout in ms (default: 10000)
 */

const TARGET_URL = (process.env.TARGET_URL || 'http://localhost:8080').replace(/\/$/, '');
const MODE = (process.env.MODE || 'mixed').toLowerCase();
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS || 10000);
const STAGES_RAW = process.env.STAGES || '5:15,15:20,30:30,50:30';

const VALID_MODES = new Set(['mixed', 'shorten', 'redirect', 'health']);
if (!VALID_MODES.has(MODE)) {
  console.error(`Invalid MODE "${MODE}". Expected one of: ${[...VALID_MODES].join(', ')}`);
  process.exit(1);
}

const stages = STAGES_RAW.split(',').map((entry) => {
  const [cStr, dStr] = entry.trim().split(':');
  const concurrency = Number(cStr);
  const durationSec = Number(dStr);
  if (!Number.isInteger(concurrency) || concurrency <= 0 || !Number.isFinite(durationSec) || durationSec <= 0) {
    console.error(`Invalid stage "${entry}". Expected "<concurrency>:<durationSec>", e.g. "10:20".`);
    process.exit(1);
  }
  return { concurrency, durationSec };
});

function extractShortCode(shortUrl) {
  if (typeof shortUrl !== 'string') return null;
  const parts = shortUrl.split('/').filter(Boolean);
  return parts.length > 0 ? parts[parts.length - 1] : null;
}

async function shortenRequest(counter) {
  const res = await fetch(`${TARGET_URL}/api/shorten`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ originalUrl: `https://example.com/load-test/${counter}` }),
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });

  let code = null;
  if (res.ok) {
    const data = await res.json().catch(() => null);
    code = extractShortCode(data?.shortUrl);
  } else {
    await res.arrayBuffer().catch(() => {});
  }
  return { status: res.status, ok: res.ok, code };
}

async function redirectRequest(code) {
  const res = await fetch(`${TARGET_URL}/api/${code}`, {
    method: 'GET',
    redirect: 'manual',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  await res.arrayBuffer().catch(() => {});
  const ok = res.status >= 200 && res.status < 400;
  return { status: res.status, ok };
}

async function healthRequest() {
  const res = await fetch(`${TARGET_URL}/health`, {
    method: 'GET',
    signal: AbortSignal.timeout(TIMEOUT_MS),
  });
  await res.arrayBuffer().catch(() => {});
  return { status: res.status, ok: res.ok };
}

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.ceil((p / 100) * sorted.length) - 1);
  return sorted[idx];
}

function summarize(label, elapsedMs, latencies, statusCounts, errors) {
  const total = latencies.length;
  const sorted = [...latencies].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, v) => acc + v, 0);
  const avgMs = total > 0 ? sum / total : 0;
  const p95Ms = percentile(sorted, 95);
  const maxMs = total > 0 ? sorted[sorted.length - 1] : 0;
  const rps = elapsedMs > 0 ? total / (elapsedMs / 1000) : 0;
  const errorRate = total > 0 ? (errors / total) * 100 : 0;

  return {
    label,
    elapsedSec: (elapsedMs / 1000).toFixed(1),
    total,
    rps: rps.toFixed(2),
    avgMs: avgMs.toFixed(1),
    p95Ms: p95Ms.toFixed(1),
    maxMs: maxMs.toFixed(1),
    errors,
    errorRate: `${errorRate.toFixed(2)}%`,
    statuses: Object.entries(statusCounts)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([k, v]) => `${k}:${v}`)
      .join(' '),
  };
}

async function seedShortCode() {
  const seeded = await shortenRequest('seed');
  if (!seeded.ok || !seeded.code) {
    throw new Error(`Failed to seed short URL (HTTP ${seeded.status}). Is ${TARGET_URL} reachable?`);
  }
  return seeded.code;
}

async function runStage(stage, stageIndex, sharedSeedCode) {
  const latencies = [];
  const statusCounts = {};
  let errors = 0;
  let counter = 0;
  const codes = sharedSeedCode ? [sharedSeedCode] : [];

  const deadline = Date.now() + stage.durationSec * 1000;
  const start = performance.now();

  async function worker() {
    while (Date.now() < deadline) {
      const seq = ++counter;
      const t0 = performance.now();
      let statusKey = 'ERR';
      let ok = false;

      try {
        if (MODE === 'health') {
          const r = await healthRequest();
          statusKey = String(r.status);
          ok = r.ok;
        } else if (MODE === 'shorten') {
          const r = await shortenRequest(seq);
          statusKey = String(r.status);
          ok = r.ok;
        } else if (MODE === 'redirect') {
          const code = codes[seq % codes.length];
          const r = await redirectRequest(code);
          statusKey = String(r.status);
          ok = r.ok;
        } else {
          // mixed: ~25% shorten, ~75% redirect
          if (codes.length === 0 || seq % 4 === 1) {
            const r = await shortenRequest(seq);
            statusKey = String(r.status);
            ok = r.ok;
            if (r.code) {
              codes.push(r.code);
              if (codes.length > 500) codes.shift();
            }
          } else {
            const code = codes[seq % codes.length];
            const r = await redirectRequest(code);
            statusKey = String(r.status);
            ok = r.ok;
          }
        }
      } catch {
        statusKey = 'ERR';
        ok = false;
      }

      const dt = performance.now() - t0;
      latencies.push(dt);
      statusCounts[statusKey] = (statusCounts[statusKey] || 0) + 1;
      if (!ok) errors += 1;
    }
  }

  await Promise.all(Array.from({ length: stage.concurrency }, () => worker()));
  const elapsedMs = performance.now() - start;

  return {
    summary: summarize(`Stage ${stageIndex + 1} (c=${stage.concurrency})`, elapsedMs, latencies, statusCounts, errors),
    latencies,
    statusCounts,
    errors,
    elapsedMs,
  };
}

async function main() {
  console.log(`Target: ${TARGET_URL} | Mode: ${MODE} | Stages: ${STAGES_RAW}`);

  let sharedSeedCode = null;
  if (MODE === 'redirect') {
    sharedSeedCode = await seedShortCode();
    console.log(`Seeded short code: ${sharedSeedCode}`);
  }

  const stageResults = [];
  const allLatencies = [];
  const allStatusCounts = {};
  let totalErrors = 0;
  let totalElapsedMs = 0;

  for (let i = 0; i < stages.length; i += 1) {
    const stage = stages[i];
    console.log(`\nRunning Stage ${i + 1}/${stages.length}: ${stage.concurrency} concurrent workers for ${stage.durationSec}s...`);
    const res = await runStage(stage, i, sharedSeedCode);
    stageResults.push(res.summary);
    allLatencies.push(...res.latencies);
    totalErrors += res.errors;
    totalElapsedMs += res.elapsedMs;
    for (const [k, v] of Object.entries(res.statusCounts)) {
      allStatusCounts[k] = (allStatusCounts[k] || 0) + v;
    }
    console.log(`  -> RPS: ${res.summary.rps} | Avg: ${res.summary.avgMs} ms | Errors: ${res.summary.errorRate} | Statuses: ${res.summary.statuses}`);
  }

  const overall = summarize('OVERALL', totalElapsedMs, allLatencies, allStatusCounts, totalErrors);
  console.log('\n=== Load Test Summary ===');
  console.table([...stageResults, overall]);

  if ((allStatusCounts['429'] || 0) > 0) {
    console.warn(
      `\nWarning: Received ${allStatusCounts['429']} HTTP 429 responses from express-rate-limit (100 req/min per IP in src/middleware/rateLimiter.js).`,
    );
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
