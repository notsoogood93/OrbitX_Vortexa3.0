# GovFix System Architecture & Technical Specifications (ARCHITECTURE.md)

**Domain 7:** Government Systems & GovTech  
**Problem Statement:** G-02 — GovFix: Configurable Public-Institution Workflow Engine  
**Track:** University Service Requests  
**Target Institution:** Dr. D. Y. Patil Institute of Technology, Pimpri, Pune  

---

## 1. System Architectural Topology

```
┌────────────────────────────────────────────────────────────────────────┐
│              Public Obsidian Dashboard (Unified Client View)           │
│  [Student/Faculty]   [Supervisor Desk]   [Administration]   [Audit Lab]│
└────────────────────────────────────┬───────────────────────────────────┘
                                     │ HTTP REST (Dual-Mounted Table 5)
┌────────────────────────────────────▼───────────────────────────────────┐
│               GovFix Microservice Hub (`server.js:4000`)               │
├─────────────────────┬──────────────────────┬───────────────────────────┤
│ Deterministic FSM   │ Dynamic SLA & Time   │ Cryptographic Audit       │
│ Engine (`fsm.js`)   │ Engine (`sla.js`)    │ Ledger (`auditLedger.js`) │
│                     │                      │                           │
│ • 10 formal states  │ • Virtual sim clock  │ • SHA-256 block hashing   │
│ • HTTP 409 guard    │ • Auto Tier-1 (HOD)  │ • Immutable hash pointer  │
│ • HTTP 403 guard    │ • Auto Tier-2 (Reg.) │ • Refusal event logging   │
│ • HTTP 422 guard    │ • Duplicate lock     │ • Tamper detection        │
├─────────────────────┼──────────────────────┼───────────────────────────┤
│ Workflow Policy     │ Evidence Integrity   │ Recurring-Failure         │
│ Sandbox (`sla.js`)  │ Lab (`evidenceLab`)  │ Radar (`recurrenceRadar`) │
│                     │                      │                           │
│ • Isolated dry-run  │ • Byte digest check  │ • Explainable clustering  │
│ • Zero live mutate  │ • Tamper fixture     │ • Multi-signal heuristics │
│ • Role activation   │ • Digest comparison  │ • Supervisor confirmation │
└─────────▲───────────┴──────────▲───────────┴─────────────▲─────────────┘
          │                      │                         │
          └──────────────────────┼─────────────────────────┘
                                 │ Read-Only Advisory Sidecar
          ┌──────────────────────┴─────────────────────────┐
          │  AI Containment Advisory Layer (`aiCopilot.js`)│
          │  • FreeLLMAPI Router (`localhost:3001/v1`)     │
          │  • 100% Offline Heuristic Fallback Engine      │
          │  (STRICTLY PROHIBITED FROM MUTATING STATES)     │
          └────────────────────────────────────────────────┘
```

---

## 2. Subsystem Specifications

### 2.1 Deterministic Finite State Machine (FSM) (`src/engine/fsm.js`)
- **Mathematical Form:** A deterministic state transition system $M = (S, \Sigma, \delta, s_0, F)$ where:
  - $S$ = {`DRAFT`, `SUBMITTED`, `TRIAGED`, `ASSIGNED`, `ACCEPTED`, `IN_PROGRESS`, `READY_FOR_CLOSURE`, `RESOLVED`, `CLOSED`, `REOPENED`, `ESCALATED_L1`, `ESCALATED_L2`}.
  - $\Sigma$ = Authorized actor actions with role credentials.
  - $\delta: S \times \Sigma \rightarrow S \cup \{\text{REFUSAL}\}$.
- **Refusal Codes:**
  - `ERR_ILLEGAL_STATE_JUMP` (HTTP 409): Prohibits skipping lifecycle stages.
  - `ERR_ROLE_UNAUTHORIZED` (HTTP 403): Prohibits actors without requisite roles.
  - `ERR_MISSING_EVIDENCE` (HTTP 422): Prohibits moving to `READY_FOR_CLOSURE` without work notes ($\ge 5$ chars) and evidence.
  - `ERR_REOPEN_JUSTIFICATION` (HTTP 422): Prohibits reopening without reason.

### 2.2 Dynamic SLA & Escalation Engine (`src/engine/sla.js`)
- **Virtual Simulation Clock:** Uses `virtualTimeOffsetMs` added to `Date.now()`. Allows testing hours of elapsed time in seconds without modifying host OS system clocks.
- **Two-Tier Escalation Thresholds:**
  - Emergency / Hazard: 6h L1 (HOD) / 12h L2 (Registrar) / 12h Total SLA.
  - High Priority: 12h L1 / 24h L2 / 24h Total SLA.
  - Standard Priority: 36h L1 / 48h L2 / 48h Total SLA.
  - Routine: 48h L1 / 72h L2 / 72h Total SLA.
- **Duplicate Escalation Suppression:** Evaluates existing ticket status and audit history to guarantee an escalation event is emitted at most once per tier.

### 2.3 SHA-256 Cryptographic Audit Ledger (`src/engine/auditLedger.js`)
- **Hash Formulation:**
  $$\text{Hash}_i = \text{SHA-256}(\text{Index}_i \parallel \text{Timestamp}_i \parallel \text{EventType}_i \parallel \text{Actor}_i \parallel \text{Role}_i \parallel \text{TicketId}_i \parallel \text{JSON}(\text{Details}_i) \parallel \text{Hash}_{i-1})$$
- **Tamper Detection:** `verifyIntegrity()` verifies both the pointer pointer $\text{Hash}_{i-1}$ and recomputed hash for every block $i \in [1, N]$.
- **Refusal Logging:** Every rejected transition attempt is recorded as an immutable refusal block (`isRefusal: true`) documenting the unauthorized actor, role, and refusal code.

### 2.4 Workflow Policy Sandbox (`src/engine/sla.js`)
- **Strict Isolation Contract:** `simulatePolicy(proposedPolicies, candidateTickets, time)` performs pure calculations on ticket snapshots. Does not mutate live request objects, deadlines, status fields, or audit history.
- **Controlled Activation:** `activatePolicy()` requires `ADMINISTRATOR` or `SUPERVISOR` role, archives previous policy version, increments revision identifier (`POL-v1.X`), and commits an immutable `POLICY_ACTIVATED` block to the audit ledger.

### 2.5 Evidence Integrity Lab (`src/engine/evidenceLab.js`)
- **Byte-Level Verification:** Re-computes SHA-256 over raw uploaded file buffers and compares against the recorded audit digest.
- **Tamper Demonstration Fixture:** Evaluates pristine evidence copy vs an isolated test copy with 1 byte modified, proving tamper detection without altering the original record.

### 2.6 Recurring-Failure Radar (`src/engine/recurrenceRadar.js`)
- **Explainable Clustering Signals:**
  - `#SAME_PHYSICAL_ROOM`: High density of failures in specific lab/room.
  - `#SAME_SERVICE_CATEGORY`: Systemic failure in specific infrastructure type.
  - `#SAME_EQUIPMENT_ASSET`: Chronic defect on a specific machine tag.
- **Human-in-the-Loop Review:** Supervisors explicitly confirm (`CONFIRMED_DEFECT`) or dismiss (`DISMISSED_FALSE_POSITIVE`), permanently recording their decision to the audit ledger.

### 2.7 AI Containment Boundary (`src/services/aiCopilot.js`)
- **Advisory Containment:** AI outputs are non-binding suggestions displayed with advisory badges. AI has zero direct write connections to the database or FSM transition functions.
- **Resilience:** If external LLM routers disconnect, the engine immediately falls back to deterministic local campus regex heuristics with zero downtime.
