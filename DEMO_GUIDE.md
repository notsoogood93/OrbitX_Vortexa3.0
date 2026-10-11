# GovFix Live Demonstration Guide (DEMO_GUIDE.md)

**Event:** VORTEXA 3.0 Hackathon  
**Problem Statement:** G-02 — GovFix: Configurable Public-Institution Workflow Engine  
**Track:** University Service Requests (Academic IT, Electrical, Labs & Facilities)  
**Target Institution Context:** Dr. D. Y. Patil Institute of Technology, Pimpri, Pune  
**Live UI:** `http://localhost:4000`  
**AI Sidecar Service:** `http://localhost:3001/v1` (FreeLLMAPI / Local Deterministic Fallback)  

---

## 1. Startup & Environment Preparation

### Prerequisites
- Node.js 18+ (tested on Node v24.20.0)
- Operating System: Windows / Linux / macOS
- Zero paid cloud API keys required (100% locally runnable)

### Startup Commands

**Terminal 1 — Core GovFix Engine:**
```powershell
cd c:\Users\SHRIKRISHNA\pune\OrbitX_Vortexa3.0
npm start
# Runs at http://localhost:4000
```

**Terminal 2 — Optional FreeLLMAPI Sidecar (Already running in background):**
```powershell
cd c:\Users\SHRIKRISHNA\pune\freellmapi
npm run dev -w server
# Runs at http://localhost:3001/v1
```

*(Note: If the AI sidecar is offline or disconnected, GovFix automatically falls back to its embedded deterministic keyword and regex heuristics with 100% uptime).*

### Automated Verification Run
```powershell
npm test
# Executes the 20-point benchmark verification suite (100% Pass Target)
```

---

## 2. Safe Demonstration Roles & Credentials

GovFix uses role-based access control with simulated session tokens issued via `POST /auth/login`.

| Role | Username / Identifier | Permitted Demonstration Capabilities |
| :--- | :--- | :--- |
| **Requester (Student / Faculty)** | `prof.kulkarni@dypit.edu.in` | Submit service requests, view countdown timers, confirm closure, reopen within 48h. |
| **Department Supervisor (HOD)** | `hod.computer@dypit.edu.in` | Triage requests, dispatch work orders to technicians, review recurrence patterns, approve closures. |
| **Field Officer (Technician)** | `tech.it@dypit.edu.in` | Accept/reject assignments, record diagnostic repairs, attach SHA-256 evidence, propose closure. |
| **Campus Administrator (Registrar)** | `registrar@dypit.edu.in` | Campus SLA oversight, dry-run simulate workflow policies, activate new SLA policy versions, direct intervention. |

---

## 3. Click-by-Click Live Demonstration Sequence (15 Steps)

### Step 1: Student Intake with AI Advisory (`Alt+1`)
1. Open `http://localhost:4000`.
2. Under **Student & Faculty Service Portal**, click preset **"Lab 304 GPU Rig"**.
3. Notice the input fields auto-fill (`Prof. Aniket Kulkarni`, `Lab 304 - Computer Engineering`, `Workstation GPU screen artifacting and system freeze`).
4. Press `Ctrl+Enter` (or click **"Submit Service Request"**).
5. **Expected Outcome:** The request is issued public ID `DYP-2026-X` in state `SUBMITTED`. An immutable audit block is chained. The AI Copilot displays an advisory badge with non-binding recommendations.

### Step 2: Supervisor Triage & Technician Dispatch (`Alt+2`)
1. Switch to **Supervisor Desk** (`Alt+2`).
2. Select the newly submitted ticket from the active list.
3. Review the AI advisory recommendation (Urgency: `HIGH`, Category: `Academic IT & Computing Systems`).
4. Click **"Triage & Confirm Category"** $\rightarrow$ Ticket moves to `TRIAGED`.
5. Select technician `TECH_IT_SUPPORT_03` and click **"Dispatch to Technician"**.
6. **Expected Outcome:** Status moves from `TRIAGED` to `ASSIGNED`.

### Step 3: Technician Work Action & Evidence Proof
1. In the ticket details panel, simulate technician acceptance: click **"Accept Assignment"** $\rightarrow$ Status moves to `IN_PROGRESS`.
2. Click **"Log Diagnostic Action"**: record multimeter voltage test ("12.08V stable").
3. Click **"Attach Proof & Propose Closure"**.
4. In the modal, attach repair notes and click **"Generate SHA-256 Checksum"**.
5. Click **"Submit Proof & Move to Ready for Closure"**.
6. **Expected Outcome:** Request transitions to `READY_FOR_CLOSURE`. The file's SHA-256 digest is sealed into the audit ledger.

### Step 4: Proving FSM Refusal Guards (`Alt+4`)
1. Switch to **Audit & Benchmarks** (`Alt+4`).
2. Under **FSM Transition Guard Tester**:
   - Target Request: Select any `SUBMITTED` request.
   - Actor Role: `REQUESTER`.
   - Target State: `CLOSED`.
   - Click **"Execute Transition Attempt"**.
3. **Expected Outcome:** The attempt is rejected with **HTTP 409 Conflict** (`ERR_ILLEGAL_STATE_JUMP`). A red refusal banner displays the cryptographic audit hash proving the refused tampering attempt was recorded.

### Step 5: Virtual Time-Travel SLA Escalation
1. Under **Time-Travel SLA Auto-Escalation**, click **"Advance +24h"**.
2. **Expected Outcome:** The simulation clock advances by 24 hours. The background SLA daemon evaluates deadlines and auto-escalates overdue requests to `ESCALATED_L1` (Tier-1 HOD Escalation).
3. Click **"Advance +48h"** $\rightarrow$ Unresolved requests auto-escalate to `ESCALATED_L2` (Campus Registrar Escalation).
4. Click **"Reset Time"** to return the simulation clock to real-time.

### Step 6: Duplicate Escalation Suppression
1. Advance time by minor increments (`+12h`).
2. Observe the daemon log: already escalated requests do **not** trigger duplicate escalation events.

### Step 7: Supervisor Closure Sign-Off & Reopening Flow
1. Switch back to **Supervisor Desk** (`Alt+2`).
2. Select the ticket in `READY_FOR_CLOSURE`.
3. Click **"Approve & Sign-Off Closure"** $\rightarrow$ Ticket transitions to `CLOSED`.
4. Switch to **Student & Faculty** (`Alt+1`): Click **"Reopen Request"** with reason "Monitor still flickers under 3D load".
5. **Expected Outcome:** Ticket transitions to `REOPENED` with its original identifier `DYP-2026-X` and complete prior history intact.

### Step 8: Workflow Policy Sandbox (`Alt+3`)
1. Switch to **Administration** (`Alt+3`).
2. Scroll to **Workflow Policy Sandbox**.
3. View current active policy badge: `Active: POL-v1.0`.
4. Change Emergency SLA from `12h` to `8h`, and High Priority SLA from `24h` to `16h`.
5. Click **"Run Isolated Dry-Run Simulation"**.
6. **Expected Outcome:** A comparison table appears showing affected tickets and projected remaining hours. An alert confirms: *"ISOLATED DRY RUN — ZERO LIVE TICKETS MUTATED"*.
7. Click **"Activate Proposed Policy"** and confirm.
8. **Expected Outcome:** Policy updates to `POL-v1.2` and the activation event is recorded on the SHA-256 audit ledger.

### Step 9: Evidence Integrity Lab (`Alt+4`)
1. Switch to **Audit & Benchmarks** (`Alt+4`).
2. Scroll to **Evidence Integrity Lab**.
3. Click **"Verify Stored Byte Digest"** for artifact `EVID-DEMO-1001`.
4. **Expected Outcome:** Returns green status `INTEGRITY_VERIFIED` with identical recorded and computed SHA-256 hashes.
5. Click **"Run Isolated Tamper-Detection Fixture"**.
6. **Expected Outcome:** A side-by-side comparison shows:
   - Pristine original: `INTEGRITY_VERIFIED` (100% match).
   - 1-byte altered test copy: `TAMPER_DETECTED` (Cryptographic mismatch caught).
   - Confirmation: *Original record strictly unmodified*.

### Step 10: Recurring-Failure Radar (`Alt+3`)
1. Switch to **Administration** (`Alt+3`).
2. Scroll to **Recurring-Failure Radar**.
3. View detected chronic failure clusters (e.g., *Lab 304 - Computer Engineering — Academic IT & Computing Systems*).
4. Review matching signals: `#SAME_PHYSICAL_ROOM`, `#SAME_SERVICE_CATEGORY`, `#ELEVATED_FAILURE_FREQUENCY`.
5. Click **"Confirm Chronic Defect"**.
6. **Expected Outcome:** Status updates to `CONFIRMED_DEFECT` and an audit block `RECURRENCE_PATTERN_REVIEWED` is sealed onto the ledger.

### Step 11: Cryptographic Hash Verification (`Alt+4`)
1. In **Audit & Benchmarks**, click **"Verify Hash Integrity"**.
2. **Expected Outcome:** Traverses the entire chain block by block. Displays green verification banner: *"100% Mathematically Valid (N chained blocks)"*.

### Step 12: Automated 20-Point Benchmark Suite (`Alt+4`)
1. In **Audit & Benchmarks**, click **"Run 20-Point Benchmark Suite"**.
2. **Expected Outcome:** Executes all 20 end-to-end tests live in the browser console feed, culminating in:  
   `🎉 20/20 BENCHMARK TESTS PASSED (100% COMPLIANCE)!`

---

## 4. Reset & Cleanup Instructions
GovFix stores runtime demonstration state in memory. To completely reset all tickets, timers, and audit blocks back to initial seed data without destroying project code:
```powershell
# Stop and restart the server
node server.js
```
The server will initialize fresh with seed records, genesis audit block, and base policy `POL-v1.0`.
