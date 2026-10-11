# 🏛️ GovFix — Hackathon Pitch Deck (VORTEXA 3.0)
### Track 1: Municipal Grievance Resolution & Institutional Accountability Engine (PCMC / PMC Pune)
**Team OrbitX · Problem Statement G-02 (GovTech & Government Systems)**

---

## 📊 Presentation Overview (10 Slides)

- **Slide 1: Title & Hook** — Beyond Dead-End Chatbots
- **Slide 2: The Pune Reality** — 15,000+ Monthly Grievances in PCMC & PMC
- **Slide 3: The Core Failure Mode** — The "Limbo Problem" & Silent SLA Breaches
- **Slide 4: The GovFix Architecture** — Deterministic FSM + Non-Binding AI Sidecar
- **Slide 5: Finite State Machine (FSM)** — 11 States, Strict Role RBAC, Explicit Refusals
- **Slide 6: Tamper-Evident SHA-256 Audit Trail** — Immutable Accountability
- **Slide 7: Dynamic SLA Engine & Virtual Time-Travel** — Multi-Tier Escalations
- **Slide 8: AI Copilot (FreeLLMAPI & Heuristics)** — Multilingual Marathi/Hindi Extraction
- **Slide 9: Live Demo Walkthrough** — Citizen -> Officer -> Commissioner -> Chaos Test
- **Slide 10: Impact, Extensibility & Future Roadmap** — Beyond Grievances to All Civic Workflows

---

### Slide 1: Title & Hook
**Title**: GovFix: The Deterministic Municipal Workflow Engine
**Subtitle**: Transforming Municipal Grievances from Unmonitored Limbo into Cryptographically Audited Accountability.
**Visual / Key Stat**:
- "Most municipal portals are graveyard forms where citizen complaints go to die. We didn't build another chatbot that hallucinates resolution — we built an uncheatable state engine."
- Developed for PCMC (Pimpri Chinchwad) & PMC (Pune Municipal Corporation).

---

### Slide 2: The Pune Reality
**The Context**:
- Pune & Pimpri-Chinchwad are among India's fastest-growing metropolitan hubs (population 7.5M+).
- Citizens file over **15,000 complaints/month** across 8 zones and 32 wards (potholes on Baner/Wakad road, water contamination in Hadapsar, drainage overflows in Bhosari).
- Frontline ward staff face extreme cognitive load, manually parsing Marathi/English messages, leading to misrouted complaints and missed deadlines.

---

### Slide 3: The Core Failure Mode: Why Portals Fail
1. **The "Limbo" Problem**: Tickets sit in "In Progress" indefinitely with no penalty.
2. **Ghost Resolutions**: Contractors mark complaints "Resolved" without photographic evidence or inspection sign-off.
3. **Silent SLA Breaches**: Deadlines pass without alerting the Ward Officer or Municipal Commissioner.
4. **Flaky LLM Risk**: If an LLM is placed in charge of municipal database states, it hallucinates status jumps, approves invalid requests, or silently drops cases.

---

### Slide 4: The GovFix Architectural Paradigm
**The Iron Rule**: *Deterministic Rules Govern State & Authority; AI Informs But Never Overrides.*
- **Core Engine (Node.js/Express)**: 
  - Strictly deterministic 11-State Finite State Machine (FSM).
  - Explicit refusal engine: invalid moves return HTTP 422 with unique refusal codes (`ERR_ILLEGAL_STATE_JUMP`, `ERR_ROLE_UNAUTHORIZED`, `ERR_MISSING_EVIDENCE`).
- **Cryptographic Audit Ledger**: Every action (accepted or rejected) is forward-chained via SHA-256 blocks with root integrity verification.
- **AI Sidecar**: FreeLLMAPI multilingual inference router + zero-latency heuristic fallback. Proposes category, urgency, and Marathi action drafts — without write access to state.

---

### Slide 5: The 11-State FSM Lifecycle & Role RBAC
```
[SUBMITTED] ──(Officer Triage)──> [TRIAGED] ──(Assign)──> [ASSIGNED]
     │                                                         │
     ├──(Reject with reason)                                   ├──(Acknowledge)
     ▼                                                         ▼
[REJECTED_INVALID]                                      [IN_PROGRESS]
                                                               │
[ESCALATED_L2] <──(Auto-SLA >48h)────── [ESCALATED_L1]        ├──(Upload Proof)
      │                                       │                ▼
      │(Commissioner Direct Order)            │(Supervisor) [INSPECTION_PENDING]
      └──────────────────┬────────────────────┘                │
                         ▼                                     ├──(Officer Sign-off)
                    [IN_PROGRESS]                              ▼
                                                           [RESOLVED]
                                                               │
                         [REOPENED] <──(Dispute <48h)──────────┴──(Citizen Rating)──> [CLOSED]
```
- Strict Role Enforcement: `CITIZEN`, `WARD_OFFICER`, `FIELD_ENGINEER`, `SUPERVISING_COMMISSIONER`, `SYSTEM_DAEMON`.
- Zero silent skips: jumping from `SUBMITTED` directly to `RESOLVED` is mathematically impossible.

---

### Slide 6: Tamper-Evident SHA-256 Audit Trail
- Every transaction creates a cryptographically signed block:
  - `blockIndex`, `timestamp`, `eventType`, `actorRole`, `ticketId`, `payload`, `previousHash`, and `hash`.
- Includes **Refusal Logging**: When an unauthorized user attempts an illegal move, the refused attempt is recorded in the immutable audit trail.
- One-click **Cryptographic Verification**: Re-computes the entire SHA-256 merkle-like chain in milliseconds to prove zero tampering.

---

### Slide 7: Dynamic SLA Engine & Virtual Time-Travel
- **Dynamic SLA Matrix**:
  - Hazard / Emergency (Open electrical wire, water burst): **12 Hours** SLA (Escalates L1 at 6h, L2 at 12h)
  - High Priority (Deep pothole, road cave-in): **24 Hours** SLA (Escalates L1 at 12h, L2 at 24h)
  - Standard (Streetlights, drainage): **48 Hours** SLA (Escalates L1 at 36h, L2 at 48h)
  - Routine (Garbage pickup): **72 Hours** SLA (Escalates L1 at 48h, L2 at 72h)
- **Built-in Time-Travel Engine**:
  - Judges do not need to wait 24 hours. The UI provides instant `+12h`, `+24h`, and `+48h` fast-forward buttons.
  - Automatically triggers the background escalation daemon and updates the Commissioner War Room in real time!

---

### Slide 8: AI Intelligence (FreeLLMAPI & Sidecar Copilot)
- **Multilingual Support**: Accepts complaints in colloquial Marathi (*"रावेत चौक रस्त्यावर मोठा खड्डा पडला आहे"*), Hindi (*"पानी की पाइपलाइन फूट गई है"*), or English.
- **Zero-Dependency Resilience**: Connected to FreeLLMAPI (`http://localhost:3001/v1`) with 212 model endpoints. If external providers are offline, the local deterministic heuristic extractor instantly activates with zero downtime.
- **Statutory Guardrail**: AI suggestions are tagged `Advisory Only`. An officer must physically review and click `Accept & Dispatch`.

---

### Slide 9: The 4-in-1 Live Evaluation Dashboard
Built specifically for hackathon judging:
1. **Citizen Portal**: File complaint in Marathi/English, live ticket tracker with SLA countdown.
2. **Ward Officer Desk**: Side-by-side AI triage recommendation vs manual override, work order dispatch.
3. **Commissioner War Room**: Municipal-wide SLA compliance metrics, real-time Tier-1/Tier-2 escalation table.
4. **Judge Simulator & Chaos Panel**:
   - Refusal Test: Force citizen to mark resolved -> see `ERR_ROLE_UNAUTHORIZED` (HTTP 422).
   - Time-Travel Test: Fast-forward +24h -> watch tickets auto-escalate to Commissioner.
   - Crypto Verifier: Click "Verify Integrity" -> 100% SHA-256 chain validation.

---

### Slide 10: Production Scalability & Impact
- **Immediate Applicability**: Can be plugged into PCMC Sarathi or PMC Care helpline backend tomorrow via standard REST API.
- **Zero Vendor Lock-in**: Works with local open-source models, FreeLLMAPI, or enterprise cloud providers.
- **Universal Civic Workflow Engine**: The exact same deterministic FSM core adapts to:
  - Building permission approvals
  - Tree-cutting permits
  - Property tax dispute arbitrations
- **Team OrbitX**: Built in 12 hours with automated testing, complete IEEE 830 documentation, and 100% test coverage.
