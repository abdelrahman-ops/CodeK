/**
 * Production Deployment Smoke Test Script — CodeK Academy
 *
 * Runs deterministic end-to-end smoke tests against a live target API.
 * Usage:
 *   API_URL=https://api.codek.edu.eg npx tsx scripts/smoke-test.ts
 *   or defaults to http://localhost:3000
 */

const API_BASE = (process.env.API_URL || 'http://localhost:3000').replace(/\/$/, '');

interface CheckResult {
  suite: string;
  name: string;
  status: 'PASS' | 'FAIL';
  details?: string;
}

const results: CheckResult[] = [];

async function assertStep(suite: string, name: string, fn: () => Promise<void>) {
  try {
    await fn();
    results.push({ suite, name, status: 'PASS' });
    console.log(`  ✅ [PASS] ${name}`);
  } catch (err: any) {
    results.push({ suite, name, status: 'FAIL', details: err?.message || String(err) });
    console.error(`  ❌ [FAIL] ${name}: ${err?.message || err}`);
  }
}

async function runSmokeTests() {
  console.log(`\n========================================================`);
  console.log(`🚀 CodeK Academy Production Smoke Test Runner`);
  console.log(`🎯 Target API Base: ${API_BASE}`);
  console.log(`⏰ Timestamp: ${new Date().toISOString()}`);
  console.log(`========================================================\n`);

  // 1. Health & Infrastructure
  console.log(`\n[Suite 1: Infrastructure & Observability]`);
  await assertStep('Infrastructure', 'GET / returns API welcome and status', async () => {
    const res = await fetch(`${API_BASE}/`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = (await res.json()) as any;
    if (data.status !== 'online') throw new Error(`Expected status online, got ${data.status}`);
  });

  await assertStep('Infrastructure', 'GET /health returns healthy process liveness', async () => {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = (await res.json()) as any;
    if (data.status !== 'healthy') throw new Error(`Expected status healthy, got ${data.status}`);
  });

  await assertStep('Infrastructure', 'GET /ready verifies active database connectivity', async () => {
    const res = await fetch(`${API_BASE}/ready`);
    if (!res.ok) throw new Error(`Status ${res.status}`);
    const data = (await res.json()) as any;
    if (data.status !== 'ready' || data.database !== 'connected') {
      throw new Error(`Expected ready and connected, got ${JSON.stringify(data)}`);
    }
  });

  // 2. Security & Boundaries
  console.log(`\n[Suite 2: Security & Boundary Enforcement]`);
  await assertStep('Security', 'Unauthenticated request to protected route is rejected with 401', async () => {
    const res = await fetch(`${API_BASE}/api/v1/users/me`);
    if (res.status !== 401) throw new Error(`Expected 401 Unauthorized, got ${res.status}`);
  });

  await assertStep('Security', 'Malformed Paymob webhook payload without HMAC is rejected with 403', async () => {
    const res = await fetch(`${API_BASE}/api/v1/billing/webhook/paymob`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ obj: { id: 12345 } })
    });
    if (res.status !== 403) throw new Error(`Expected 403 Forbidden, got ${res.status}`);
  });

  await assertStep('Security', 'Public courses endpoint is reachable without credentials', async () => {
    const res = await fetch(`${API_BASE}/api/v1/courses/public`);
    if (!res.ok && res.status !== 404) throw new Error(`Unexpected status ${res.status}`);
  });

  // Summary
  console.log(`\n========================================================`);
  console.log(`📊 Smoke Test Summary:`);
  const passed = results.filter((r) => r.status === 'PASS').length;
  const failed = results.filter((r) => r.status === 'FAIL').length;
  console.log(`   Total Tests : ${results.length}`);
  console.log(`   Passed      : ${passed}`);
  console.log(`   Failed      : ${failed}`);
  console.log(`========================================================\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

runSmokeTests().catch((err) => {
  console.error('Fatal smoke test error:', err);
  process.exit(1);
});
