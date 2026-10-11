# 🏛️ GovFix: Configurable Public-Institution Workflow Engine
## Problem Understanding, Solution Proposal & System Architecture Report
**Event**: VORTEXA 3.0 Hackathon | Dr. D. Y. Patil Institute of Technology, Pimpri, Pune  
**Domain**: Domain 7 — Government Systems & GovTech  
**Problem Statement**: G-02 — Configurable Public-Institution Workflow Engine  
**Selected Track**: Municipal Grievance Resolution (PCMC / PMC Pune) & University Campus Requests  
**Team**: OrbitX  
**Date**: October 11, 2026  

---

## 1. Problem Understanding

### 1.1 The Institutional Service Crisis
Public institutions—from municipal corporations like PCMC (Pimpri Chinchwad Municipal Corporation) and PMC (Pune Municipal Corporation) to large university campuses—process tens of thousands of service requests and citizen grievances every month. These range from emergency civic hazards (sewer line ruptures, open electrical wires, road cave-ins) to routine maintenance (pothole repairs, streetlight outages, IT lab outages).

Despite having public grievance portals (e.g., PCMC Sarathi, PMC Care, Samarth eGov), these institutions suffer from four systemic points of failure:

1. **The "Limbo" Problem**: Requests enter an unmonitored "In Progress" state and sit indefinitely without active work, as there is no backend state machine compelling progression.
2. **Ghost Resolutions**: Contractors and field staff mark tickets as "Resolved" without verifiable photo evidence, physical inspection sign-offs, or citizen verification.
3. **Silent SLA Breaches**: Service Level Agreement (SLA) deadlines pass unnoticed because standard databases lack proactive escalation daemons that notify supervising commissioners or department heads.
4. **The Flaky LLM Trap**: Recent attempts to modernize civic portals rely on unconstrained AI chatbots. If an LLM is given direct database mutation authority, it hallucinates status jumps, approves unauthorized closures, or silently drops requests.
5. **Lack of Verifiable Audit Trails**: Standard relational database rows (e.g., SQLite or MySQL) can be updated or deleted without leaving mathematical proof of tampering. When an officer ignores a critical water contamination complaint for two weeks, traditional logs fail to prove whether deadlines were bypassed or who authorized changes.

---

## 2. Proposed Solution: GovFix

**GovFix** is a lightweight, locally runnable, backend-enforced workflow engine designed to restore statutory accountability to public institutions. GovFix enforces one central principle:  
> **"Deterministic Rules Govern Authority, Deadlines, and State; AI Informs But Never Silently Overrides."**

### 2.1 Core Innovations
- **Deterministic 11-State Finite State Machine (FSM)**: Every transition is mathematically restricted. Invalid state skips (e.g., jumping from `SUBMITTED` directly to `RESOLVED`) are strictly refused with machine-readable error codes (`ERR_ILLEGAL_STATE_JUMP`) and `HTTP 409 Conflict`.
- **Backend-Enforced Role-Based Access Control (RBAC)**: Status mutations are gated by cryptographic role verifications (`CITIZEN`, `WARD_OFFICER`, `FIELD_ENGINEER`, `SUPERVISING_COMMISSIONER`, `SYSTEM_DAEMON`). Unauthorized moves return `HTTP 403 Forbidden` (`ERR_ROLE_UNAUTHORIZED`).
- **Dynamic SLA & Multi-Tier Escalation Engine**: Every grievance receives an SLA timeline based on urgency (12h for Hazards, 24h for High, 48h for Standard, 72h for Routine). An automated background daemon continuously evaluates deadlines and escalates overdue tickets to Tier-1 (Ward Officer) and Tier-2 (Municipal Commissioner) without human intervention.
- **Virtual Time-Travel Simulation Harness**: Designed specifically for hackathon evaluation, GovFix includes simulated time-acceleration controls (+12h, +24h, +48h) allowing judges to witness real-time automated escalations without waiting days.
- **Tamper-Evident SHA-256 Cryptographic Audit Ledger**: Every accepted transition, refused unauthorized attempt, and escalation event is hashed and chained into a forward-linked merkle-like ledger. An inspector can verify total database integrity with one click.
- **Configurable Domain Profiles**: The engine is fully modular, featuring 1-click preset switching between **Municipal Grievances (PCMC/PMC Pune)** and **University Campus Requests (DY Patil Campus)**.

---

## 3. Intended Users & Role Boundaries

GovFix establishes strict, unbreachable role boundaries across 5 user categories:

| User Role | Permitted Actions | Prohibited Actions (Strictly Refused) |
| :--- | :--- | :--- |
| **Citizen / Requester** | • Register grievance (Marathi/Hindi/English)<br>• Track live status & SLA countdown<br>• Confirm resolution with satisfaction score<br>• Reopen grievance within 48h if unsatisfied | • Cannot triage or assign officers<br>• Cannot unilaterally mark a ticket as Resolved<br>• Cannot alter SLA deadlines |
| **Ward Officer / Supervisor** | • Review AI triage recommendations<br>• Override category, ward, or priority<br>• Reject invalid/spam requests with logged justification<br>• Dispatch work orders to Field Engineers<br>• Conduct physical inspection sign-offs | • Cannot skip field engineering stages<br>• Cannot resolve complaints without inspection<br>• Cannot delete historical audit records |
| **Field Engineer / Staff** | • Acknowledge assigned work orders<br>• Transition ticket to `IN_PROGRESS`<br>• Upload photographic evidence & completion notes<br>• Request `INSPECTION_PENDING` | • Cannot approve own work as final `RESOLVED`<br>• Cannot reassign tickets to other staff<br>• Cannot alter SLA timers |
| **Supervising Commissioner** | • City-wide SLA compliance oversight<br>• Review active Tier-1 and Tier-2 escalations<br>• Issue direct administrative orders on overdue cases<br>• Re-prioritize emergency ward resources | • Cannot make invalid state transitions<br>• Cannot erase audit history |
| **System SLA Daemon** | • Background time evaluation<br>• Automated transition to `ESCALATED_L1` & `ESCALATED_L2`<br>• Emits real-time SSE alerts to dashboard | • Cannot arbitrarily resolve or close tickets |

---

## 4. Constrained AI Integration (FreeLLMAPI & Heuristic Engine)

GovFix strictly adheres to hackathon safety and statutory compliance guidelines. **AI is an advisory sidecar, never a state-mutating controller.**

```
Citizen Raw Input (Marathi/Hindi/English)
              │
              ▼
    [AICopilotService]
      ├── 1. FreeLLMAPI Router (app.1min.ai / Groq / Gemini endpoints)
      └── 2. Local Deterministic Heuristic Extractor (100% Offline Fallback)
              │
              ▼
Proposed Advisory Payload:
{
  category: "Pothole / Road Repair",
  urgency: "HIGH",
  ward: "Ward 12 - Baner/Balewadi",
  marathi_draft: "तक्रार नोंदवली गेली आहे. प्रभाग १२ अभियंत्याकडे काम सोपवले आहे."
}
              │
              ▼
Displayed to Ward Officer Desk with [Draft - Requires Confirmation] Badge
(State remains SUBMITTED until Human Officer clicks "Accept & Dispatch")
```

### AI Capabilities
1. **Multilingual Grievance Extraction**: Ingests colloquial Marathi (*"रावेत चौक रस्त्यावर मोठा खड्डा पडला आहे, अपघात होऊ शकतो"*), Hindi, or English and extracts structured metadata `{ category, urgency, ward, extracted_entities }`.
2. **Duplicate & Cluster Detection**: Flags complaints from the same geo-location or ward within 24 hours to prevent redundant work orders.
3. **Official Response Drafter**: Generates formal municipal acknowledgment notes in Marathi and English for officer review.
4. **100% Offline Deterministic Fallback**: If external internet or LLM APIs are offline, GovFix automatically falls back to an embedded keyword, regex, and locality rule engine, ensuring core municipal operations never halt.

---

## 5. Differentiation From Existing Solutions

| Feature / Metric | Samarth eGov (University ERP) | ManageEngine ServiceDesk | Cloud ITSM (Freshservice) | Typical Hackathon AI Project | **GovFix (OrbitX)** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **State Machine Enforcement** | Generic Form Workflow | Hardcoded Statuses | Configurable Workflow | Unconstrained LLM (Flaky) | **Deterministic 11-State FSM** |
| **Explicit Refusal Codes** | ❌ None | ❌ Generic Error | ❌ Generic Error | ❌ Silent failure | **✅ Exact HTTP 409 & 403 Codes** |
| **Audit Ledger Integrity** | Mutable SQL Rows | Application Logs | Cloud Logs | ❌ None | **✅ Cryptographic SHA-256 Ledger** |
| **Refused Attempt Logging** | ❌ Not Logged | ❌ Not Logged | ❌ Not Logged | ❌ Not Logged | **✅ Logged with Actor, Role & Reason** |
| **Multi-Tier Auto-Escalation** | Basic Email Alert | Email Notification | Rule Trigger | ❌ None | **✅ Tier-1 & Tier-2 Daemon Escalation** |
| **Time-Travel Simulation** | ❌ None | ❌ None | ❌ None | ❌ None | **✅ Virtual Clock (+12h, +24h, +48h)** |
| **Multilingual AI Sidecar** | ❌ None | ❌ English Only | ❌ English Only | Cloud Paid API Only | **✅ FreeLLMAPI + Offline Heuristics** |
| **Cost & Dependencies** | Expensive Enterprise | Proprietary License | High Cloud Subscription | Paid OpenAI/Anthropic APIs | **Zero Paid APIs · 100% Local MVP** |

---

## 6. System Architecture & Workflow

### 6.1 Architectural Topology
GovFix uses a high-performance, modular three-tier architecture:
- **Client Tier**: 4-in-1 glassmorphic dashboard (Citizen Portal, Ward Officer Desk, Commissioner War Room, Judge Chaos Simulator).
- **Service & Governance Tier**: Node.js/Express REST API enforcing the FSM State Guard, Dynamic SLA Policy Engine, and FreeLLMAPI Router.
- **Persistence & Cryptographic Tier**: In-memory relational state synchronized with a forward-linked SHA-256 Merkle-style audit block ledger.

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT APPLICATION                                    |
|   +-------------------+  +--------------------+  +------------------+  +--------------+ |
|   | 1. Citizen Portal |  | 2. Ward Officer    |  | 3. Commissioner  |  | 4. Judge     | |
|   |    (File/Track)   |  |    (Triage/Action) |  |    War Room      |  |    Simulator | |
|   +---------+---------+  +---------+----------+  +--------+---------+  +-------+------+ |
+-------------|----------------------|----------------------|--------------------|--------+
              |                      |                      |                    |         
              +----------------------+----------+-----------+--------------------+         
                                                | HTTP / REST                              
                                                v                                          
+-----------------------------------------------------------------------------------------+
|                                 GOVFIX SERVICE LAYER                                    |
|                                                                                         |
|   +---------------------------------------------------------------------------------+   |
|   |                           API Gateway & RBAC Validator                          |   |
|   |     Validates caller role against state permissions (CITIZEN, OFFICER, etc.)    |   |
|   +---------------------------------------+-----------------------------------------+   |
|                                           |                                             |
|                     +---------------------+---------------------+                       |
|                     |                                           |                       |
|                     v                                           v                       |
|     +-------------------------------+           +-------------------------------+       |
|     |     Deterministic FSM Guard   |           |    Dynamic SLA & Time Engine  |       |
|     |  11 States · Strict Jumps     |           |  Deadlines · Auto-Escalation  |       |
|     |  Refusals -> HTTP 409 / 403   |           |  Virtual Time-Travel (+24h)   |       |
|     +---------------+---------------+           +---------------+---------------+       |
|                     |                                           |                       |
|                     +---------------------+---------------------+                       |
|                                           |                                             |
|                                           v                                             |
|   +---------------------------------------------------------------------------------+   |
|   |                   Tamper-Evident SHA-256 Cryptographic Ledger                   |   |
|   |      Chained Blocks · Accepted Transitions · Refusal Audit · Chain Verifier     |   |
|   +---------------------------------------------------------------------------------+   |
+-------------------------------------------|---------------------------------------------+
                                            | Async Non-Blocking                           
                                            v                                              
+-----------------------------------------------------------------------------------------+
|                               AI COPILOT SIDECAR (ADVISORY)                             |
|   +---------------------------------------------------------------------------------+   |
|   |  FreeLLMAPI Router (app.1min.ai / Groq / Gemini) <---> Deterministic Heuristics |   |
|   |  • Multilingual Marathi/Hindi Extraction   • Proximity Duplicate Detection      |   |
|   +---------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------+
```

---

## 7. Verification & Synthetic Testing Plan

GovFix includes an automated 8-point end-to-end integration test harness (`npm test`) that programmatically verifies the entire lifecycle:

```
🧪 RUNNING GOVFIX AUTOMATED VERIFICATION TEST SUITE
   Target Server: http://localhost:4000
=============================================================
  ✅ [PASS] 1. Server is live and returns grievances list
  ✅ [PASS] 2. Citizen submits Marathi grievance (Auto AI Triage & SLA Calculation)
  ✅ [PASS] 3. Refuses illegal jump SUBMITTED -> RESOLVED (Code: ERR_ILLEGAL_STATE_JUMP) [HTTP 409]
  ✅ [PASS] 4. Refuses Citizen attempting Officer Triage (Code: ERR_ROLE_UNAUTHORIZED) [HTTP 403]
  ✅ [PASS] 5. Officer successfully triages ticket (SUBMITTED -> TRIAGED)
  ✅ [PASS] 6. Officer assigns Field Engineer (TRIAGED -> ASSIGNED)
  ✅ [PASS] 7. Time-Travel SLA Daemon triggers auto-escalations (+24h)
  ✅ [PASS] 8. SHA-256 Cryptographic Audit Chain is 100% Mathematically Valid
=============================================================
📊 TEST RESULTS: 8 PASSED / 0 FAILED (100% Pass Rate)
```

---

## 8. Conclusion

GovFix bridges the critical gap between academic workflow theory and real-world municipal governance. By combining a **deterministic state machine**, **cryptographic SHA-256 audit chaining**, **dynamic SLA auto-escalation**, and **safely constrained multilingual AI intelligence**, Team OrbitX has delivered a working, tested, zero-cost MVP that solves the core institutional failures of municipal administration.
