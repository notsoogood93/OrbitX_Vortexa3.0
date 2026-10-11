import { STATES, ROLES, WorkflowFSM } from './fsm.js';

export const SLA_POLICIES = {
  EMERGENCY: {
    label: 'Emergency / Hazard',
    totalSlaHours: 12,
    l1BreachHours: 6,
    l2BreachHours: 12,
  },
  HIGH: {
    label: 'High Priority',
    totalSlaHours: 24,
    l1BreachHours: 12,
    l2BreachHours: 24,
  },
  STANDARD: {
    label: 'Standard Priority',
    totalSlaHours: 48,
    l1BreachHours: 36,
    l2BreachHours: 48,
  },
  ROUTINE: {
    label: 'Routine / Non-Urgent',
    totalSlaHours: 72,
    l1BreachHours: 48,
    l2BreachHours: 72,
  },
};

export class SLAManager {
  constructor() {
    this.virtualTimeOffsetMs = 0; // Fast-forward time offset for live demos
    this.activePolicyVersion = 'POL-v1.0';
    this.activePolicies = JSON.parse(JSON.stringify(SLA_POLICIES));
    this.policyHistory = [
      {
        version: 'POL-v1.0',
        activatedAt: new Date().toISOString(),
        activatedBy: 'SYSTEM_INIT',
        policies: JSON.parse(JSON.stringify(SLA_POLICIES)),
      },
    ];
  }

  /**
   * Returns current active policy and version identifier
   */
  getActivePolicy() {
    return {
      version: this.activePolicyVersion,
      policies: JSON.parse(JSON.stringify(this.activePolicies)),
      historyCount: this.policyHistory.length,
      history: this.policyHistory.map((h) => ({
        version: h.version,
        activatedAt: h.activatedAt,
        activatedBy: h.activatedBy,
      })),
    };
  }

  /**
   * Validates proposed policy structure and invariant bounds
   */
  validatePolicy(policies) {
    if (!policies || typeof policies !== 'object') {
      return { valid: false, code: 'ERR_INVALID_POLICY', error: 'Policy configuration must be a valid JSON object.' };
    }
    const requiredTiers = ['EMERGENCY', 'HIGH', 'STANDARD', 'ROUTINE'];
    for (const tier of requiredTiers) {
      const p = policies[tier];
      if (!p) {
        return { valid: false, code: 'ERR_MISSING_POLICY_TIER', error: `Policy tier '${tier}' is required.` };
      }
      const l1 = Number(p.l1BreachHours);
      const l2 = Number(p.l2BreachHours);
      const total = Number(p.totalSlaHours);

      if (isNaN(l1) || isNaN(l2) || isNaN(total) || l1 <= 0 || l2 <= 0 || total <= 0) {
        return { valid: false, code: 'ERR_NON_POSITIVE_HOURS', error: `All thresholds for '${tier}' must be positive numbers.` };
      }
      if (l1 >= l2) {
        return { valid: false, code: 'ERR_CONTRADICTORY_POLICY', error: `For '${tier}', Tier-1 breach hours (${l1}) must be strictly less than Tier-2 breach hours (${l2}).` };
      }
      if (l2 > total) {
        return { valid: false, code: 'ERR_CONTRADICTORY_POLICY', error: `For '${tier}', Tier-2 breach hours (${l2}) cannot exceed total SLA hours (${total}).` };
      }
    }
    return { valid: true };
  }

  /**
   * PURE DRY-RUN SIMULATION (CRITICAL ISOLATION REQUIREMENT)
   * Evaluates proposed policy against ticket snapshots without mutating ANY live ticket fields!
   */
  simulatePolicy(proposedPolicies, candidateTickets = [], customTime = null) {
    const validation = this.validatePolicy(proposedPolicies);
    if (!validation.valid) {
      return { success: false, ...validation };
    }

    const evalTime = customTime ? new Date(customTime) : this.getCurrentTime();
    const results = [];
    let affectedCount = 0;
    let earlierOverdueCount = 0;
    let laterOverdueCount = 0;

    for (const ticket of candidateTickets) {
      const urgency = ticket.urgency || 'STANDARD';
      const currentPolicy = this.activePolicies[urgency] || SLA_POLICIES[urgency] || SLA_POLICIES.STANDARD;
      const proposedPolicy = proposedPolicies[urgency] || proposedPolicies.STANDARD;

      const createdAt = new Date(ticket.createdAt);

      // Current projected deadlines
      const curL1 = new Date(createdAt.getTime() + currentPolicy.l1BreachHours * 3600000);
      const curFinal = new Date(createdAt.getTime() + currentPolicy.totalSlaHours * 3600000);
      const curRemainingHours = Number(((curFinal.getTime() - evalTime.getTime()) / 3600000).toFixed(1));
      const curStatus = evalTime > curFinal ? 'CRITICAL_BREACH' : evalTime > curL1 ? 'WARNING_ESCALATING' : 'ON_TRACK';

      // Proposed projected deadlines
      const propL1 = new Date(createdAt.getTime() + proposedPolicy.l1BreachHours * 3600000);
      const propFinal = new Date(createdAt.getTime() + proposedPolicy.totalSlaHours * 3600000);
      const propRemainingHours = Number(((propFinal.getTime() - evalTime.getTime()) / 3600000).toFixed(1));
      const propStatus = evalTime > propFinal ? 'CRITICAL_BREACH' : evalTime > propL1 ? 'WARNING_ESCALATING' : 'ON_TRACK';

      const hoursDelta = Number((propRemainingHours - curRemainingHours).toFixed(1));
      const isStatusChanged = curStatus !== propStatus;

      let impactType = 'NO_CHANGE';
      let explanation = 'No deadline change for this tier.';

      if (hoursDelta < 0) {
        impactType = 'TIGHTENED';
        explanation = `Deadline shortened by ${Math.abs(hoursDelta)}h (${curRemainingHours}h -> ${propRemainingHours}h remaining).`;
        earlierOverdueCount++;
        affectedCount++;
      } else if (hoursDelta > 0) {
        impactType = 'RELAXED';
        explanation = `Deadline relaxed by ${hoursDelta}h (${curRemainingHours}h -> ${propRemainingHours}h remaining).`;
        laterOverdueCount++;
        affectedCount++;
      }

      results.push({
        ticketId: ticket.id,
        title: ticket.title || ticket.description || 'Request',
        urgency,
        roomId: ticket.roomId || ticket.ward || 'General',
        currentStatus: curStatus,
        projectedStatus: propStatus,
        statusChanged: isStatusChanged,
        currentRemainingHours: curRemainingHours,
        projectedRemainingHours: propRemainingHours,
        hoursDelta,
        impactType,
        explanation,
        projectedFinalDeadline: propFinal.toISOString(),
      });
    }

    return {
      success: true,
      isSimulation: true,
      simulatedAt: evalTime.toISOString(),
      activePolicyVersion: this.activePolicyVersion,
      totalEvaluated: candidateTickets.length,
      affectedCount,
      summary: {
        earlierOverdueCount,
        laterOverdueCount,
        unchangedCount: candidateTickets.length - affectedCount,
      },
      results,
    };
  }

  /**
   * Explicit policy activation with versioning and audit record
   */
  activatePolicy(proposedPolicies, actor = 'ADMIN', role = 'ADMINISTRATOR', auditLedger = null) {
    const validation = this.validatePolicy(proposedPolicies);
    if (!validation.valid) {
      return { success: false, ...validation };
    }

    const previousVersion = this.activePolicyVersion;
    const newVersionIndex = this.policyHistory.length + 1;
    const newVersion = `POL-v1.${newVersionIndex}`;

    // Archive previous
    this.policyHistory.push({
      version: previousVersion,
      retiredAt: this.getCurrentTime().toISOString(),
      activatedBy: actor,
      policies: JSON.parse(JSON.stringify(this.activePolicies)),
    });

    this.activePolicies = JSON.parse(JSON.stringify(proposedPolicies));
    this.activePolicyVersion = newVersion;
    const activatedAt = this.getCurrentTime().toISOString();

    let auditBlock = null;
    if (auditLedger) {
      auditBlock = auditLedger.logEvent({
        eventType: 'POLICY_ACTIVATED',
        actor,
        role,
        grievanceId: 'SYSTEM_CONFIG',
        details: {
          previousVersion,
          newVersion,
          policies: this.activePolicies,
          activatedAt,
        },
      });
    }

    return {
      success: true,
      version: newVersion,
      previousVersion,
      activatedAt,
      policies: this.activePolicies,
      auditBlock,
    };
  }

  /**
   * Returns current effective simulation time (real time + virtual offset)
   */
  getCurrentTime() {
    return new Date(Date.now() + this.virtualTimeOffsetMs);
  }

  /**
   * Advance virtual simulation time by hours (for judge testing)
   */
  advanceTime(hours) {
    this.virtualTimeOffsetMs += hours * 3600 * 1000;
    return this.getCurrentTime();
  }

  resetTime() {
    this.virtualTimeOffsetMs = 0;
    return this.getCurrentTime();
  }

  /**
   * Calculates target deadlines when a grievance is created
   */
  calculateDeadlines(createdAtISO, urgency = 'STANDARD') {
    const policy = (this.activePolicies && this.activePolicies[urgency]) || SLA_POLICIES[urgency] || SLA_POLICIES.STANDARD;
    const createdAt = new Date(createdAtISO);

    const deadlineL1 = new Date(createdAt.getTime() + policy.l1BreachHours * 3600 * 1000);
    const deadlineL2 = new Date(createdAt.getTime() + policy.l2BreachHours * 3600 * 1000);
    const finalDeadline = new Date(createdAt.getTime() + policy.totalSlaHours * 3600 * 1000);

    return {
      urgency,
      policyLabel: policy.label,
      totalSlaHours: policy.totalSlaHours,
      deadlineL1: deadlineL1.toISOString(),
      deadlineL2: deadlineL2.toISOString(),
      finalDeadline: finalDeadline.toISOString(),
    };
  }

  /**
   * Computes real-time remaining minutes and breach status against effective time
   */
  getTicketSLAStatus(grievance) {
    const now = this.getCurrentTime();
    const finalDeadline = new Date(grievance.sla.finalDeadline);
    const deadlineL1 = new Date(grievance.sla.deadlineL1);
    const deadlineL2 = new Date(grievance.sla.deadlineL2);

    const remainingMs = finalDeadline.getTime() - now.getTime();
    const remainingHours = (remainingMs / (3600 * 1000)).toFixed(1);

    const isL1Breached = now > deadlineL1;
    const isL2Breached = now > deadlineL2;
    const isOverdue = now > finalDeadline;

    return {
      remainingHours: Number(remainingHours),
      isL1Breached,
      isL2Breached,
      isOverdue,
      statusBadge: isOverdue ? 'CRITICAL_BREACH' : isL1Breached ? 'WARNING_ESCALATING' : 'ON_TRACK',
    };
  }

  /**
   * Runs periodic or on-demand check across all active tickets.
   * Auto-escalates tickets if SLA threshold crossed.
   */
  evaluateAndApplyEscalations(grievances, auditLedger) {
    const escalationsApplied = [];
    const now = this.getCurrentTime();

    for (const ticket of grievances) {
      // Completed or rejected tickets do not escalate
      if ([STATES.RESOLVED, STATES.CLOSED, STATES.CITIZEN_CONFIRMED, STATES.READY_FOR_CLOSURE, STATES.REJECTED_INVALID].includes(ticket.status)) {
        continue;
      }

      const deadlineL1 = new Date(ticket.sla.deadlineL1);
      const deadlineL2 = new Date(ticket.sla.deadlineL2);

      // Check L2 breach first
      if (now > deadlineL2 && ticket.status !== STATES.ESCALATED_L2) {
        const transition = WorkflowFSM.attemptTransition(
          ticket,
          STATES.ESCALATED_L2,
          'SLA_DAEMON',
          ROLES.SYSTEM_DAEMON,
          { reason: `Tier-2 SLA Breach: Overdue by ${((now - deadlineL2) / 3600000).toFixed(1)} hours.` }
        );

        if (transition.success) {
          ticket.status = STATES.ESCALATED_L2;
          ticket.isEscalated = true;
          ticket.escalationLevel = 'L2';
          ticket.underlyingStatus = transition.from;
          ticket.escalatedAt = now.toISOString();
          ticket.updatedAt = now.toISOString();
          auditLedger.logEvent({
            eventType: 'AUTO_ESCALATION_L2',
            actor: 'SYSTEM_SLA_DAEMON',
            role: ROLES.SYSTEM_DAEMON,
            grievanceId: ticket.id,
            details: {
              previousStatus: transition.from,
              newStatus: STATES.ESCALATED_L2,
              reason: 'Overdue SLA passed Campus Registrar escalation threshold.',
              virtualSimTime: now.toISOString(),
            },
          });
          escalationsApplied.push({ id: ticket.id, level: 'L2', title: ticket.title });
        }
      } else if (now > deadlineL1 && ticket.status !== STATES.ESCALATED_L1 && ticket.status !== STATES.ESCALATED_L2) {
        const transition = WorkflowFSM.attemptTransition(
          ticket,
          STATES.ESCALATED_L1,
          'SLA_DAEMON',
          ROLES.SYSTEM_DAEMON,
          { reason: `Tier-1 SLA Breach: Exceeded Department Supervisor response time.` }
        );

        if (transition.success) {
          ticket.status = STATES.ESCALATED_L1;
          ticket.isEscalated = true;
          ticket.escalationLevel = 'L1';
          ticket.underlyingStatus = transition.from;
          ticket.escalatedAt = now.toISOString();
          ticket.updatedAt = now.toISOString();
          auditLedger.logEvent({
            eventType: 'AUTO_ESCALATION_L1',
            actor: 'SYSTEM_SLA_DAEMON',
            role: ROLES.SYSTEM_DAEMON,
            grievanceId: ticket.id,
            details: {
              previousStatus: transition.from,
              newStatus: STATES.ESCALATED_L1,
              reason: 'Overdue SLA passed Department Supervisor response threshold.',
              virtualSimTime: now.toISOString(),
            },
          });
          escalationsApplied.push({ id: ticket.id, level: 'L1', title: ticket.title });
        }
      }
    }

    return escalationsApplied;
  }
}
