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
    const policy = SLA_POLICIES[urgency] || SLA_POLICIES.STANDARD;
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
