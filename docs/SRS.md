# 📘 Software Requirements Specification (SRS)
### GovFix — Configurable Public-Institution Workflow Engine
**Standard: IEEE Std 830-1998 Compliant**  
*Document Version: 1.0.0 · Track: Municipal Grievance Resolution (PMC / PCMC Pune) · Problem Statement: G-02*

---

## 1. Introduction

### 1.1 Purpose
This Software Requirements Specification (SRS) establishes the complete functional and non-functional requirements for **GovFix**, an institutional-grade municipal workflow engine. It specifies the finite-state machine (FSM), SLA calculation rules, cryptographic audit ledger, non-binding AI sidecar integration, and REST interface schemas.

### 1.2 Document Conventions
- **MUST / SHALL**: Mandatory requirement.
- **SHOULD**: High-priority architectural recommendation.
- **MAY**: Optional extensibility feature.

### 1.3 Intended Audience
- Hackathon Evaluation Committee (AIRS, Dr. D. Y. Patil Institute of Technology).
- Enterprise GovTech Software Engineers & Municipal System Administrators.
- Third-party Security Auditors & Independent Verification Entities.

### 1.4 Product Scope
GovFix provides a deterministic state-enforcing backend and interactive web console for managing the lifecycle of municipal grievances across Pune wards (Baner, Hinjawadi, Kothrud, Hadapsar, Pimpri). It guarantees:
1. Strict Role-Based FSM enforcement with explicit refusal reasons.
2. Dynamic SLA countdowns with multi-tier automated escalation.
3. Cryptographic forward-linked SHA-256 audit logs.
4. Non-binding multilingual Marathi/Hindi/English advisory extraction.

---

## 2. Overall Description

### 2.1 Product Perspective
GovFix operates as a central middleware engine between public citizen interfaces, field contractor mobile endpoints, and municipal supervisory dashboards.

```text
[Citizen Ingestion Portal] ────┐
[Field Contractor App]     ────┼───▶ [GovFix API Gateway] ───▶ [Deterministic FSM Core]
[Commissioner War Room]    ────┘             │                          │
                                             ▼                          ▼
                                   [FreeLLMAPI AI Router]    [SHA-256 Audit Chain]
```

### 2.2 User Classes & Permissions Matrix

| User Class | Authorized Transitions | Prohibited Actions |
| :--- | :--- | :--- |
| **`CITIZEN`** | Submit grievance, confirm closure (`CITIZEN_CONFIRMED`), dispute/reopen (`REOPENED`). | Cannot triage, assign contractors, or mark tickets resolved. |
| **`WARD_OFFICER`** | Triage incoming tickets, reject invalid complaints, assign field engineers, sign off on inspection (`RESOLVED`). | Cannot bypass triage, cannot skip field engineer assignment. |
| **`FIELD_ENGINEER`** | Acknowledge assignment (`IN_PROGRESS`), submit field work completion proof (`INSPECTION_PENDING`). | Cannot triage, reject, or mark ticket officially resolved. |
| **`SUPERVISING_COMMISSIONER`** | Universal supervisory override, emergency intervention, priority reassignment. | Actions remain subject to mandatory cryptographic logging. |
| **`SYSTEM_DAEMON`** | Automated escalation to Tier-1 (`ESCALATED_L1`) and Tier-2 (`ESCALATED_L2`) upon SLA breach. | Automated daemon cannot reject tickets or mark them resolved. |

### 2.3 Operating Environment & Stack
- **Runtime**: Node.js v20+ / ES Modules.
- **Web Server**: Express.js with CORS and JSON middleware.
- **Cryptography**: Node.js `crypto` module (SHA-256).
- **AI Router**: FreeLLMAPI OpenAI-compatible gateway (`http://localhost:3001/v1`).
- **Frontend**: Vanilla HTML5, CSS3 Glassmorphism, Modern ES6 JavaScript.

---

## 3. Specific System Features & Requirements

### 3.1 Finite State Machine (FSM) Engine
- **SRS-FSM-01**: The system SHALL maintain exactly 11 distinct states: `SUBMITTED`, `TRIAGED`, `REJECTED_INVALID`, `ASSIGNED`, `IN_PROGRESS`, `INSPECTION_PENDING`, `RESOLVED`, `CITIZEN_CONFIRMED`, `REOPENED`, `ESCALATED_L1`, `ESCALATED_L2`.
- **SRS-FSM-02**: The system SHALL evaluate all transition requests using the `TRANSITIONS` policy matrix.
- **SRS-FSM-03**: In the event of an invalid transition or unauthorized role, the system SHALL reject the operation with HTTP `400 Bad Request` and return a standardized refusal JSON object:
  ```json
  {
    "success": false,
    "refused": true,
    "code": "ERR_ILLEGAL_STATE_JUMP",
    "reason": "Direct transition from 'SUBMITTED' to 'RESOLVED' is prohibited by municipal governance policy.",
    "auditHash": "SHA256_HEX_STRING"
  }
  ```
- **SRS-FSM-04**: Every refusal event SHALL be committed to the cryptographic audit ledger.

### 3.2 Dynamic SLA & Escalation Engine
- **SRS-SLA-01**: Every grievance SHALL be assigned an SLA policy based on urgency:
  - *Emergency*: 12 hours total SLA (Tier-1 escalation at 6h, Tier-2 escalation at 12h).
  - *High*: 24 hours total SLA (Tier-1 escalation at 12h, Tier-2 escalation at 24h).
  - *Standard*: 48 hours total SLA (Tier-1 escalation at 36h, Tier-2 escalation at 48h).
  - *Routine*: 72 hours total SLA (Tier-1 escalation at 48h, Tier-2 escalation at 72h).
- **SRS-SLA-02**: The system SHALL provide an API (`POST /api/simulation/time-travel`) to advance virtual simulation time by +12h, +24h, or +48h for live evaluation.
- **SRS-SLA-03**: The background SLA daemon SHALL evaluate active tickets every 30 seconds and automatically trigger `AUTO_ESCALATION_L1` or `AUTO_ESCALATION_L2` when thresholds are crossed.

### 3.3 Cryptographic Audit Ledger
- **SRS-AUD-01**: The system SHALL initialize with a Genesis Block containing `previousHash: 0000000000000000000000000000000000000000000000000000000000000000`.
- **SRS-AUD-02**: Each subsequent block SHALL compute its hash using the formula:
  $$\text{Hash}_n = \text{SHA256}(\text{Index}_n \parallel \text{Timestamp}_n \parallel \text{EventType}_n \parallel \text{Actor}_n \parallel \text{Role}_n \parallel \text{TicketId}_n \parallel \text{Details}_n \parallel \text{Hash}_{n-1})$$
- **SRS-AUD-03**: The system SHALL expose an endpoint `GET /api/audit` that recomputes all block hashes sequentially and returns `{ valid: true/false, brokenAtIndex: n }`.

### 3.4 Non-Binding AI Copilot Sidecar
- **SRS-AI-01**: The system SHALL accept grievance descriptions in Marathi, Hindi, and English.
- **SRS-AI-02**: The AI copilot SHALL propose `{ category, urgency, ward, location, summary }`.
- **SRS-AI-03**: If the remote LLM endpoint is unreachable, the system SHALL automatically invoke the local deterministic heuristic parser without raising an unhandled exception.
- **SRS-AI-04**: AI outputs SHALL carry explicit non-binding metadata and SHALL NOT alter ticket status or assigned personnel without human approval.

---

## 4. External Interface Requirements

### 4.1 REST API Interface
- `GET /api/grievances`: Returns list of all tickets enriched with dynamic SLA metrics.
- `GET /api/grievances/:id`: Returns ticket details and full cryptographic event history.
- `POST /api/grievances`: Creates new ticket, runs AI triage, computes deadlines, logs genesis audit.
- `POST /api/grievances/:id/transition`: Executes state transition or returns formal refusal.
- `POST /api/simulation/time-travel`: Modifies virtual time offset and runs escalation evaluation.
- `GET /api/audit`: Returns complete audit chain and verification results.

### 4.2 Web User Interface
- **Citizen Portal**: Complaint submission with pre-fill demo chips, live lifecycle progress tracker, and satisfaction sign-off.
- **Ward Officer Desk**: Split-pane queue view, side-by-side AI advisory cards, duplicate proximity warnings, and assignment controls.
- **Commissioner War Room**: Citywide SLA metrics counters, ward breakdown, and escalation table.
- **Judge Chaos Simulator**: Interactive refusal tester, time-travel fast-forward buttons, and cryptographic ledger verification console.

---

## 5. Non-Functional Requirements (NFRs)

- **Security (NFR-SEC-01)**: Role authorization must be enforced in the server business logic, not purely via UI button visibility.
- **Auditability (NFR-AUD-01)**: Refused attempts must be logged identically to accepted attempts to guarantee accountability for corrupt or improper actions.
- **Performance (NFR-PERF-01)**: State transition requests must complete in under 50 milliseconds.
- **Reliability (NFR-REL-01)**: In-memory seed state and ledger must operate continuously without crashing if third-party LLM providers return 429 rate limits or timeouts.
- **Correctness (NFR-CORR-01)**: In accordance with VORTEXA 3.0 common rules, mathematical arithmetic and state permissions must follow explicit code rules without AI override.
