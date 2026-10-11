import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { AuditLedger } from './src/engine/auditLedger.js';
import { WorkflowFSM, STATES, ROLES, normalizeRole } from './src/engine/fsm.js';
import { SLAManager } from './src/engine/sla.js';
import { AICopilotService } from './src/services/aiCopilot.js';
import { EvidenceLab } from './src/engine/evidenceLab.js';
import { RecurrenceRadar } from './src/engine/recurrenceRadar.js';
import { SEED_GRIEVANCES } from './src/data/seedData.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());
app.use((err, req, res, next) => {
  if (err instanceof SyntaxError && err.status === 400 && 'body' in err) {
    return res.status(400).json({
      error: 'Malformed JSON payload',
      code: 'ERR_MALFORMED_JSON',
      message: err.message,
    });
  }
  next();
});
app.use(express.static(path.join(__dirname, 'public')));

// Core Engine Instances
const auditLedger = new AuditLedger();
const slaManager = new SLAManager();
const aiCopilot = new AICopilotService();
const evidenceLab = new EvidenceLab();
const recurrenceRadar = new RecurrenceRadar();

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
 * Specific Table 5 API Endpoints (Section 9.2 in Official Spec)
 */

// 0. User Authentication (Section 9.2 Table 5: POST /auth/login)
const handleAuthLogin = (req, res) => {
  const { email, username, role } = req.body || {};
  const userRole = normalizeRole(role || (email && email.includes('admin') ? ROLES.ADMINISTRATOR : email && email.includes('hod') ? ROLES.SUPERVISOR : email && email.includes('tech') ? ROLES.OFFICER : ROLES.REQUESTER));
  const user = {
    id: `USR-${Math.floor(1000 + Math.random() * 9000)}`,
    name: username || (email ? email.split('@')[0].replace('.', ' ') : 'Campus User'),
    email: email || `${username || 'user'}@dypit.edu.in`,
    role: userRole,
    departmentId: 'DEPT-CAMPUS-MAINTENANCE',
    token: `govfix-jwt-${Buffer.from(email || username || 'user').toString('base64')}`,
  };
  return res.json({
    success: true,
    token: user.token,
    sessionToken: user.token,
    role: userRole,
    user,
  });
};
app.post('/api/auth/login', handleAuthLogin);
app.post('/auth/login', handleAuthLogin);

// 1. Assign Officer / Technician (Section 9.2 Table 5: POST /requests/{id}/assign)
const handleAssignOfficer = (req, res) => {
  const { officerId, actor, role } = req.body;
  processTransition(req, res, STATES.ASSIGNED, actor || 'SUPERVISOR', role || ROLES.SUPERVISOR, {
    assignedOfficerId: officerId,
    assignedEngineerId: officerId,
  });
};
app.post('/api/requests/:id/assign', handleAssignOfficer);
app.post('/requests/:id/assign', handleAssignOfficer);

// 2. Officer Accept or Reject Assignment Decision (Section 9.2 Table 5: POST /assignments/{id}/decision)
const handleAssignmentDecision = (req, res) => {
  const { decision, reason, actor } = req.body; // decision: 'ACCEPT' or 'REJECT'
  const targetState = decision === 'ACCEPT' ? STATES.ACCEPTED : STATES.TRIAGED;
  processTransition(req, res, targetState, actor || 'OFFICER', ROLES.OFFICER, {
    rejectionReason: reason,
  });
};
app.post('/api/assignments/:id/decision', handleAssignmentDecision);
app.post('/assignments/:id/decision', handleAssignmentDecision);

// 3. Record Action (Section 9.2 Table 5: POST /requests/{id}/actions)
const handleRecordAction = (req, res) => {
  const { actionType, notes, evidenceAttachmentId, evidence, actor, role } = req.body;
  const ticket = grievances.find((g) => g.id === req.params.id);
  if (!ticket) return res.status(404).json({ success: false, error: 'Request not found' });

  if (!ticket.actions) ticket.actions = [];
  const actionRecord = {
    id: `ACT-${Date.now()}`,
    actionType: actionType || 'FIELD_INSPECTION_REPAIR',
    notes: notes || 'Technician diagnostic examination & repair work performed.',
    evidenceAttachmentId: evidenceAttachmentId || (evidence ? evidence.sha256Checksum : null),
    actor: actor || ticket.assignedEngineerId || 'TECH_OFFICER',
    role: role || ROLES.OFFICER,
    performedAt: slaManager.getCurrentTime().toISOString(),
  };
  ticket.actions.push(actionRecord);
  ticket.updatedAt = actionRecord.performedAt;

  const auditBlock = auditLedger.logEvent({
    eventType: 'ACTION_RECORDED',
    actor: actionRecord.actor,
    role: actionRecord.role,
    grievanceId: ticket.id,
    details: actionRecord,
  });

  return res.json({ success: true, action: actionRecord, ticket, auditBlock });
};
app.post('/api/requests/:id/actions', handleRecordAction);
app.post('/requests/:id/actions', handleRecordAction);

// 4. Propose Closure & Evidence Attachment (Section 9.2 Table 5: POST /requests/{id}/closure-proposal)
const handleClosureProposal = (req, res) => {
  const { workNotes, evidence, evidenceAttachment, actor } = req.body;
  const attachment = evidenceAttachment || evidence;
  const notes = workNotes || (attachment && attachment.notes) || (typeof evidence === 'string' ? evidence : 'Physical repair verified & completed');
  processTransition(req, res, STATES.READY_FOR_CLOSURE, actor || 'OFFICER', ROLES.OFFICER, {
    workNotes: notes,
    evidenceAttachment: attachment,
    evidence: attachment,
  });
};
app.post('/api/requests/:id/closure-proposal', handleClosureProposal);
app.post('/requests/:id/closure-proposal', handleClosureProposal);

// Evidence upload endpoint
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
app.post('/requests/:id/evidence', (req, res) => {
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

// 5. Closure Decision (Approve / Reject) (Section 9.2 Table 5: POST /closures/{id}/decision)
const handleClosureDecision = (req, res) => {
  const { approved, rating, actor, role } = req.body;
  const targetState = approved ? STATES.CLOSED : STATES.IN_PROGRESS;
  processTransition(req, res, targetState, actor || 'SUPERVISOR', role || ROLES.SUPERVISOR, {
    rating,
  });
};
app.post('/api/closures/:id/decision', handleClosureDecision);
app.post('/closures/:id/decision', handleClosureDecision);

// 6. Reopen Request (Section 9.2 Table 5: POST /requests/{id}/reopen)
const handleReopenRequest = (req, res) => {
  const { reason, actor } = req.body;
  processTransition(req, res, STATES.REOPENED, actor || 'REQUESTER', ROLES.REQUESTER, {
    reopenReason: reason,
  });
};
app.post('/api/requests/:id/reopen', handleReopenRequest);
app.post('/requests/:id/reopen', handleReopenRequest);

// 7. Oversight Overdue Dashboard (Section 9.2 Table 5: GET /oversight/overdue)
const handleOversightOverdue = (req, res) => {
  const overdue = grievances.filter((t) => {
    const sla = slaManager.getTicketSLAStatus(t);
    return sla.isOverdue || t.status === STATES.ESCALATED_L1 || t.status === STATES.ESCALATED_L2 || t.isEscalated;
  });
  res.json({ totalOverdue: overdue.length, overdue });
};
app.get('/api/oversight/overdue', handleOversightOverdue);
app.get('/oversight/overdue', handleOversightOverdue);

// 8. Oversight Recurrences Dashboard (Section 9.2 Table 5: GET /oversight/recurrences)
const handleOversightRecurrences = (req, res) => {
  const roomCounts = {};
  grievances.forEach((t) => {
    const r = t.roomId || t.ward;
    roomCounts[r] = (roomCounts[r] || 0) + 1;
  });
  const candidates = Object.entries(roomCounts)
    .filter(([_, count]) => count > 1)
    .map(([roomId, count]) => ({ roomId, count }));

  res.json({ candidates });
};
app.get('/api/oversight/recurrences', handleOversightRecurrences);
app.get('/oversight/recurrences', handleOversightRecurrences);

// 9. AI Suggest (Section 9.2 Table 5: POST /ai/suggest)
const handleAiSuggest = async (req, res) => {
  const { text } = req.body;
  const analysis = await aiCopilot.analyzeGrievance(text || '', grievances);
  res.json(analysis);
};
app.post('/api/ai/suggest', handleAiSuggest);
app.post('/ai/suggest', handleAiSuggest);

// Direct Table 5 aliases for GET /requests, POST /requests, GET /requests/:id, PATCH /requests/:id/status
app.get('/requests', handleGetRequests);
app.post('/requests', handleCreateRequest);
app.get('/requests/:id', handleGetRequestById);
app.patch('/requests/:id/status', (req, res) => {
  const { targetState, actor, role, payload } = req.body;
  processTransition(req, res, targetState, actor, role, payload);
});
app.post('/requests/:id/status', (req, res) => {
  const { targetState, actor, role, payload } = req.body;
  processTransition(req, res, targetState, actor, role, payload);
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
 * GET /api/audit or GET /audit
 * Returns full audit chain and verifies mathematical SHA-256 hash integrity
 */
const handleAuditVerification = (req, res) => {
  const verification = auditLedger.verifyIntegrity();
  res.json({
    verification,
    chainLength: auditLedger.chain.length,
    ledger: auditLedger.chain.slice().reverse(), // Latest first
  });
};
app.get('/api/audit', handleAuditVerification);
app.get('/audit', handleAuditVerification);

/**
 * Enterprise Telemetry & Health Endpoints (Section 08 Architecture Standard)
 * Explicitly distinguishes application health from optional AI-service availability
 */
const handleHealthCheck = async (req, res) => {
  const auditStatus = auditLedger.verifyIntegrity();
  let aiStatus = 'OFFLINE_FALLBACK_ACTIVE';
  try {
    const aiProbe = await fetch(`${aiCopilot.routerBaseUrl}/models`, {
      signal: AbortSignal.timeout(500),
    });
    if (aiProbe.ok) aiStatus = 'ONLINE';
  } catch {
    aiStatus = 'OFFLINE_FALLBACK_ACTIVE';
  }

  res.json({
    status: 'healthy',
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: slaManager.getCurrentTime().toISOString(),
    institution: 'Dr. D. Y. Patil Institute of Technology',
    track: 'University Service Requests',
    version: '1.2.0',
    fsmEngine: 'ACTIVE',
    slaEngine: 'ACTIVE',
    activePolicyVersion: slaManager.activePolicyVersion,
    auditLedger: {
      chainLength: auditLedger.chain.length,
      isValid: auditStatus.isValid,
      latestHash: auditStatus.latestHash,
    },
    aiService: {
      status: aiStatus,
      routerUrl: aiCopilot.routerBaseUrl,
      advisoryMode: 'NON_BINDING',
      note: 'Core deterministic workflow operates 100% autonomously without external AI dependence.',
    },
    activeTickets: grievances.length,
    memoryUsageMB: (process.memoryUsage().rss / (1024 * 1024)).toFixed(1),
  });
};
app.get('/health', handleHealthCheck);
app.get('/api/health', handleHealthCheck);

const handleMetrics = (req, res) => {
  const statusCounts = {};
  grievances.forEach((g) => {
    statusCounts[g.status] = (statusCounts[g.status] || 0) + 1;
  });
  const auditMetrics = auditLedger.verifyIntegrity();

  res.json({
    totalTickets: grievances.length,
    statusBreakdown: statusCounts,
    activePolicyVersion: slaManager.activePolicyVersion,
    auditChainLength: auditLedger.chain.length,
    auditChainValid: auditMetrics.isValid,
    virtualTimeOffsetHours: Number((slaManager.virtualTimeOffsetMs / 3600000).toFixed(1)),
    totalEscalations: grievances.filter((g) => g.isEscalated || g.status.startsWith('ESCALATED')).length,
  });
};
app.get('/metrics', handleMetrics);
app.get('/api/metrics', handleMetrics);

/**
 * FEATURE 1: WORKFLOW POLICY SANDBOX ENDPOINTS
 */
app.get('/api/sandbox/policy', (req, res) => {
  res.json(slaManager.getActivePolicy());
});
app.get('/sandbox/policy', (req, res) => {
  res.json(slaManager.getActivePolicy());
});

app.post('/api/sandbox/simulate', (req, res) => {
  const { proposedPolicies, customTime } = req.body || {};
  if (!proposedPolicies) {
    return res.status(400).json({ success: false, code: 'ERR_MISSING_PROPOSED_POLICY', error: 'Proposed policy configuration required.' });
  }
  const result = slaManager.simulatePolicy(proposedPolicies, grievances, customTime);
  if (!result.success) {
    return res.status(422).json(result);
  }
  res.json(result);
});
app.post('/sandbox/simulate', (req, res) => {
  const { proposedPolicies, customTime } = req.body || {};
  if (!proposedPolicies) {
    return res.status(400).json({ success: false, code: 'ERR_MISSING_PROPOSED_POLICY', error: 'Proposed policy configuration required.' });
  }
  const result = slaManager.simulatePolicy(proposedPolicies, grievances, customTime);
  if (!result.success) {
    return res.status(422).json(result);
  }
  res.json(result);
});

app.post('/api/sandbox/activate', (req, res) => {
  const { proposedPolicies, actor, role } = req.body || {};
  const normalized = normalizeRole(role || ROLES.ADMINISTRATOR);
  if (![ROLES.ADMINISTRATOR, ROLES.SUPERVISOR].includes(normalized)) {
    return res.status(403).json({
      success: false,
      code: 'ERR_ROLE_UNAUTHORIZED',
      error: 'Only Campus Supervisors or Administrators are authorized to activate workflow policies.',
    });
  }

  const activation = slaManager.activatePolicy(proposedPolicies, actor || 'ADMIN_USER', normalized, auditLedger);
  if (!activation.success) {
    return res.status(422).json(activation);
  }
  res.json(activation);
});
app.post('/sandbox/activate', (req, res) => {
  const { proposedPolicies, actor, role } = req.body || {};
  const normalized = normalizeRole(role || ROLES.ADMINISTRATOR);
  if (![ROLES.ADMINISTRATOR, ROLES.SUPERVISOR].includes(normalized)) {
    return res.status(403).json({
      success: false,
      code: 'ERR_ROLE_UNAUTHORIZED',
      error: 'Only Campus Supervisors or Administrators are authorized to activate workflow policies.',
    });
  }

  const activation = slaManager.activatePolicy(proposedPolicies, actor || 'ADMIN_USER', normalized, auditLedger);
  if (!activation.success) {
    return res.status(422).json(activation);
  }
  res.json(activation);
});

/**
 * FEATURE 2: EVIDENCE INTEGRITY LAB ENDPOINTS
 */
app.get('/api/evidence', (req, res) => {
  res.json({ evidenceCount: evidenceLab.registry.size, evidence: evidenceLab.listEvidence() });
});
app.get('/evidence', (req, res) => {
  res.json({ evidenceCount: evidenceLab.registry.size, evidence: evidenceLab.listEvidence() });
});

app.post('/api/evidence/verify', (req, res) => {
  const { evidenceId, fileContentBase64, fileContentText } = req.body || {};
  let candidateBuffer = null;
  if (fileContentBase64) {
    candidateBuffer = Buffer.from(fileContentBase64, 'base64');
  } else if (fileContentText) {
    candidateBuffer = Buffer.from(fileContentText, 'utf-8');
  } else {
    const rec = evidenceLab.registry.get(evidenceId);
    if (rec) candidateBuffer = rec.rawBuffer;
  }

  const result = evidenceLab.verifyEvidence(evidenceId, candidateBuffer);
  if (!result.success) {
    return res.status(result.code === 'ERR_EVIDENCE_NOT_FOUND' ? 404 : 422).json(result);
  }
  res.json(result);
});
app.post('/evidence/verify', (req, res) => {
  const { evidenceId, fileContentBase64, fileContentText } = req.body || {};
  let candidateBuffer = null;
  if (fileContentBase64) {
    candidateBuffer = Buffer.from(fileContentBase64, 'base64');
  } else if (fileContentText) {
    candidateBuffer = Buffer.from(fileContentText, 'utf-8');
  } else {
    const rec = evidenceLab.registry.get(evidenceId);
    if (rec) candidateBuffer = rec.rawBuffer;
  }

  const result = evidenceLab.verifyEvidence(evidenceId, candidateBuffer);
  if (!result.success) {
    return res.status(result.code === 'ERR_EVIDENCE_NOT_FOUND' ? 404 : 422).json(result);
  }
  res.json(result);
});

app.post('/api/evidence/demo-tamper-fixture', (req, res) => {
  const result = evidenceLab.runTamperDemonstration();
  res.json(result);
});
app.post('/evidence/demo-tamper-fixture', (req, res) => {
  const result = evidenceLab.runTamperDemonstration();
  res.json(result);
});

/**
 * FEATURE 3: RECURRING-FAILURE RADAR ENDPOINTS
 */
app.get('/api/radar/patterns', (req, res) => {
  const patterns = recurrenceRadar.detectClusters(grievances);
  res.json({ totalPatterns: patterns.length, patterns });
});
app.get('/radar/patterns', (req, res) => {
  const patterns = recurrenceRadar.detectClusters(grievances);
  res.json({ totalPatterns: patterns.length, patterns });
});

app.post('/api/radar/patterns/:clusterId/decision', (req, res) => {
  const { decision, reviewer, rationale } = req.body || {};
  const result = recurrenceRadar.reviewCluster(
    req.params.clusterId,
    decision,
    reviewer || 'SUPERVISOR',
    rationale,
    auditLedger
  );
  if (!result.success) {
    return res.status(422).json(result);
  }
  res.json(result);
});
app.post('/radar/patterns/:clusterId/decision', (req, res) => {
  const { decision, reviewer, rationale } = req.body || {};
  const result = recurrenceRadar.reviewCluster(
    req.params.clusterId,
    decision,
    reviewer || 'SUPERVISOR',
    rationale,
    auditLedger
  );
  if (!result.success) {
    return res.status(422).json(result);
  }
  res.json(result);
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
