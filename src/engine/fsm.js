/**
 * GovFix Finite State Machine (FSM) & Role Authorization Engine
 * Supports both University Campus Track (DY Patil) & Municipal Track (PCMC/PMC).
 * Enforces strict transitions, role gates, and emits immutable refusal reasons with exact HTTP status codes.
 */

export const STATES = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  TRIAGED: 'TRIAGED',
  REJECTED_INVALID: 'REJECTED_INVALID',
  ASSIGNED: 'ASSIGNED',
  ACCEPTED: 'ACCEPTED',
  IN_PROGRESS: 'IN_PROGRESS',
  AWAITING_REQUESTER: 'AWAITING_REQUESTER',
  INSPECTION_PENDING: 'INSPECTION_PENDING',
  READY_FOR_CLOSURE: 'READY_FOR_CLOSURE',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  CITIZEN_CONFIRMED: 'CITIZEN_CONFIRMED',
  REOPENED: 'REOPENED',
  ESCALATED_L1: 'ESCALATED_L1',
  ESCALATED_L2: 'ESCALATED_L2',
};

export const ROLES = {
  // University Campus Roles
  REQUESTER: 'REQUESTER',
  SUPERVISOR: 'SUPERVISOR',
  OFFICER: 'OFFICER',
  ADMINISTRATOR: 'ADMINISTRATOR',

  // Municipal Equivalents (full backward compatibility)
  CITIZEN: 'CITIZEN',
  WARD_OFFICER: 'WARD_OFFICER',
  FIELD_ENGINEER: 'FIELD_ENGINEER',
  SUPERVISING_COMMISSIONER: 'SUPERVISING_COMMISSIONER',

  // System
  SYSTEM_DAEMON: 'SYSTEM_DAEMON',
};

// Role alias normalization helper
export function normalizeRole(role) {
  if (!role) return ROLES.REQUESTER;
  const upper = role.toUpperCase();
  if (upper === 'CITIZEN' || upper === 'STUDENT' || upper === 'FACULTY') return ROLES.REQUESTER;
  if (upper === 'WARD_OFFICER' || upper === 'HOD' || upper === 'ESTATE_OFFICER') return ROLES.SUPERVISOR;
  if (upper === 'FIELD_ENGINEER' || upper === 'TECHNICIAN' || upper === 'ENGINEER') return ROLES.OFFICER;
  if (upper === 'SUPERVISING_COMMISSIONER' || upper === 'REGISTRAR' || upper === 'DIRECTOR') return ROLES.ADMINISTRATOR;
  return upper;
}

/**
 * Transition Rule Definitions
 */
export const TRANSITIONS = [
  // 0. Submit Draft: DRAFT -> SUBMITTED
  {
    from: [STATES.DRAFT],
    to: STATES.SUBMITTED,
    allowedRoles: [ROLES.REQUESTER, ROLES.CITIZEN],
    validate: (ticket, payload) => {
      if (!ticket.description && !payload.description) {
        return { valid: false, code: 'ERR_MISSING_DESCRIPTION', message: 'Request description required.' };
      }
      return { valid: true };
    },
  },

  // 1. Triage: SUBMITTED -> TRIAGED
  {
    from: [STATES.SUBMITTED],
    to: STATES.TRIAGED,
    allowedRoles: [ROLES.SUPERVISOR, ROLES.ADMINISTRATOR, ROLES.WARD_OFFICER, ROLES.SUPERVISING_COMMISSIONER],
    validate: (ticket, payload) => {
      if (!payload.category && !ticket.category) {
        return { valid: false, code: 'ERR_INCOMPLETE_PREREQUISITE', message: 'Triage requires a verified category.' };
      }
      return { valid: true };
    },
  },

  // 2. Reject Invalid/Spam: SUBMITTED -> REJECTED_INVALID
  {
    from: [STATES.SUBMITTED],
    to: STATES.REJECTED_INVALID,
    allowedRoles: [ROLES.SUPERVISOR, ROLES.ADMINISTRATOR, ROLES.WARD_OFFICER, ROLES.SUPERVISING_COMMISSIONER],
    validate: (ticket, payload) => {
      if (!payload.rejectionReason || payload.rejectionReason.trim().length < 5) {
        return { valid: false, code: 'ERR_MISSING_JUSTIFICATION', message: 'Rejecting a request requires an explicit justification of at least 5 characters.' };
      }
      return { valid: true };
    },
  },

  // 3. Assign Technician: TRIAGED / ESCALATED_L1 -> ASSIGNED
  {
    from: [STATES.TRIAGED, STATES.ESCALATED_L1],
    to: STATES.ASSIGNED,
    allowedRoles: [ROLES.SUPERVISOR, ROLES.ADMINISTRATOR, ROLES.WARD_OFFICER, ROLES.SUPERVISING_COMMISSIONER],
    validate: (ticket, payload) => {
      if (!payload.assignedEngineerId && !payload.assignedOfficerId) {
        return { valid: false, code: 'ERR_MISSING_ASSIGNEE', message: 'Assignment requires a valid Officer / Technician ID.' };
      }
      return { valid: true };
    },
  },

  // 4. Officer Accepts Assignment: ASSIGNED -> ACCEPTED
  {
    from: [STATES.ASSIGNED],
    to: STATES.ACCEPTED,
    allowedRoles: [ROLES.OFFICER, ROLES.FIELD_ENGINEER],
    validate: () => ({ valid: true }),
  },

  // 5. Officer Rejects Assignment: ASSIGNED -> TRIAGED (Rejection reason retained)
  {
    from: [STATES.ASSIGNED],
    to: STATES.TRIAGED,
    allowedRoles: [ROLES.OFFICER, ROLES.FIELD_ENGINEER],
    validate: (ticket, payload) => {
      if (!payload.rejectionReason || payload.rejectionReason.trim().length < 5) {
        return { valid: false, code: 'ERR_MISSING_JUSTIFICATION', message: 'Officer assignment rejection requires an explicit reason (minimum 5 chars).' };
      }
      return { valid: true };
    },
  },

  // 6. Begin Work: ACCEPTED / ASSIGNED / ESCALATED -> IN_PROGRESS
  {
    from: [STATES.ASSIGNED, STATES.ACCEPTED, STATES.ESCALATED_L1, STATES.ESCALATED_L2, STATES.AWAITING_REQUESTER],
    to: STATES.IN_PROGRESS,
    allowedRoles: [ROLES.OFFICER, ROLES.FIELD_ENGINEER, ROLES.ADMINISTRATOR, ROLES.SUPERVISING_COMMISSIONER],
    validate: () => ({ valid: true }),
  },

  // 6b. Request Clarification: IN_PROGRESS -> AWAITING_REQUESTER
  {
    from: [STATES.IN_PROGRESS],
    to: STATES.AWAITING_REQUESTER,
    allowedRoles: [ROLES.OFFICER, ROLES.FIELD_ENGINEER, ROLES.SUPERVISOR, ROLES.ADMINISTRATOR],
    validate: () => ({ valid: true }),
  },

  // 7. Work Finished / Propose Closure: IN_PROGRESS / AWAITING_REQUESTER -> READY_FOR_CLOSURE (or INSPECTION_PENDING)
  {
    from: [STATES.IN_PROGRESS, STATES.AWAITING_REQUESTER],
    to: STATES.READY_FOR_CLOSURE,
    allowedRoles: [ROLES.OFFICER, ROLES.FIELD_ENGINEER],
    validate: (ticket, payload) => {
      if (!payload.workNotes || payload.workNotes.trim().length < 5) {
        return { valid: false, code: 'ERR_MISSING_EVIDENCE', message: 'Proposing closure requires detailed work completion notes / evidence.' };
      }
      return { valid: true };
    },
  },
  {
    from: [STATES.IN_PROGRESS],
    to: STATES.INSPECTION_PENDING,
    allowedRoles: [ROLES.OFFICER, ROLES.FIELD_ENGINEER],
    validate: (ticket, payload) => {
      if (!payload.workNotes || payload.workNotes.trim().length < 5) {
        return { valid: false, code: 'ERR_MISSING_EVIDENCE', message: 'Work completion requires detailed inspection/repair notes.' };
      }
      return { valid: true };
    },
  },

  // 8. Closure Approval: READY_FOR_CLOSURE / INSPECTION_PENDING -> CLOSED (or RESOLVED)
  {
    from: [STATES.READY_FOR_CLOSURE, STATES.INSPECTION_PENDING, STATES.ESCALATED_L2],
    to: STATES.CLOSED,
    allowedRoles: [ROLES.SUPERVISOR, ROLES.ADMINISTRATOR, ROLES.WARD_OFFICER, ROLES.SUPERVISING_COMMISSIONER, ROLES.REQUESTER, ROLES.CITIZEN],
    validate: () => ({ valid: true }),
  },
  {
    from: [STATES.READY_FOR_CLOSURE, STATES.INSPECTION_PENDING, STATES.ESCALATED_L2],
    to: STATES.RESOLVED,
    allowedRoles: [ROLES.SUPERVISOR, ROLES.ADMINISTRATOR, ROLES.WARD_OFFICER, ROLES.SUPERVISING_COMMISSIONER],
    validate: () => ({ valid: true }),
  },

  // 9. Requester Confirmation: RESOLVED -> CITIZEN_CONFIRMED / CLOSED
  {
    from: [STATES.RESOLVED],
    to: STATES.CITIZEN_CONFIRMED,
    allowedRoles: [ROLES.REQUESTER, ROLES.CITIZEN],
    validate: () => ({ valid: true }),
  },
  {
    from: [STATES.RESOLVED, STATES.CITIZEN_CONFIRMED],
    to: STATES.CLOSED,
    allowedRoles: [ROLES.REQUESTER, ROLES.CITIZEN, ROLES.SUPERVISOR, ROLES.ADMINISTRATOR],
    validate: () => ({ valid: true }),
  },

  // 10. Reopen Closed Request: CLOSED / RESOLVED -> REOPENED
  {
    from: [STATES.CLOSED, STATES.RESOLVED],
    to: STATES.REOPENED,
    allowedRoles: [ROLES.REQUESTER, ROLES.CITIZEN],
    validate: (ticket, payload) => {
      if (!payload.reopenReason) {
        return { valid: false, code: 'ERR_REOPEN_JUSTIFICATION', message: 'Reopening requires an explanation of dissatisfaction.' };
      }
      return { valid: true };
    },
  },

  // 11. Reopened to Triage
  {
    from: [STATES.REOPENED],
    to: STATES.TRIAGED,
    allowedRoles: [ROLES.SUPERVISOR, ROLES.ADMINISTRATOR, ROLES.WARD_OFFICER, ROLES.SUPERVISING_COMMISSIONER],
    validate: () => ({ valid: true }),
  },

  // 12. Dynamic SLA Escalations (Daemon / Admin)
  {
    from: [STATES.SUBMITTED, STATES.TRIAGED, STATES.ASSIGNED, STATES.ACCEPTED],
    to: STATES.ESCALATED_L1,
    allowedRoles: [ROLES.SYSTEM_DAEMON, ROLES.ADMINISTRATOR, ROLES.SUPERVISING_COMMISSIONER],
    validate: () => ({ valid: true }),
  },
  {
    from: [STATES.IN_PROGRESS, STATES.ESCALATED_L1],
    to: STATES.ESCALATED_L2,
    allowedRoles: [ROLES.SYSTEM_DAEMON, ROLES.ADMINISTRATOR, ROLES.SUPERVISING_COMMISSIONER],
    validate: () => ({ valid: true }),
  },
];

export class WorkflowFSM {
  /**
   * Evaluates state transition and role authority.
   */
  static attemptTransition(ticket, targetState, actor, rawRole, payload = {}) {
    const currentState = ticket.status;
    const role = normalizeRole(rawRole);

    // 1. Check if target state is valid
    if (!Object.values(STATES).includes(targetState)) {
      return {
        success: false,
        httpStatus: 422,
        code: 'ERR_UNKNOWN_STATE',
        reason: `Target state '${targetState}' is not a recognized workflow state.`,
      };
    }

    // 2. Find matching transition
    const matchingRule = TRANSITIONS.find(
      (rule) => rule.from.includes(currentState) && rule.to === targetState
    );

    if (!matchingRule) {
      return {
        success: false,
        httpStatus: 409, // HTTP 409 Conflict as required by Section 9.3
        code: 'ERR_ILLEGAL_STATE_JUMP',
        reason: `Direct transition from '${currentState}' to '${targetState}' is prohibited by institutional workflow rules. Skipped steps are refused.`,
      };
    }

    // 3. Enforce Role-Based Authorization
    const roleMatch = matchingRule.allowedRoles.some(
      (allowed) => normalizeRole(allowed) === role || allowed === rawRole
    );

    if (!roleMatch) {
      return {
        success: false,
        httpStatus: 403, // HTTP 403 Forbidden as required by Section 9.3
        code: 'ERR_ROLE_UNAUTHORIZED',
        reason: `Role '${rawRole}' is not authorized to transition this ticket from '${currentState}' to '${targetState}'. Required role: [${matchingRule.allowedRoles.join(', ')}].`,
      };
    }

    // 4. Validate prerequisite conditions
    const validationResult = matchingRule.validate(ticket, payload);
    if (!validationResult.valid) {
      return {
        success: false,
        httpStatus: 422, // HTTP 422 Unprocessable Entity
        code: validationResult.code,
        reason: validationResult.message,
      };
    }

    return {
      success: true,
      httpStatus: 200,
      from: currentState,
      to: targetState,
      actor,
      role: rawRole,
      payload,
    };
  }
}
