import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { AuditLedger } from './src/engine/auditLedger.js';
import { WorkflowFSM, STATES, ROLES, normalizeRole } from './src/engine/fsm.js';
import { SLAManager } from './src/engine/sla.js';
import { AICopilotService } from './src/services/aiCopilot.js';
import { SEED_GRIEVANCES } from './src/data/seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Core Engine Instances
const auditLedger = new AuditLedger();
const slaManager = new SLAManager();
const aiCopilot = new AICopilotService();

// In-Memory Database initialized with seed records
let grievances = SEED_GRIEVANCES.map((item) => {
  const sla = slaManager.calculateDeadlines(item.createdAt, item.urgency);
  return {
    ...item,
    sla,
  };
});

// Seed initial audit events
grievances.forEach((g) => {
  auditLedger.logEvent({
    eventType: 'TICKET_SEEDED',
    actor: 'CAMPUS_ERP_GATEWAY',
    role: ROLES.SYSTEM_DAEMON,
    grievanceId: g.id,
    details: {
      initialStatus: g.status,
      category: g.category,
      urgency: g.urgency,
      roomId: g.roomId || g.ward,
      assetId: g.assetId,
    },
  });
});

// Periodic SLA Check (Runs every 30 seconds)
setInterval(() => {
  slaManager.evaluateAndApplyEscalations(grievances, auditLedger);
}, 30000);

// ==============================================================================
// REST API ENDPOINTS
// ==============================================================================

/**
 * GET /api/grievances or GET /api/requests
 * List all campus requests enriched with dynamic SLA calculations
 */
const handleGetRequests = (req, res) => {
  slaManager.evaluateAndApplyEscalations(grievances, auditLedger);

  const enriched = grievances.map((ticket) => {
    const slaMetrics = slaManager.getTicketSLAStatus(ticket);
    return {
      ...ticket,
      slaMetrics,
    };
  });

  res.json({
    institution: 'Dr. D. Y. Patil Institute of Technology (DY Patil Campus)',
    track: 'University Service Requests (Maintenance, IT Support & Campus Facilities)',
    currentTime: slaManager.getCurrentTime().toISOString(),
    virtualOffsetHours: (slaManager.virtualTimeOffsetMs / (3600 * 1000)).toFixed(1),
    totalTickets: enriched.length,
    grievances: enriched,
    requests: enriched,
  });
};

app.get('/api/grievances', handleGetRequests);
app.get('/api/requests', handleGetRequests);

/**
 * GET /api/grievances/:id or GET /api/requests/:id
 * Retrieve specific ticket and its cryptographic audit trail
 */
const handleGetRequestById = (req, res) => {
  const ticket = grievances.find((g) => g.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Request not found' });
  }

  const slaMetrics = slaManager.getTicketSLAStatus(ticket);
  const auditHistory = auditLedger.getGrievanceHistory(ticket.id);

  res.json({
    ticket: { ...ticket, slaMetrics },
    auditHistory,
  });
};

app.get('/api/grievances/:id', handleGetRequestById);
app.get('/api/requests/:id', handleGetRequestById);

/**
 * POST /api/grievances or POST /api/requests
 * Submit new service request with AI Copilot extraction
 */
const handleCreateRequest = async (req, res) => {
  const { title, description, citizenName, requesterName, citizenContact, requesterContact, location, roomId, assetId } = req.body;

  if (!description || description.trim().length < 5) {
    return res.status(422).json({ error: 'Description is required (minimum 5 characters).' });
  }

  const newId = `DYP-2026-${String(grievances.length + 106).padStart(3, '0')}`;
  const now = slaManager.getCurrentTime();

  // 1. Run AI Copilot Analysis
  const aiAnalysis = await aiCopilot.analyzeGrievance(description, grievances);
  const urgency = aiAnalysis.extracted.urgency || 'STANDARD';
  const category = aiAnalysis.extracted.category || 'Academic IT & Computing Systems';
  const detectedRoom = roomId || aiAnalysis.extracted.roomId || location || 'Central Campus';
  const detectedAsset = assetId || aiAnalysis.extracted.assetId || 'DYP-ASSET-01';

  // 2. Compute dynamic SLA deadlines
  const sla = slaManager.calculateDeadlines(now.toISOString(), urgency);

  const newTicket = {
    id: newId,
    title: title || aiAnalysis.extracted.summary || description.slice(0, 50),
    description,
    citizenName: requesterName || citizenName || 'Anonymous Student / Faculty',
    citizenContact: requesterContact || citizenContact || 'campus.user@dypit.edu.in',
    location: detectedRoom,
    roomId: detectedRoom,
    assetId: detectedAsset,
    category,
    urgency,
    ward: detectedRoom,
    status: STATES.SUBMITTED,
    assignedEngineerId: null,
    assignedOfficerId: null,
    createdAt: now.toISOString(),
    updatedAt: now.toISOString(),
    aiRecommendation: aiAnalysis.extracted,
    aiDuplicates: aiAnalysis.duplicates,
    aiDrafts: aiAnalysis.drafts,
    sla,
  };

  grievances.unshift(newTicket);

  // 3. Log into Cryptographic Audit Ledger
  auditLedger.logEvent({
    eventType: 'REQUEST_SUBMITTED',
    actor: newTicket.citizenName,
    role: ROLES.REQUESTER,
    grievanceId: newTicket.id,
    details: {
      category: newTicket.category,
      urgency: newTicket.urgency,
      roomId: newTicket.roomId,
      assetId: newTicket.assetId,
      aiTriageSummary: aiAnalysis.extracted.summary,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Campus service request submitted and cryptographically recorded.',
    ticket: newTicket,
    request: newTicket,
  });
};

app.post('/api/grievances', handleCreateRequest);
app.post('/api/requests', handleCreateRequest);

/**
 * Transition Core Handler
 */
function processTransition(req, res, targetState, actor, role, payload = {}) {
  const ticket = grievances.find((g) => g.id === req.params.id);

  if (!ticket) {
    return res.status(404).json({ error: 'Request record not found' });
  }

  // Enforce FSM transition rules
  const result = WorkflowFSM.attemptTransition(ticket, targetState, actor, role, payload);

  if (!result.success) {
    // REFUSAL RULE: Refused attempts must be visibly logged on the audit ledger
    const refusalAudit = auditLedger.logEvent({
      eventType: 'TRANSITION_REFUSED',
      actor: actor || 'UNKNOWN',
      role: role || 'UNKNOWN',
      grievanceId: ticket.id,
      isRefusal: true,
      details: {
        currentState: ticket.status,
        attemptedTargetState: targetState,
        refusalCode: result.code,
        refusalReason: result.reason,
      },
    });

    return res.status(result.httpStatus || 409).json({
      success: false,
      refused: true,
      code: result.code,
      reason: result.reason,
      auditHash: refusalAudit.hash,
    });
  }

  // Transition accepted: apply changes
  const previousState = ticket.status;
  ticket.status = targetState;
  ticket.updatedAt = slaManager.getCurrentTime().toISOString();

  if (payload?.assignedEngineerId) {
    ticket.assignedEngineerId = payload.assignedEngineerId;
    ticket.assignedOfficerId = payload.assignedEngineerId;
  }
  if (payload?.assignedOfficerId) {
    ticket.assignedEngineerId = payload.assignedOfficerId;
    ticket.assignedOfficerId = payload.assignedOfficerId;
  }
  if (payload?.workNotes) ticket.workNotes = payload.workNotes;
  if (payload?.inspectionNotes) ticket.inspectionNotes = payload.inspectionNotes;
  if (payload?.evidenceAttachment) ticket.evidenceAttachment = payload.evidenceAttachment;
  if (payload?.evidence) ticket.evidenceAttachment = payload.evidence;
  if (payload?.category) ticket.category = payload.category;
  if (payload?.urgency) {
    ticket.urgency = payload.urgency;
    ticket.sla = slaManager.calculateDeadlines(ticket.createdAt, payload.urgency);
  }

  // Record accepted transition in SHA-256 Ledger
  const acceptedAudit = auditLedger.logEvent({
    eventType: 'STATE_TRANSITION_ACCEPTED',
    actor,
    role,
    grievanceId: ticket.id,
    details: {
      fromState: previousState,
      toState: targetState,
      payload,
    },
  });

  return res.json({
    success: true,
    ticket,
    auditHash: acceptedAudit.hash,
  });
}

/**
 * POST /api/grievances/:id/transition or PATCH /api/requests/:id/status
 */
app.post('/api/grievances/:id/transition', (req, res) => {
  const { targetState, actor, role, payload } = req.body;
  processTransition(req, res, targetState, actor, role, payload);
});

app.patch('/api/requests/:id/status', (req, res) => {
  const { targetState, actor, role, payload } = req.body;
  processTransition(req, res, targetState, actor, role, payload);
});

/**
 * Specific Table 5 API Endpoints (Section 9.2 in PDF)
 */
// 1. Assign Officer / Technician
app.post('/api/requests/:id/assign', (req, res) => {
  const { officerId, actor, role } = req.body;
  processTransition(req, res, STATES.ASSIGNED, actor || 'SUPERVISOR', role || ROLES.SUPERVISOR, {
    assignedOfficerId: officerId,
    assignedEngineerId: officerId,
  });
});

// 2. Officer Accept or Reject Assignment Decision
app.post('/api/assignments/:id/decision', (req, res) => {
  const { decision, reason, actor } = req.body; // decision: 'ACCEPT' or 'REJECT'
  const targetState = decision === 'ACCEPT' ? STATES.ACCEPTED : STATES.TRIAGED;
  processTransition(req, res, targetState, actor || 'OFFICER', ROLES.OFFICER, {
    rejectionReason: reason,
  });
});

// 3. Propose Closure & Evidence Attachment
app.post('/api/requests/:id/closure-proposal', (req, res) => {
  const { workNotes, evidence, evidenceAttachment, actor } = req.body;
  const attachment = evidenceAttachment || evidence;
  const notes = workNotes || (attachment && attachment.notes) || (typeof evidence === 'string' ? evidence : 'Physical repair verified & completed');
  processTransition(req, res, STATES.READY_FOR_CLOSURE, actor || 'OFFICER', ROLES.OFFICER, {
    workNotes: notes,
    evidenceAttachment: attachment,
    evidence: attachment,
  });
});

app.post('/api/requests/:id/evidence', (req, res) => {
  const { evidence, evidenceAttachment, workNotes, actor } = req.body;
  const attachment = evidenceAttachment || evidence;
  const ticket = grievances.find((g) => g.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Request not found' });
  ticket.evidenceAttachment = attachment;
  if (workNotes) ticket.workNotes = workNotes;
  ticket.updatedAt = slaManager.getCurrentTime().toISOString();
  auditLedger.logEvent({
    eventType: 'EVIDENCE_ATTACHED',
    actor: actor || 'TECH_OFFICER',
    role: ROLES.OFFICER,
    grievanceId: ticket.id,
    details: { attachment, workNotes },
  });
  return res.json({ success: true, ticket });
});


// 4. Closure Decision (Approve / Reject)
app.post('/api/closures/:id/decision', (req, res) => {
  const { approved, rating, actor, role } = req.body;
  const targetState = approved ? STATES.CLOSED : STATES.IN_PROGRESS;
  processTransition(req, res, targetState, actor || 'SUPERVISOR', role || ROLES.SUPERVISOR, {
    rating,
  });
});

// 5. Reopen Request
app.post('/api/requests/:id/reopen', (req, res) => {
  const { reason, actor } = req.body;
  processTransition(req, res, STATES.REOPENED, actor || 'REQUESTER', ROLES.REQUESTER, {
    reopenReason: reason,
  });
});

// 6. Oversight Overdue Dashboard
app.get('/api/oversight/overdue', (req, res) => {
  const overdue = grievances.filter((t) => {
    const sla = slaManager.getTicketSLAStatus(t);
    return sla.isOverdue || t.status === STATES.ESCALATED_L1 || t.status === STATES.ESCALATED_L2;
  });
  res.json({ totalOverdue: overdue.length, overdue });
});

// 7. Oversight Recurrences Dashboard
app.get('/api/oversight/recurrences', (req, res) => {
  const roomCounts = {};
  grievances.forEach((t) => {
    const r = t.roomId || t.ward;
    roomCounts[r] = (roomCounts[r] || 0) + 1;
  });
  const candidates = Object.entries(roomCounts)
    .filter(([_, count]) => count > 1)
    .map(([roomId, count]) => ({ roomId, count }));

  res.json({ candidates });
});

// 8. AI Suggest (Non-authoritative sidecar)
app.post('/api/ai/suggest', async (req, res) => {
  const { text } = req.body;
  const analysis = await aiCopilot.analyzeGrievance(text || '', grievances);
  res.json(analysis);
});

/**
 * POST /api/simulation/time-travel
 * Fast forward virtual time by +N hours for judge SLA testing
 */
app.post('/api/simulation/time-travel', (req, res) => {
  const { hours, reset } = req.body;

  let newTime;
  if (reset) {
    newTime = slaManager.resetTime();
  } else {
    newTime = slaManager.advanceTime(Number(hours) || 12);
  }

  // Trigger immediate SLA auto-escalation evaluation
  const escalations = slaManager.evaluateAndApplyEscalations(grievances, auditLedger);

  res.json({
    currentTime: newTime.toISOString(),
    virtualOffsetHours: (slaManager.virtualTimeOffsetMs / (3600 * 1000)).toFixed(1),
    escalationsTriggered: escalations,
  });
});

/**
 * GET /api/audit
 * Returns full audit chain and verifies mathematical SHA-256 hash integrity
 */
app.get('/api/audit', (req, res) => {
  const verification = auditLedger.verifyIntegrity();
  res.json({
    verification,
    chainLength: auditLedger.chain.length,
    ledger: auditLedger.chain.slice().reverse(), // Latest first
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`=============================================================`);
  console.log(`🏛️ GovFix Server Running at: http://localhost:${PORT}`);
  console.log(`   - Track: University Service Requests (DY Patil Campus)`);
  console.log(`   - FSM Engine: Active (Strict HTTP 409/403/422 Refusal Guards)`);
  console.log(`   - SLA Engine: Active (Virtual Time-Travel Support)`);
  console.log(`   - Audit Ledger: Cryptographically Chained (SHA-256)`);
  console.log(`   - AI Copilot: Connected to ${aiCopilot.routerBaseUrl}`);
  console.log(`=============================================================`);
});
