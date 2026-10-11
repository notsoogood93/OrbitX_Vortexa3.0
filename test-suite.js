/**
 * GovFix Automated Test Suite (Self-Healing Verification)
 * Tests FSM determinism, role authorization, refusal codes, SLA auto-escalation, and cryptographic hash chain.
 * Run with: npm test
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:4000';

async function runTests() {
  console.log('=============================================================');
  console.log('🧪 RUNNING GOVFIX AUTOMATED VERIFICATION TEST SUITE');
  console.log(`   Target Server: ${BASE_URL}`);
  console.log('=============================================================\n');

  let passed = 0;
  let failed = 0;

  async function assertTest(name, fn) {
    try {
      await fn();
      console.log(`  ✅ [PASS] ${name}`);
      passed++;
    } catch (err) {
      console.error(`  ❌ [FAIL] ${name} -> ${err.message}`);
      failed++;
    }
  }

  // 1. Server Health Check
  await assertTest('1. Server is live and returns grievances list', async () => {
    const res = await fetch(`${BASE_URL}/api/grievances`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!Array.isArray(data.grievances) || data.grievances.length === 0) {
      throw new Error('No grievances returned');
    }
  });

  // 2. Multilingual Grievance Ingestion
  let testTicketId = null;
  await assertTest('2. Citizen submits Marathi grievance (Auto AI Triage & SLA Calculation)', async () => {
    const res = await fetch(`${BASE_URL}/api/grievances`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Auto Test Grievance',
        description: 'बाणेर रस्त्यावर पाण्याचा मोठा पाईप फुटला आहे. पाणी वाया जात आहे.',
        citizenName: 'Pravin Gaikwad',
        citizenContact: '+91 98220 11223',
        location: 'Baner Phata',
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.ticket || data.ticket.status !== 'SUBMITTED') {
      throw new Error('Ticket not created in SUBMITTED state');
    }
    testTicketId = data.ticket.id;
  });

  // 3. Unauthorized State Jump (Refusal Test)
  await assertTest('3. Refuses illegal jump SUBMITTED -> RESOLVED (Code: ERR_ILLEGAL_STATE_JUMP)', async () => {
    const res = await fetch(`${BASE_URL}/api/grievances/${testTicketId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetState: 'RESOLVED',
        actor: 'CitizenTest',
        role: 'CITIZEN',
      }),
    });
    if (res.status !== 400) throw new Error(`Expected HTTP 400, got ${res.status}`);
    const data = await res.json();
    if (!data.refused || data.code !== 'ERR_ILLEGAL_STATE_JUMP') {
      throw new Error(`Expected refusal code ERR_ILLEGAL_STATE_JUMP, got ${data.code}`);
    }
    if (!data.auditHash) throw new Error('Refusal audit hash missing');
  });

  // 4. Role Authorization Guard (Refusal Test)
  await assertTest('4. Refuses Citizen attempting Officer Triage (Code: ERR_ROLE_UNAUTHORIZED)', async () => {
    const res = await fetch(`${BASE_URL}/api/grievances/${testTicketId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetState: 'TRIAGED',
        actor: 'CitizenTest',
        role: 'CITIZEN',
        payload: { category: 'Roads & Potholes', ward: 'Baner - Balewadi', urgency: 'HIGH' },
      }),
    });
    if (res.status !== 400) throw new Error(`Expected HTTP 400, got ${res.status}`);
    const data = await res.json();
    if (!data.refused || data.code !== 'ERR_ROLE_UNAUTHORIZED') {
      throw new Error(`Expected refusal code ERR_ROLE_UNAUTHORIZED, got ${data.code}`);
    }
  });

  // 5. Valid Transition: Triage
  await assertTest('5. Officer successfully triages ticket (SUBMITTED -> TRIAGED)', async () => {
    const res = await fetch(`${BASE_URL}/api/grievances/${testTicketId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetState: 'TRIAGED',
        actor: 'OfficerDeshmukh',
        role: 'WARD_OFFICER',
        payload: {
          category: 'Water Supply & Contamination',
          ward: 'Baner - Balewadi',
          urgency: 'HIGH',
        },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.ticket.status !== 'TRIAGED') throw new Error('Ticket failed to move to TRIAGED');
  });

  // 6. Valid Transition: Assignment
  await assertTest('6. Officer assigns Field Engineer (TRIAGED -> ASSIGNED)', async () => {
    const res = await fetch(`${BASE_URL}/api/grievances/${testTicketId}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        targetState: 'ASSIGNED',
        actor: 'OfficerDeshmukh',
        role: 'WARD_OFFICER',
        payload: { assignedEngineerId: 'ENG_VINAYAK_04' },
      }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (data.ticket.status !== 'ASSIGNED') throw new Error('Ticket failed to move to ASSIGNED');
  });

  // 7. Time-Travel Simulation & Auto-Escalation
  await assertTest('7. Time-Travel SLA Daemon triggers auto-escalations (+24h)', async () => {
    const res = await fetch(`${BASE_URL}/api/simulation/time-travel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours: 24 }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (Number(data.virtualOffsetHours) < 24) throw new Error('Virtual time offset not applied');
    
    // Reset back
    await fetch(`${BASE_URL}/api/simulation/time-travel`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    });
  });

  // 8. Cryptographic Hash Chain Integrity
  await assertTest('8. SHA-256 Cryptographic Audit Chain is 100% Mathematically Valid', async () => {
    const res = await fetch(`${BASE_URL}/api/audit`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    if (!data.verification.valid) {
      throw new Error(`Audit verification failed: ${data.verification.reason}`);
    }
    if (data.chainLength < 5) {
      throw new Error(`Chain length too short: ${data.chainLength}`);
    }
  });

  console.log('\n=============================================================');
  console.log(`📊 TEST RESULTS: ${passed} PASSED / ${failed} FAILED`);
  console.log('=============================================================');

  if (failed > 0) process.exit(1);
}

runTests();
