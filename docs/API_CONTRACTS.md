# 📋 GovFix — API Contracts & FSM State Specification
**Municipal Grievance Workflow Engine · VORTEXA 3.0 (G-02)**

---

## 1. Global Enumerations

### 1.1 Finite State Machine (FSM) States
```typescript
enum WorkflowState {
  SUBMITTED           = 'SUBMITTED',           // Initial state upon citizen registration
  TRIAGED             = 'TRIAGED',             // Verified by Officer / AI Sidecar
  REJECTED_INVALID    = 'REJECTED_INVALID',    // Rejected with recorded formal justification
  ASSIGNED            = 'ASSIGNED',            // Dispatched to Field Engineer
  IN_PROGRESS         = 'IN_PROGRESS',         // Field work actively underway
  INSPECTION_PENDING  = 'INSPECTION_PENDING',  // Field work complete; awaiting inspection
  RESOLVED            = 'RESOLVED',            // Officer on-site inspection passed
  CITIZEN_CONFIRMED   = 'CITIZEN_CONFIRMED',   // Citizen satisfaction verified (Terminal State)
  REOPENED            = 'REOPENED',            // Citizen disputed resolution within 48h
  ESCALATED_L1        = 'ESCALATED_L1',        // SLA breach: Escalate to Ward Officer
  ESCALATED_L2        = 'ESCALATED_L2'         // SLA breach: Escalate to Commissioner
}
```

### 1.2 User Roles & Access Control
```typescript
enum UserRole {
  CITIZEN                  = 'CITIZEN',
  WARD_OFFICER             = 'WARD_OFFICER',
  FIELD_ENGINEER           = 'FIELD_ENGINEER',
  SUPERVISING_COMMISSIONER = 'SUPERVISING_COMMISSIONER',
  SYSTEM_DAEMON            = 'SYSTEM_DAEMON'
}
```

### 1.3 Categories & SLA Priority Policies
```typescript
enum GrievanceCategory {
  ROADS_POTHOLES          = 'Roads & Potholes',
  WATER_CONTAMINATION     = 'Water Supply & Contamination',
  DRAINAGE_SEWAGE         = 'Drainage & Sewage Leakage',
  ELECTRICAL_STREETLIGHTS = 'Streetlights & Electrical Hazards',
  SOLID_WASTE             = 'Garbage & Solid Waste',
  PUBLIC_NUISANCE         = 'Stray Animals & Public Nuisance'
}

enum UrgencyLevel {
  EMERGENCY = 'EMERGENCY', // 12h Total SLA (L1: 6h, L2: 12h)
  HIGH      = 'HIGH',      // 24h Total SLA (L1: 12h, L2: 24h)
  STANDARD  = 'STANDARD',  // 48h Total SLA (L1: 36h, L2: 48h)
  ROUTINE   = 'ROUTINE'    // 72h Total SLA (L1: 48h, L2: 72h)
}
```

---

## 2. Permitted State Transitions Matrix

| From State | To Target State | Permitted Roles | Required Payload & Conditions |
| :--- | :--- | :--- | :--- |
| `[*] (None)` | `SUBMITTED` | `CITIZEN` | `description` (min 5 chars), `citizenContact` |
| `SUBMITTED` | `TRIAGED` | `WARD_OFFICER`, `SUPERVISING_COMMISSIONER` | Verified `category`, `ward`, `urgency` |
| `SUBMITTED` | `REJECTED_INVALID` | `WARD_OFFICER`, `SUPERVISING_COMMISSIONER` | `rejectionReason` (min 5 chars) |
| `TRIAGED` / `ESCALATED_L1` | `ASSIGNED` | `WARD_OFFICER`, `SUPERVISING_COMMISSIONER` | Valid `assignedEngineerId` |
| `ASSIGNED` / `ESCALATED_L1/L2` | `IN_PROGRESS` | `FIELD_ENGINEER`, `SUPERVISING_COMMISSIONER` | Engineer acknowledgment |
| `IN_PROGRESS` | `INSPECTION_PENDING` | `FIELD_ENGINEER` | `workNotes` (field resolution proof) |
| `INSPECTION_PENDING` / `ESCALATED_L2` | `RESOLVED` | `WARD_OFFICER`, `SUPERVISING_COMMISSIONER` | `inspectionNotes` (officer sign-off) |
| `RESOLVED` | `CITIZEN_CONFIRMED` | `CITIZEN` | Citizen satisfaction confirmation |
| `RESOLVED` | `REOPENED` | `CITIZEN` | `reopenReason` logged within 48h window |
| `REOPENED` | `TRIAGED` | `WARD_OFFICER`, `SUPERVISING_COMMISSIONER` | Re-assessment notes |
| *Active State* | `ESCALATED_L1` | `SYSTEM_DAEMON`, `SUPERVISING_COMMISSIONER` | Time elapsed exceeds Tier-1 deadline |
| *Active State* | `ESCALATED_L2` | `SYSTEM_DAEMON`, `SUPERVISING_COMMISSIONER` | Time elapsed exceeds Tier-2 deadline |

---

## 3. Explicit Refusal Codes & Error Semantics

When an unauthorized or invalid state transition is requested, the HTTP API returns `400 Bad Request` with an immutable refusal payload logged to the cryptographic audit trail:

```json
{
  "success": false,
  "refused": true,
  "code": "ERR_ILLEGAL_STATE_JUMP",
  "reason": "Direct transition from 'SUBMITTED' to 'RESOLVED' is prohibited by municipal governance policy. Skipped steps are refused.",
  "auditHash": "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
}
```

### Refusal Code Directory:
- **`ERR_ROLE_UNAUTHORIZED`**: The actor role does not possess authority for this transition.
- **`ERR_ILLEGAL_STATE_JUMP`**: Skipped transition attempted (e.g. bypassing Triage or Assignment).
- **`ERR_MISSING_EVIDENCE`**: Marking `INSPECTION_PENDING` without field work completion notes.
- **`ERR_INSPECTION_REQUIRED`**: Marking `RESOLVED` without on-site officer inspection sign-off.
- **`ERR_MISSING_JUSTIFICATION`**: Rejecting a grievance without mandatory recorded justification.
- **`ERR_UNKNOWN_STATE`**: Target state is not part of the municipal workflow catalog.

---

## 4. REST API Schema Specification

### 4.1 List Grievances
- **Endpoint**: `GET /api/grievances`
- **Response**:
```json
{
  "currentTime": "2026-10-11T12:00:00.000Z",
  "virtualOffsetHours": "0.0",
  "totalTickets": 5,
  "grievances": [
    {
      "id": "PUN-2026-081",
      "title": "Severe pothole cluster near Baner High Street",
      "status": "ASSIGNED",
      "ward": "Baner - Balewadi",
      "category": "Roads & Potholes",
      "urgency": "HIGH",
      "slaMetrics": {
        "remainingHours": 10.0,
        "isL1Breached": false,
        "isL2Breached": false,
        "isOverdue": false,
        "statusBadge": "ON_TRACK"
      }
    }
  ]
}
```

### 4.2 Submit Grievance
- **Endpoint**: `POST /api/grievances`
- **Request Body**:
```json
{
  "citizenName": "Rahul Deshmukh",
  "citizenContact": "+91 98220 12345",
  "location": "Baner Road",
  "description": "बाणेर रोडवर काल रात्रीपासून पिण्याच्या पाण्याची पाईपलाईन फुटली आहे."
}
```

### 4.3 Execute Transition
- **Endpoint**: `POST /api/grievances/:id/transition`
- **Request Body**:
```json
{
  "targetState": "TRIAGED",
  "actor": "OFFICER_DESHMUKH",
  "role": "WARD_OFFICER",
  "payload": {
    "category": "Water Supply & Contamination",
    "ward": "Baner - Balewadi",
    "urgency": "HIGH"
  }
}
```

### 4.4 Simulation Time-Travel
- **Endpoint**: `POST /api/simulation/time-travel`
- **Request Body**: `{ "hours": 24 }` or `{ "reset": true }`
- **Response**: Returns new virtual simulation time and list of auto-escalated tickets.

### 4.5 Verify Cryptographic Audit Ledger
- **Endpoint**: `GET /api/audit`
- **Response**: `{ "verification": { "valid": true, "totalBlocks": 12 }, "ledger": [...] }`
