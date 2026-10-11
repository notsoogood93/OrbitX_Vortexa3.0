# ⏱️ GovFix — 3-Minute Winning Live Demo Script
**Judge Presentation Guide for VORTEXA 3.0 Hackathon (Problem Statement G-02)**

---

## 🎯 Target Presentation Duration: 3 Minutes 30 Seconds

| Timestamp | Phase | What to Say | What to Click / Show on Screen |
| :---: | :--- | :--- | :--- |
| **0:00 - 0:30** | **The Hook & Problem** | *"Respected judges, municipal complaint systems in cities like Pune don't fail at registration—they fail in execution. Complaints sit in email threads for weeks, deadlines pass silently, unauthorized status changes occur without proof, and citizens hear nothing. We built GovFix: an institutional-grade, finite-state workflow engine that enforces deterministic state transitions, dynamic multi-tier SLA escalations, and a tamper-proof SHA-256 audit ledger."* | Show **Tab 1: Citizen Portal** and the live Municipal SLA Clock at `http://localhost:4000`. |
| **0:30 - 1:15** | **Live Citizen Ingestion & Non-Binding AI** | *"Watch how easy it is for a citizen to report an issue in conversational Marathi or English. Notice that under hackathon rules, AI informs decisions but never overrides statutory rules."* | 1. Click **📍 Pothole (Marathi)** chip: `बाणेर रोडवर मोठा खड्डा पडला आहे...`<br>2. Click **Submit Grievance**.<br>3. Show the newly created ticket with side-by-side **AI Recommendation Badge** (`Category: Roads & Potholes`, `Urgency: HIGH`, `Ward: Baner - Balewadi`).<br>4. Point out the **Non-Binding Notice** proving AI did not alter state without human officer review. |
| **1:15 - 2:00** | **Ward Officer Workflow & Duplicate Clustering** | *"Switching to Tab 2 (Ward Officer Desk): Officers see incoming complaints triaged automatically. If 5 citizens report the same road, GovFix detects proximity clusters to prevent duplicate contractor payouts."* | 1. Click **Tab 2: Ward Officer Desk**.<br>2. Click any ticket.<br>3. Show the **Duplicate Cluster Warning** banner.<br>4. Demonstrate dispatching a Field Engineer and clicking **Verify & Move to TRIAGED** $\rightarrow$ **ASSIGNED**. |
| **2:00 - 2:45** | **The Killer Feature: Deterministic FSM Refusal Test** | *"Now let's test system robustness in Tab 4 (Judge Chaos Simulator). What happens if an unauthorized citizen tries to mark a ticket 'Resolved', or an officer tries to skip steps?"* | 1. Click **Tab 4: Judge Simulator**.<br>2. Under Test 1, set Role to `CITIZEN` and target state to `RESOLVED`.<br>3. Click **Execute Transition Attempt**.<br>4. **Boom**: Show the red refusal box with explicit code `ERR_ILLEGAL_STATE_JUMP` or `ERR_ROLE_UNAUTHORIZED` and its real-time SHA-256 audit hash! |
| **2:45 - 3:15** | **Time-Travel SLA Auto-Escalation** | *"What happens when an officer ignores a complaint? In traditional portals, nothing happens. In GovFix, the SLA daemon auto-escalates."* | 1. Click the **Fast Forward +24h** button in the top bar.<br>2. Watch tickets turn RED and the daemon output log: `🚨 Auto-Escalated PUN-2026-081 to Tier L2 (Commissioner Level)`.<br>3. Switch to **Tab 3: Commissioner War Room** to show the emergency intervention roster. |
| **3:15 - 3:30** | **Cryptographic Tamper-Proof Audit & Closing** | *"Finally, every accepted change, refusal, and escalation is cryptographically chained. Click 'Verify Integrity'—the system recomputes the SHA-256 chain and proves mathematically that no bureaucrat altered the history. GovFix delivers complete transparency, deterministic accountability, and actionable governance. Thank you!"* | Click **Verify Cryptographic Integrity** $\rightarrow$ show the green verification banner with 100% intact hash blocks. |

---

## 💡 Quick Tips for Judges' Questions:
- **Q: "Why not use a standard LLM to manage the workflow?"**
  - **A**: *"LLMs are probabilistic and hallucinate. Municipal governance requires legal determinism: state transitions and SLA penalties must follow immutable code, not prompt tokens. We use AI solely for multilingual extraction, clustering, and draft communication."*
- **Q: "What if the external AI service or internet goes down?"**
  - **A**: *"GovFix features a deterministic local heuristic fallback. The system continues operating 100% offline without crashing."*
- **Q: "How does this prevent corrupt officers from faking resolutions?"**
  - **A**: *"Two layers: First, the FSM mandates physical work completion proof before inspection. Second, a ticket cannot be permanently closed without Citizen Confirmation, backed by a 48-hour dispute reopening window."*
