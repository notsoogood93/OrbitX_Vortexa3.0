# GovFix — Configurable Public-Institution Workflow Engine
### Track: University Service Requests (Maintenance, IT Support & Campus Facilities)
**VORTEXA 3.0 Hackathon · Problem Statement: G-02 (Domain 7: Government Systems & GovTech)**  
**Target Institution Context:** Dr. D. Y. Patil Institute of Technology, Pimpri, Pune  

---

## 📌 Executive Summary

Higher education campus infrastructure frequently collapses not because service requests are unrecorded, but because **tickets languish in unmonitored limbo, SLA deadlines pass silently without automated escalation, and traditional relational databases permit mutable, retroactive editing of historical records.**

**GovFix** is an institutional-grade, locally runnable, finite-state workflow engine purpose-built for campus maintenance and IT operations under one ironclad statutory principle:
> **"Deterministic Rules Govern Authority, State Transitions & Deadlines; AI Informs But Never Overrides."**

---

## 🚀 Key Features & Differentiators

1. **Deterministic Finite State Machine (FSM)**: Formally guards 10 lifecycle states (`DRAFT` $\rightarrow$ `SUBMITTED` $\rightarrow$ `TRIAGED` $\rightarrow$ `ASSIGNED` $\rightarrow$ `ACCEPTED` $\rightarrow$ `IN_PROGRESS` $\rightarrow$ `READY_FOR_CLOSURE` $\rightarrow$ `RESOLVED` $\rightarrow$ `CLOSED` $\rightarrow$ `REOPENED`). Illegal jumps return **HTTP 409 Conflict** (`ERR_ILLEGAL_STATE_JUMP`).
2. **Backend-Enforced Role RBAC**: Unauthorized actions return **HTTP 403 Forbidden** (`ERR_ROLE_UNAUTHORIZED`) and are permanently logged as refusal blocks.
3. **Dynamic SLA & Virtual Time-Travel Engine**: Fast-forward simulation clock (`+12h`, `+24h`, `+48h`, `Reset`) without modifying host OS time. Triggers automated Tier-1 (HOD) and Tier-2 (Registrar) escalations with duplicate-escalation suppression.
4. **Tamper-Evident SHA-256 Audit Ledger**: Every accepted transition, refused attempt, action, and evidence attachment is forward-chained into an immutable ledger with 1-click mathematical verification.
5. **Workflow Policy Sandbox (Feature 1)**: Allows administrators to dry-run simulate proposed SLA threshold rules against live requests with strict zero-mutation isolation before controlled, versioned activation.
6. **Evidence Integrity Lab (Feature 2)**: Cryptographic byte-level verification of repair evidence files against immutable audit hashes with an isolated demonstration fixture detecting 1-byte file alterations.
7. **Recurring-Failure Radar (Feature 3)**: Explainable heuristic clustering detecting chronic campus room and equipment defects with supervisor confirmation audit logging.
8. **AI Containment Advisory Layer**: Robust multilingual AI advisory assistant with deterministic heuristic extraction for English and Marathi request categorization and drafts. Strictly isolated from state mutations.

---

## 🛠️ Quickstart & Local Execution

### Prerequisites
- Node.js 18+ (tested on Node v24.20.0)
- Zero paid API keys or cloud dependencies required

### Installation & Startup
```powershell
# 1. Clone repository
git clone https://github.com/notsoogood93/OrbitX_Vortexa3.0.git
cd OrbitX_Vortexa3.0

# 2. Install dependencies (Express & CORS)
npm install

# 3. Start GovFix Server (Port 4000)
npm start

# 4. Open Dashboard in Browser
# http://localhost:4000
```

### Run 24-Point Benchmark Verification Suite
```powershell
npm test
# Executes all 24 end-to-end tests (100% Pass Target)
```

---

## 🧪 Benchmark Test Results (24/24 Passing)

```
=============================================================
🧪 RUNNING GOVFIX 10-POINT BENCHMARK VERIFICATION TEST SUITE
   Institution: Dr. D. Y. Patil Institute of Technology
   Track: University Service Requests
   Target Server: http://localhost:4000
=============================================================

  ✅ [PASS] 1. Valid request creation with public ID, SLA deadline, and initial audit block
  ✅ [PASS] 2. Rejects invalid transition SUBMITTED -> CLOSED with HTTP 409 [ERR_ILLEGAL_STATE_JUMP]
  ✅ [PASS] 3. Rejects unauthorized Requester triage attempt with HTTP 403 [ERR_ROLE_UNAUTHORIZED] and records audit
  ✅ [PASS] 4. Officer rejects assignment; ticket safely returns to TRIAGED with reason retained
  ✅ [PASS] 5. Virtual Time-Travel (+24h) detects overdue deadline and auto-escalates ticket
  ✅ [PASS] 6. Duplicate escalation prevention successfully blocks repeated escalation events
  ✅ [PASS] 7. Proposing closure without completion evidence is strictly rejected with HTTP 422 [ERR_MISSING_EVIDENCE]
  ✅ [PASS] 8. Supervisor approves closure; ticket transitions to CLOSED with cryptographic audit block
  ✅ [PASS] 9. Requester reopens request; original ID and prior closure history preserved
  ✅ [PASS] 10. SHA-256 Cryptographic Audit Ledger verified 100% Mathematically Valid (60 chained blocks)
  ✅ [PASS] 11. Enterprise Telemetry (/health & /metrics) reports healthy subsystem status and active FSM/SLA engines
  ✅ [PASS] 12. Role-based Authentication (/auth/login) successfully generates authorized session credentials
  ✅ [PASS] 13. Officer Work Action (/requests/:id/actions) appended to audit log with SHA-256 block hash
  ✅ [PASS] 14. Policy Sandbox dry-run simulation returns projected impacts while strictly leaving live requests and audit chain unchanged
  ✅ [PASS] 15. Policy Sandbox rejects contradictory policy (L1 breach > L2 breach) with HTTP 422 [ERR_CONTRADICTORY_POLICY]
  ✅ [PASS] 16. Policy Sandbox enforces administrator authorization and seals policy activation onto cryptographic audit ledger
  ✅ [PASS] 17. Evidence Integrity Lab verifies pristine file bytes match recorded SHA-256 digest [INTEGRITY_VERIFIED]
  ✅ [PASS] 18. Evidence Integrity Lab tamper fixture catches byte modification without modifying original evidence record
  ✅ [PASS] 19. Recurring-Failure Radar clusters room/category signals and provides explainable suggested remediation
  ✅ [PASS] 20. Recurring-Failure Radar supervisor review decision sealed to SHA-256 audit ledger [CONFIRMED_DEFECT]
  ✅ [PASS] 21. Smart Grievance Intelligence detects related complaints with explainable signals and enforces zero auto-merge
  ✅ [PASS] 22. SLA Policy Simulator produces side-by-side policy delta and strictly leaves live data and audit chain unmodified
  ✅ [PASS] 23. Verified Resolution Dossier outputs 4-stage pipeline with work notes, SHA-256 check, and room defect radar
  ✅ [PASS] 24. Role-Based Authorization rejects unauthorized requester policy activation with HTTP 403 [ERR_ROLE_UNAUTHORIZED]

=============================================================
📊 BENCHMARK TEST RESULTS: 24 PASSED / 0 FAILED (100% Target Met)
=============================================================
```

---

## 📑 Core Documentation Index

- [VORTEXA 3.0 Hackathon (OrbitX).pptx](VORTEXA%203.0%20Hackathon%20%28OrbitX%29.pptx) — Official Presentation Pitch Deck.
- [OrbitX_GovFix_Architecture_Report.pdf](OrbitX_GovFix_Architecture_Report.pdf) — Consolidated 4-page submission report.
- [DEMO_GUIDE.md](DEMO_GUIDE.md) — Step-by-step click-by-click live demonstration script (15 steps).
- [ARCHITECTURE.md](ARCHITECTURE.md) — Comprehensive technical architecture, FSM state graph, and invariants.
- [SECURITY_NOTES.md](SECURITY_NOTES.md) — Threat model, defense-in-depth authorization, and ledger boundaries.
- [VERIFICATION_REPORT.md](VERIFICATION_REPORT.md) — Empirical baseline audit and verification report.
