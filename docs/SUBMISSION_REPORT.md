# 🏛️ GovFix: Configurable Public-Institution Workflow Engine
## Problem Understanding, Solution Proposal & System Architecture Report
**Event**: VORTEXA 3.0 Hackathon | Dr. D. Y. Patil Institute of Technology, Pimpri, Pune  
**Domain**: Domain 7 — Government Systems & GovTech  
**Selected Track**: University Service Requests (Maintenance, IT Support & Campus Facilities)  
**Team**: OrbitX  
**Date**: October 11, 2026  

---

## 1. Problem Understanding

### 1.1 The Campus Operational Bottleneck
Higher education campuses—such as Dr. D. Y. Patil Institute of Technology—function as dense mini-cities housing thousands of students, researchers, faculty, and administrative staff. Every academic term generates thousands of routine and urgent service requests across:
- **Campus Facilities & Maintenance**: Classroom projector failures, electrical line outages in laboratories, plumbing failures in student hostels.
- **Academic IT & Computing Support**: Server downtime, department Wi-Fi access point failure, damaged high-performance lab workstations.
- **Administrative Services**: Classroom scheduling conflicts, asset movement, and equipment maintenance clearances.

### 1.2 Systemic Failure Modes of Existing University Systems
While universities often deploy campus portals (e.g., Samarth eGov, basic Google Forms, or email help desks), request lifecycles routinely collapse due to five critical failure modes:

1. **The "Limbo" Problem**: Service requests enter "In Progress" or "Under Review" and sit indefinitely. Without backend progression forcing, technicians face no consequences for letting requests languish.
2. **Premature & Ghost Closures**: Maintenance personnel frequently mark tickets as "Closed" without physical proof (e.g., photo evidence of repaired wiring), without supervisor inspection, and without student/requester confirmation.
3. **Silent Deadline Breaches**: Service Level Agreements (SLAs) pass unnoticed. Standard campus databases lack proactive background daemons to detect overdue tasks and escalate them to Estate Officers or Department Deans.
4. **The Flaky LLM Trap**: Unconstrained AI chatbots deployed on top of help desks hallucinate statuses, approve unauthorized campus closures, or drop records when given database write authority.
5. **Lack of Verifiable Audit Accountability**: Standard database rows (SQLite/MySQL) in university ERPs are mutable. If a safety hazard report (e.g., exposed high-voltage wiring in an electrical engineering lab) is ignored or backdated, traditional logs cannot mathematically prove who altered statuses or bypassed deadlines.

---

## 2. Proposed Solution: GovFix (University Track)

**GovFix** is a lightweight, backend-enforced, finite-state workflow engine purpose-built for university campus maintenance and IT service operations. GovFix is governed by one strict statutory principle:  
> **"Deterministic Rules Govern Authority, State Transitions & Deadlines; AI Informs But Never Overrides."**

### 2.1 Core Architectural Innovations
- **Deterministic Finite State Machine (FSM)**: Formally defines the exact lifecycle:  
  `Draft → Submitted → Triaged → Assigned → Accepted → In Progress → Ready for Closure / Escalated → Closed or Reopened`.  
  Illegal jumps (e.g., skipping from `Submitted` directly to `Closed`) are strictly rejected by the backend with **HTTP 409 Conflict** and machine-readable refusal codes (`ERR_ILLEGAL_STATE_JUMP`).
- **Backend-Enforced Role-Based Access Control (RBAC)**: Enforces strict separation of duties across Requesters, Department Supervisors, and Field Technicians. Unauthorized attempts return **HTTP 403 Forbidden** (`ERR_ROLE_UNAUTHORIZED`) and are recorded in the audit trail.
- **Campus SLA & Multi-Tier Escalation Daemon**: Every request receives a track-appropriate deadline based on category, room, and priority (e.g., Lab Hazard: 12h, Critical IT Server: 24h, Routine Hostel Maintenance: 48h). An automated background daemon detects overdue requests and triggers formal escalation events to Estate Managers and the Campus Registrar without human intervention.
- **Duplicate Escalation Prevention**: The daemon ensures that recurring overdue checks do not spam redundant escalation events for the same request and rule.
- **Tamper-Evident SHA-256 Cryptographic Audit Ledger**: Overcoming the known vulnerability of standard SQLite databases, GovFix forward-chains every accepted change, refused unauthorized attempt, and escalation event with cryptographic SHA-256 hashes, enabling 1-click mathematical verification of historical integrity.
- **Requester-Verified Closure Discipline**: A ticket cannot reach final closure without technician evidence submission and requester satisfaction confirmation (or 48h automatic sign-off with dispute rights).

---

## 3. Intended Users & Role Boundaries

| User Role | Permitted Actions | Prohibited Actions (Strictly Refused) |
| :--- | :--- | :--- |
| **Requester (Student / Faculty / Staff)** | • Submit service request with room/asset tag<br>• View own request status & SLA timer<br>• Confirm resolution or request reopening | • Cannot assign technicians or officers<br>• Cannot force-close tickets<br>• Cannot alter SLA deadlines |
| **Supervisor (Estate Officer / HOD / Lab In-Charge)** | • Triage requests (validate category, priority, room)<br>• Assign/reassign to qualified field technician<br>• Approve or reject closure proposals<br>• View campus oversight dashboards & audit logs | • Cannot create illegal state transitions<br>• Cannot bypass state machine guards<br>• Cannot erase historical audit records |
| **Officer (Maintenance Tech / IT Engineer)** | • View assigned tickets; accept or reject assignment<br>• Transition ticket to `In Progress`<br>• Log work notes & upload photo/repair evidence<br>• Propose closure (`Ready for Closure`) | • Cannot approve own work as final closed<br>• Cannot force-close without evidence<br>• Cannot unilaterally alter deadlines |
| **Campus Administrator (Registrar / Director)** | • Campus-wide SLA compliance oversight<br>• Review Tier-1 and Tier-2 escalation rosters<br>• Direct administrative intervention on overdue cases | • Cannot bypass deterministic state flow<br>• Cannot modify cryptographic ledger blocks |
| **System SLA Daemon** | • Background deadline evaluation<br>• Creates escalation events upon SLA breach<br>• Enforces duplicate-escalation suppression | • Cannot close or resolve tickets |

---

## 4. Constrained AI Integration (FreeLLMAPI & Offline Heuristics)

In strict adherence to hackathon safety criteria (*"AI may suggest a category, extract key details, or draft a response, but cannot change a request's status, assignment, or deadline"*):

```
Student / Faculty Request (Text / Voice / Image)
                     │
                     ▼
           [AICopilotService]
      ├── FreeLLMAPI Router (1min.ai / Groq / Gemini endpoints)
      └── Deterministic Rule & Asset Heuristic Engine (100% Offline Fallback)
                     │
                     ▼
        Non-Binding Advisory Payload:
        {
          category: "Lab IT Infrastructure",
          subtype: "Workstation GPU Hardware Failure",
          room_id: "Lab 304 - Computer Engineering",
          priority: "HIGH",
          suggested_officer: "IT_ENG_SHARMA",
          draft_acknowledgment: "Request logged for Lab 304 GPU repair."
        }
                     │
                     ▼
        Presented on Supervisor Triage Desk
        Badge: [AI Advisory - Requires Human Confirmation]
        (Backend state remains SUBMITTED until Supervisor clicks "Assign")
```

### Key AI Guardrails
1. **Zero Database Mutation Rights**: The AI sidecar has no direct database write connection. It cannot alter statuses, reassign staff, or extend deadlines.
2. **Room & Asset Intelligence**: Automatically parses room identifiers (e.g., *"DYP-MECH-W201"*) and asset tags from request text.
3. **100% Offline Resilience**: If external LLM APIs are severed, GovFix falls back seamlessly to internal regex, room-asset mappings, and keyword matching.

---

## 5. Differentiation From Existing Solutions

| Capability / Criterion | Samarth eGov (Higher-Ed ERP) | ManageEngine ServiceDesk | Freshservice (Cloud ITSM) | Typical Hackathon AI Project | **GovFix (Team OrbitX)** |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Workflow Core** | Form ticketing module | Hardcoded status lists | Proprietary cloud rules | Flaky LLM Chatbot | **Deterministic FSM Engine** |
| **Refusal Handling** | Generic form error | Generic UI error | Generic UI error | Silent failure / Hallucination | **Explicit HTTP 409 & 403 Codes** |
| **Audit Ledger Integrity** | Mutable SQL rows | Application logs | Vendor cloud logs | None | **Tamper-Evident SHA-256 Ledger** |
| **Refused Actions Logged** | ❌ Not Logged | ❌ Not Logged | ❌ Not Logged | ❌ Not Logged | **✅ Logged with Actor, Role & Code** |
| **Multi-Tier Auto-Escalation** | Basic email notification | Email alert rule | Workflow trigger | ❌ None | **✅ Daemon-Driven Tier 1/2 Escalations** |
| **Duplicate Escalation Suppression** | ❌ None | ❌ None | Basic throttle | ❌ None | **✅ State-checked duplicate suppression** |
| **Evaluator Time-Travel** | ❌ None | ❌ None | ❌ None | ❌ None | **✅ Virtual Clock (+12h, +24h, +48h)** |
| **Cost & Dependencies** | Expensive institutional ERP | High enterprise license | Expensive recurring SaaS | Paid OpenAI/Claude APIs | **Zero Paid APIs · 100% Local Run MVP** |

---

## 6. System Architecture & Workflow Diagram

GovFix uses a robust, modular three-tier architecture:
- **Client Tier**: 4-in-1 responsive dashboard (Requester Portal, Supervisor Triage Desk, Campus War Room, Judge Chaos Simulator).
- **Service Layer**: Node.js/Express REST API enforcing the State Guard, SLA Daemon, and FreeLLMAPI Router.
- **Persistence & Cryptographic Tier**: Relational in-memory state paired with a SHA-256 cryptographic forward-chained audit ledger.

```
+-----------------------------------------------------------------------------------------+
|                                    CLIENT APPLICATION                                    |
|   +-------------------+  +--------------------+  +------------------+  +--------------+ |
|   | 1. Campus Portal  |  | 2. Supervisor Desk |  | 3. Administrator |  | 4. Judge     | |
|   |    (Student/Staff)|  |    (Triage/Assign) |  |    War Room      |  |    Simulator | |
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
|   |       Validates role permissions (REQUESTER, SUPERVISOR, TECHNICIAN, ADMIN)     |   |
|   +---------------------------------------+-----------------------------------------+   |
|                                           |                                             |
|                     +---------------------+---------------------+                       |
|                     |                                           |                       |
|                     v                                           v                       |
|     +-------------------------------+           +-------------------------------+       |
|     |     Deterministic FSM Guard   |           |    Campus SLA & Time Daemon   |       |
|     |  Permitted Workflow States    |           |  Deadlines · Auto-Escalation  |       |
|     |  Refusals -> HTTP 409 / 403   |           |  Virtual Time-Travel (+24h)   |       |
|     +---------------+---------------+           +---------------+---------------+       |
|                     |                                           |                       |
|                     +---------------------+---------------------+                       |
|                                           |                                             |
|                                           v                                             |
|   +---------------------------------------------------------------------------------+   |
|   |                   Tamper-Evident SHA-256 Cryptographic Ledger                   |   |
|   |     Chained Blocks · Accepted Transitions · Refused Actions · Integrity Verifier|   |
|   +---------------------------------------------------------------------------------+   |
+-------------------------------------------|---------------------------------------------+
                                            | Async Non-Blocking                           
                                            v                                              
+-----------------------------------------------------------------------------------------+
|                               AI COPILOT SIDECAR (ADVISORY)                             |
|   +---------------------------------------------------------------------------------+   |
|   |  FreeLLMAPI Router (app.1min.ai / Groq / Gemini) <---> Offline Rule Heuristics  |   |
|   |  • Room & Asset Tag Extraction             • Proximity Duplicate Detection      |   |
|   +---------------------------------------------------------------------------------+   |
+-----------------------------------------------------------------------------------------+
```

---

## 7. Verification & Synthetic Testing Results

GovFix has been programmatically verified against the official benchmark evaluation suite (`npm test`), testing 100% of the mandatory functional test cases:

```
🧪 RUNNING GOVFIX AUTOMATED VERIFICATION TEST SUITE
   Target Server: http://localhost:4000
=============================================================
  ✅ [PASS] 1. Valid request creation with public ID, SLA deadline, and initial audit block
  ✅ [PASS] 2. Refuses invalid transition SUBMITTED -> CLOSED with HTTP 409 [ERR_ILLEGAL_STATE_JUMP]
  ✅ [PASS] 3. Refuses unauthorized Requester triage attempt with HTTP 403 [ERR_ROLE_UNAUTHORIZED]
  ✅ [PASS] 4. Supervisor triages and dispatches request to IT/Maintenance technician
  ✅ [PASS] 5. Technician accepts assignment and transitions request to IN_PROGRESS
  ✅ [PASS] 6. Proposing closure without required evidence is strictly rejected
  ✅ [PASS] 7. Time-Travel SLA daemon detects overdue ticket and triggers Tier-1 escalation
  ✅ [PASS] 8. Duplicate escalation prevention blocks duplicate events for same rule
  ✅ [PASS] 9. Requester confirms resolution and closes ticket with satisfaction score
  ✅ [PASS] 10. SHA-256 Cryptographic Audit Chain verified 100% mathematically valid
=============================================================
📊 TEST RESULTS: 10 PASSED / 0 FAILED (100% Compliance)
```

---

## 8. Conclusion

GovFix delivers an uncheatable, lightweight, locally runnable workflow engine specifically optimized for the **University Service Requests** track. By replacing opaque ERP forms and flaky LLM chatbots with a **deterministic backend state machine**, **cryptographic SHA-256 audit chaining**, and an **advisory AI sidecar**, Team OrbitX provides Dr. D. Y. Patil Institute of Technology with an institutional-grade, zero-cost operational engine that ensures complete accountability.
