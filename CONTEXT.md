# GovFix Architecture & Ubiquitous Language Context (CONTEXT.md)

**Domain 7:** Government Systems & GovTech  
**Problem Statement:** G-02 — GovFix: Configurable Public-Institution Workflow Engine  
**Track:** University Service Requests  
**Target Institution:** Dr. D. Y. Patil Institute of Technology, Pimpri, Pune  

---

## 1. Domain Model & Ubiquitous Language

| Domain Term | Definition | System Identifier / Role |
| :--- | :--- | :--- |
| **Requester** | Student or faculty member initiating an academic or infrastructure service request. | `REQUESTER`, `STUDENT`, `FACULTY` |
| **Authorized Officer** | Departmental technician or lab assistant assigned to inspect, diagnose, and repair the reported issue. | `OFFICER`, `TECHNICIAN` |
| **Supervisor** | Academic Head of Department (HOD) or Campus Facility Manager authorizing assignments and verifying closure proof. | `SUPERVISOR`, `HOD` |
| **Registrar** | Executive campus authority who handles Tier-2 escalations and retains unilateral emergency intervention powers. | `REGISTRAR`, `ADMIN` |
| **Service Request** | The central aggregate tracking an operational issue across rooms, labs, or campus assets. | `TICKET`, `REQUEST`, `GRIEVANCE` |
| **Finite State Machine (FSM)** | The deterministic state transition engine enforcing valid lifecycle progressions. AI is strictly prohibited from altering states. | `src/engine/fsm.js` |
| **SLA & Escalation Engine** | Virtual time-aware engine calculating deadlines, remaining hours, and triggering Tier-1/Tier-2 escalations. | `src/engine/sla.js` |
| **Cryptographic Audit Ledger** | Append-only SHA-256 block ledger preserving all state mutations, assignments, refusals, and closures. | `src/engine/auditLedger.js` |
| **Evidence Package** | Required proof artifact (technical notes, measurements, SHA-256 file checksum) mandatory for proposing closure. | `EVIDENCE_ATTACHMENT` |

---

## 2. Finite State Machine (FSM) Lifecycle & Invariants

```
                   [ DRAFT ]
                       │ (submit)
                       ▼
                 [ SUBMITTED ]
                       │ (triage)
                       ▼
                  [ TRIAGED ] ◄────────────┐
                       │                   │ (reject assignment)
                       │ (assign officer)  │
                       ▼                   │
                 [ ASSIGNED ] ─────────────┘
                       │
                       │ (officer accepts)
                       ▼
                [ IN_PROGRESS ] ──(overdue SLA)──► [ ESCALATED_L1 ]
                       │                                  │
                       │                                  │ (unresolved +48h)
                       │                                  ▼
                       │                           [ ESCALATED_L2 ]
                       │ (submit evidence)
                       ▼
              [ READY_FOR_CLOSURE ]
                       │
         ┌─────────────┴─────────────┐
         │ (supervisor approves)     │ (supervisor rejects)
         ▼                           ▼
    [ RESOLVED ]               [ IN_PROGRESS ]
         │
         │ (audit confirmation)
         ▼
     [ CLOSED ] ──(requester reopens)──► [ REOPENED ] ──► [ TRIAGED ]
```

### Deterministic State Transitions Table
| Current State | Target State | Permitted Roles | Required Payload / Condition |
| :--- | :--- | :--- | :--- |
| `DRAFT` | `SUBMITTED` | `REQUESTER` | Requester contact, title, description |
| `SUBMITTED` | `TRIAGED` | `SUPERVISOR`, `ADMIN` | Priority & category verification |
| `TRIAGED` | `ASSIGNED` | `SUPERVISOR`, `ADMIN` | Assigned officer ID |
| `ASSIGNED` | `IN_PROGRESS` | `OFFICER` | Acceptance confirmation |
| `ASSIGNED` | `TRIAGED` | `OFFICER` | Rejection reason logged |
| `IN_PROGRESS` | `READY_FOR_CLOSURE` | `OFFICER` | Evidence Package (notes + SHA-256 hash) |
| `READY_FOR_CLOSURE` | `RESOLVED` | `SUPERVISOR` | Supervisor approval & rating |
| `READY_FOR_CLOSURE` | `IN_PROGRESS` | `SUPERVISOR` | Defect reason logged |
| `RESOLVED` | `CLOSED` | `SUPERVISOR`, `ADMIN` | Cryptographic ledger sealing |
| `CLOSED` | `REOPENED` | `REQUESTER` | Reopening rationale logged |
| `IN_PROGRESS` | `ESCALATED_L1` | `SYSTEM` (SLA daemon) | SLA deadline breached |
| `ESCALATED_L1` | `ESCALATED_L2` | `SYSTEM` (SLA daemon) | Extended SLA breach (+48h) |
| `*` (Any State) | `CLOSED` | `REGISTRAR` | Direct Executive Intervene |

---

## 3. Standard Violation Codes (HTTP 403 / 422)

- `ERR_UNAUTHORIZED`: Actor does not possess the requisite role for this transition.
- `ERR_INVALID_TRANSITION`: Requested state transition does not exist in FSM transition graph.
- `ERR_MISSING_EVIDENCE`: Attempting `READY_FOR_CLOSURE` without mandatory technical notes and SHA-256 verification hash.
- `ERR_OVERDUE_LOCKED`: Modification attempted on an overdue request without supervisor override.

---

## 4. API Endpoints (GovFix Table 5 Specification Compliance)

| Endpoint | Method | Role | Description |
| :--- | :--- | :--- | :--- |
| `/auth/login` | POST | All | Session credential generation |
| `/requests` | POST | Requester | Intake of new service request |
| `/requests` | GET | All | List all campus requests with SLA metrics |
| `/requests/:id` | GET | All | Detailed request view & audit history |
| `/requests/:id/assign` | POST | Supervisor | Assign request to departmental technician |
| `/assignments/:id/decision` | POST | Officer | Officer accepts or rejects ticket assignment |
| `/requests/:id/actions` | POST | Officer | Officer records technical diagnostics or actions |
| `/requests/:id/closure-proposal` | POST | Officer | Propose closure with mandatory evidence package |
| `/closures/:id/decision` | POST | Supervisor | Approve or reject proposed closure |
| `/requests/:id/reopen` | POST | Requester | Reopen closed request with rationale |
| `/audit` | GET | Auditor / Public | Fetch full cryptographic SHA-256 ledger & verification |
| `/health` | GET | Public | Microservice uptime, FSM/SLA engine status |
| `/metrics` | GET | Public | Campus request breakdown, virtual time offset |

---

## 5. Architectural Invariants

1. **AI Containment Boundary**: The AI advisory model (`FreeLLM / Gemini 2.5 Flash`) acts solely as an informational advisor (suggesting urgency, department, and drafting response text). It cannot mutate state, update deadlines, or reassign tickets.
2. **Deterministic Time-Travel**: All SLA calculations use `slaManager.getCurrentTime()`. Time simulation controls (`+12h`, `+24h`, `+48h`, `Reset`) advance virtual time deterministically without altering system OS clocks.
3. **Ledger Immutability**: Every block contains `index`, `timestamp`, `eventType`, `ticketId`, `actor`, `details`, `previousHash`, and `blockHash = SHA-256(...)`. Modifying any historical block breaks all subsequent hashes.
