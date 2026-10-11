import express from 'express';
import cors from 'cors';
import path from 'path';
import { fileURLToPath } from 'url';

import { AuditLedger } from './src/engine/auditLedger.js';
import { WorkflowFSM, STATES, ROLES } from './src/engine/fsm.js';
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

// Seed initial audit events for sample records
grievances.forEach((g) => {
  auditLedger.logEvent({
    eventType: 'TICKET_SEEDED',
    actor: 'MUNICIPAL_SYSTEM',
    role: ROLES.SYSTEM_DAEMON,
    grievanceId: g.id,
    details: {
      initialStatus: g.status,
      category: g.category,
      urgency: g.urgency,
      ward: g.ward,
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
 * GET /api/grievances
 * List all tickets enriched with current dynamic SLA calculations
 */
app.get('/api/grievances', (req, res) => {
  // Re-evaluate any pending escalations before returning
  slaManager.evaluateAndApplyEscalations(grievances, auditLedger);

  const enriched = grievances.map((ticket) => {
    const slaMetrics = slaManager.getTicketSLAStatus(ticket);
    return {
      ...ticket,
      slaMetrics,
    };
  });

  res.json({
    currentTime: slaManager.getCurrentTime().toISOString(),
    virtualOffsetHours: (slaManager.virtualTimeOffsetMs / (3600 * 1000)).toFixed(1),
    totalTickets: enriched.length,
    grievances: enriched,
  });
});

/**
 * GET /api/grievances/:id
 * Retrieve specific ticket and its cryptographic audit trail
 */
app.get('/api/grievances/:id', (req, res) => {
  const ticket = grievances.find((g) => g.id === req.params.id);
  if (!ticket) {
    return res.status(404).json({ error: 'Grievance not found' });
  }

  const slaMetrics = slaManager.getTicketSLAStatus(ticket);
  const auditHistory = auditLedger.getGrievanceHistory(ticket.id);

  res.json({
    ticket: { ...ticket, slaMetrics },
    auditHistory,
  });
});

/**
 * POST /api/grievances
 * Citizen submits new grievance. Automatically calls AI Copilot.
 */
app.post('/api/grievances', async (req, res) => {
  const { title, description, citizenName, citizenContact, location } = req.body;

  if (!description || description.trim().length < 5) {
    return res.status(400).json({ error: 'Description is required (minimum 5 characters).' });
  }

  const newId = `PUN-2026-${String(grievances.length + 86).padStart(3, '0')}`;
  const now = slaManager.getCurrentTime();

  // 1. Run AI Copilot Analysis (Marathi/Hindi/English extraction + duplicate check)
  const aiAnalysis = await aiCopilot.analyzeGrievance(description, grievances);
  const urgency = aiAnalysis.extracted.urgency || 'STANDARD';
  const category = aiAnalysis.extracted.category || 'Roads & Potholes';
  const ward = aiAnalysis.extracted.ward || 'Baner - Balewadi';

  // 2. Compute dynamic SLA deadlines
  const sla = slaManager.calculateDeadlines(now.toISOString(), urgency);

  const newTicket = {
    id: newId,
    title: title || aiAnalysis.extracted.summary || description.slice(0, 50),
    description,
    citizenName: citizenName || 'Anonymous Citizen',
    citizenContact: citizenContact || 'N/A',
    location: location || aiAnalysis.extracted.location || 'Pune',
    category,
    urgency,
    ward,
    status: STATES.SUBMITTED,
    assignedEngineerId: null,
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
    eventType: 'GRIEVANCE_SUBMITTED',
    actor: newTicket.citizenName,
    role: ROLES.CITIZEN,
    grievanceId: newTicket.id,
    details: {
      category: newTicket.category,
      urgency: newTicket.urgency,
      ward: newTicket.ward,
      aiTriageSummary: aiAnalysis.extracted.summary,
    },
  });

  res.status(201).json({
    success: true,
    message: 'Grievance submitted and cryptographically recorded.',
    ticket: newTicket,
  });
});

/**
 * POST /api/grievances/:id/transition
 * Attempts a state transition enforced by FSM and Role Guard.
 */
app.post('/api/grievances/:id/transition', (req, res) => {
  const { targetState, actor, role, payload } = req.body;
  const ticket = grievances.find((g) => g.id === req.params.id);

  if (!ticket) {
    return res.status(404).json({ error: 'Grievance not found' });
  }

  // Enforce FSM transition rules
  const result = WorkflowFSM.attemptTransition(ticket, targetState, actor, role, payload);

  if (!result.success) {
    // REFUSAL RULE: Refused attempts must be visibly logged on the audit ledger
    const refusalAudit = auditLedger.logEvent({
      eventType: 'TRANSITION_REFUSED',
      actor,
      role,
      grievanceId: ticket.id,
      isRefusal: true,
      details: {
        currentState: ticket.status,
        attemptedTargetState: targetState,
        refusalCode: result.code,
        refusalReason: result.reason,
      },
    });

    return res.status(400).json({
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

  if (payload?.assignedEngineerId) ticket.assignedEngineerId = payload.assignedEngineerId;
  if (payload?.workNotes) ticket.workNotes = payload.workNotes;
  if (payload?.inspectionNotes) ticket.inspectionNotes = payload.inspectionNotes;
  if (payload?.category) ticket.category = payload.category;
  if (payload?.ward) ticket.ward = payload.ward;
  if (payload?.urgency) {
    ticket.urgency = payload.urgency;
    ticket.sla = slaManager.calculateDeadlines(ticket.createdAt, payload.urgency);
  }

  // Record accepted transition
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

  res.json({
    success: true,
    ticket,
    auditHash: acceptedAudit.hash,
  });
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
 * Returns full audit chain and verifies mathematical hash integrity
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
  console.log(`   - FSM Engine: Active (Strict Role & Refusal Guards)`);
  console.log(`   - SLA Engine: Active (Virtual Time-Travel Support)`);
  console.log(`   - Audit Ledger: Cryptographically Chained (SHA-256)`);
  console.log(`   - AI Copilot: Connected to ${aiCopilot.routerBaseUrl}`);
  console.log(`=============================================================`);
});
