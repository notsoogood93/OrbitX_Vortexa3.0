# 📑 Product Requirements Document (PRD) — GovFix
**Configurable Municipal Grievance Redressal & SLA Accountability Engine**  
*Document Version: 1.0.0 · Project: OrbitX_Vortexa3.0 · VORTEXA 3.0 Hackathon (G-02)*

---

## 1. Executive Summary & Product Vision
**GovFix** is a next-generation civic workflow engine designed for municipal administrations (tailored to Pune Municipal Corporation [PMC] and Pimpri Chinchwad Municipal Corporation [PCMC]). 

While existing portals allow citizens to register grievances, they fail to enforce resolution accountability: complaints stall in unassigned queues, statutory deadlines lapse without supervisory notice, and status changes are made arbitrarily without tamper-proof audit trails.

### Vision Statement
> *"To transform municipal governance from an unmonitored ticketing backlog into a deterministic, role-guarded accountability engine where every grievance moves through strict verification gates, SLA breaches trigger automated hierarchical escalations, and every bureaucratic action is cryptographically signed."*

---

## 2. Problem Statement & Market Opportunity
In Indian municipal corporations, the gap between filing a grievance and physical resolution suffers from four systemic failures:
1. **The Silent Backlog**: Grievances filed via WhatsApp, portal, or physical letters lack strict SLA countdowns. Overdue complaints remain in an officer's inbox indefinitely without automated alarms.
2. **Arbitrary Status Mutations**: Corrupt or overwhelmed field personnel mark tickets "Resolved" without physical inspection proof or citizen confirmation.
3. **Lack of Role-Based FSM Enforcement**: Conventional software allows arbitrary status changes. Skipping triage or jumping directly to resolution goes unchecked.
4. **Vulnerable Audit History**: Standard relational databases allow administrative users to silently modify timestamps and delete overdue records without detection.

---

## 3. Target Personas & Stakeholder Matrix

| Persona | Role | Core Goals | Pain Points with Existing Systems |
| :--- | :--- | :--- | :--- |
| **Pravin (Citizen)** | Resident of Baner / Hinjawadi | Wants quick resolution of road potholes, water leaks, and open drains; speaks conversational Marathi. | Never receives progress updates; finds complaints closed without work being done on-site. |
| **Mr. Deshmukh (Ward Officer)** | Administrative head of Prabhag Ward | Needs to triage 100+ daily complaints, assign appropriate contractors, and avoid duplicate dispatch. | Drowning in repetitive complaints; lacks automated clustering and bilingual translation. |
| **Vinayak (Field Engineer)** | PWD / Water Supply Contractor | Needs clear work orders, location landmarks, and an interface to upload proof of physical work. | Unclear priorities; blamed for delays caused by bureaucratic assignment lags. |
| **Dr. Patil (Municipal Commissioner)** | City Administrative Commissioner | Needs high-level citywide SLA visibility; requires auto-escalation of chronic bottlenecks. | Blind to ward-level delays until citizens take to social media or stage protests. |
| **Hackathon Evaluator / Auditor** | Independent System Evaluator | Wants to verify that the system enforces rules strictly and doesn't rely on fragile LLM prompts. | Cannot test edge cases or time-sensitive escalations without waiting real days. |

---

## 4. Key Functional Requirements (Epics)

### Epic 1: Omnichannel Multilingual Ingestion & Sidecar AI
- **FR-1.1**: The system shall accept raw unstructured text in Marathi, Hindi, and English.
- **FR-1.2**: An AI sidecar shall extract category, urgency, ward, and landmarks, returning a non-binding recommendation.
- **FR-1.3**: The system shall flag proximity duplicates in the same ward within 24 hours to prevent redundant work orders.
- **FR-1.4**: All AI outputs must carry explicit `[Non-Binding Recommendation]` tags and must not mutate ticket state without human officer review.

### Epic 2: Deterministic Finite State Machine & Refusal Engine
- **FR-2.1**: The system shall enforce a strict 11-state lifecycle (`SUBMITTED` $\rightarrow$ `TRIAGED` $\rightarrow$ `ASSIGNED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `INSPECTION_PENDING` $\rightarrow$ `RESOLVED` $\rightarrow$ `CITIZEN_CONFIRMED`).
- **FR-2.2**: The system shall enforce Role-Based Access Control (`CITIZEN`, `WARD_OFFICER`, `FIELD_ENGINEER`, `SUPERVISING_COMMISSIONER`).
- **FR-2.3**: Any unauthorized role action or skipped state shall return an explicit refusal code (`ERR_ROLE_UNAUTHORIZED`, `ERR_ILLEGAL_STATE_JUMP`) and log the attempt to the audit ledger.

### Epic 3: Dynamic SLA & Multi-Tier Auto-Escalation
- **FR-3.1**: The system shall enforce category-specific SLAs: Emergency (12h), High (24h), Standard (48h), Routine (72h).
- **FR-3.2**: Crossing the 50% deadline threshold without assignment shall automatically trigger Tier-1 escalation (`ESCALATED_L1`).
- **FR-3.3**: Exceeding the final deadline shall automatically escalate the ticket to the Municipal Commissioner (`ESCALATED_L2`).
- **FR-3.4**: The system shall feature an interactive Time-Travel Controller (+12h, +24h, +48h, Reset) for live testing.

### Epic 4: Cryptographic SHA-256 Audit Ledger
- **FR-4.1**: Every accepted state transition, refusal, reassignment, and escalation shall generate a cryptographically chained block.
- **FR-4.2**: The block hash shall be computed as `SHA-256(index + timestamp + eventType + actor + role + ticketId + details + previousHash)`.
- **FR-4.3**: The system shall provide an automated integrity verification endpoint proving zero retroactive modification.

---

## 5. User Stories & Acceptance Criteria (Gherkin Syntax)

### User Story 1: Prohibited Status Jump Attempt
```gherkin
Scenario: Citizen attempts to directly mark a grievance as Resolved
  Given a grievance "PUN-2026-083" is in status "SUBMITTED"
  When a user with role "CITIZEN" attempts to transition state to "RESOLVED"
  Then the system rejects the transition with HTTP status 400
  And returns error code "ERR_ILLEGAL_STATE_JUMP" or "ERR_ROLE_UNAUTHORIZED"
  And appends a refusal event block to the SHA-256 cryptographic audit ledger
```

### User Story 2: Automated Tier-2 SLA Breach Escalation
```gherkin
Scenario: Ticket passes final deadline without resolution
  Given grievance "PUN-2026-081" has a 24-hour High Priority SLA
  When simulation time advances by +24 hours
  Then the SLA daemon detects that the deadline has expired
  And automatically transitions the ticket from "ASSIGNED" to "ESCALATED_L2"
  And logs an AUTO_ESCALATION_L2 event signed by SYSTEM_DAEMON to the audit ledger
```

### User Story 3: Citizen Satisfaction Verification & Reopen Window
```gherkin
Scenario: Citizen is dissatisfied with field resolution
  Given a grievance is in status "RESOLVED"
  When the citizen submits a reopen request with feedback within 48 hours
  Then the system transitions the ticket to "REOPENED"
  And returns the ticket to the Ward Officer triage queue for mandatory reassessment
```

---

## 6. Success Metrics & Key Performance Indicators (KPIs)

1. **Deterministic Rule Enforcement**: 100% of illegal state jumps and unauthorized role attempts blocked and logged.
2. **Mean Time to Triage (MTTT)**: Reduced from 48 hours to under 30 seconds via AI extraction.
3. **Escalation Detection Latency**: 0 seconds (real-time automated daemon trigger vs. zero in legacy systems).
4. **Audit Non-Repudiation**: 100% mathematically verifiable cryptographic chain across all historical events.
