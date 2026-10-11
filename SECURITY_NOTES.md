# GovFix Security & Integrity Analysis (SECURITY_NOTES.md)

**Event:** VORTEXA 3.0 Hackathon  
**Problem Statement:** G-02 — GovFix: Configurable Public-Institution Workflow Engine  
**Track:** University Service Requests  
**Target Institution:** Dr. D. Y. Patil Institute of Technology, Pimpri, Pune  

---

## 1. Authentication & Session Architecture

- **Role-Based Authentication (`POST /auth/login`):**
  - Accepts username/email and role.
  - Returns simulated session tokens formatted as `govfix-jwt-<base64>` and role-normalized permissions.
  - Token expiration is enforced at 24 hours (86,400s).
- **Server-Side Enforcement (Defense-in-Depth):**
  - Frontend UI buttons are disabled or hidden based on active roles.
  - Crucially, **all state transitions and actions are strictly verified on the backend service layer (`WorkflowFSM.attemptTransition`)**.
  - Any attempt to bypass frontend restrictions returns `HTTP 403 Forbidden` (`ERR_ROLE_UNAUTHORIZED`) or `HTTP 409 Conflict` (`ERR_ILLEGAL_STATE_JUMP`).

---

## 2. Secrets & Credential Management

- **Zero Hardcoded Secrets in Git:**
  - Database access credentials, private keys, and environment files (`.env`) are kept strictly out of the repository via `.gitignore`.
  - FreeLLMAPI router keys are passed via environment variables (`FREELLMAPI_API_KEY`) with safe offline fallback.
- **Sensitive Data Handling in Audit Ledger:**
  - Audit logs record event metadata, actor roles, ticket IDs, and technical repair notes.
  - Student passwords and personal identity numbers are strictly excluded from audit event payloads.

---

## 3. Cryptographic Audit Ledger Capabilities & Exact Limitations

GovFix implements a forward-chained SHA-256 block ledger where each block computes:
$$\text{Hash}_i = \text{SHA-256}(\text{Index}_i \parallel \text{Timestamp}_i \parallel \text{EventType}_i \parallel \text{Actor}_i \parallel \text{Role}_i \parallel \text{TicketId}_i \parallel \text{Details}_i \parallel \text{Hash}_{i-1})$$

### What the Ledger CAN Detect:
1. **Payload Tampering:** Any modification to a historical block's payload changes its recomputed hash and immediately breaks `verifyIntegrity()`.
2. **Block Deletion / Truncation:** Removing any intermediate block breaks the `previousHash` pointer of the following block.
3. **Block Reordering:** Swapping block positions invalidates the forward chaining pointers.
4. **Refused Unauthorized Moves:** Every rejected transition attempt is permanently sealed as a refusal block (`isRefusal: true`) with the actor's identity and violation code.

### What the Ledger CANNOT Prevent (Accurately Stated Limitations):
1. **Host-Level Process Replacement:** Because runtime state is currently in-memory, a privileged host administrator who terminates the process and wipes memory could restart with fresh seed data. In an enterprise production deployment, this ledger would write to an append-only WORM (Write Once, Read Many) cloud bucket or distributed consensus network.
2. **51% Complete Rewrite Attack:** If an actor with root database access rewrites the entire ledger from block 0 onwards and recalculates every subsequent hash, the internal pointers would remain mathematically consistent. To mitigate this, GovFix periodically publishes root state hashes into external verification logs.

---

## 4. Evidence Integrity Lab Guarantees & Bounds

- **Byte-Level Verification:** Calculates SHA-256 over raw file buffers (`crypto.createHash('sha256').update(fileBuffer).digest('hex')`).
- **Path Traversal Protection:** All filenames are sanitized with `.replace(/^.*[\\\/]/, '').replace(/[^a-zA-Z0-9._-]/g, '_')` preventing directory traversal attacks.
- **Upload Ceiling:** Enforces a strict 10MB file size ceiling to prevent denial-of-service memory exhaustion.
- **Statutory Limitation:**
  > A matching SHA-256 byte digest proves beyond cryptographic doubt that the verified file is byte-for-byte identical to the file recorded at upload time. It does **not** prove whether the technician was telling the truth or whether the physical repair was actually performed in the real world.

---

## 5. AI Containment Security Perimeter

- **Advisory Containment Boundary:**
  - The AI Copilot (`AICopilotService`) operates on a non-authoritative read-only boundary.
  - AI responses are returned as advisory suggestions and flagged with `NON_BINDING_SUGGESTION`.
  - **The AI has zero database write access, zero state transition mutation authority, and zero deadline alteration privileges.**
- **Network Resilience:**
  - If the AI service (`http://localhost:3001/v1`) times out (>4000ms) or is unreachable, the system automatically falls back to deterministic local campus regex heuristics with zero service interruption.
