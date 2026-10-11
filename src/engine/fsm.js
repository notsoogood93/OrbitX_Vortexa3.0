/**
 * GovFix Finite State Machine (FSM) & Role Authorization Engine
 * Enforces strict transitions, role gates, and emits immutable refusal reasons.
 */

export const STATES = {
  SUBMITTED: 'SUBMITTED',
  TRIAGED: 'TRIAGED',
  REJECTED_INVALID: 'REJECTED_INVALID',
  ASSIGNED: 'ASSIGNED',
  IN_PROGRESS: 'IN_PROGRESS',
  INSPECTION_PENDING: 'INSPECTION_PENDING',
  RESOLVED: 'RESOLVED',
  CITIZEN_CONFIRMED: 'CITIZEN_CONFIRMED',
  REOPENED: 'REOPENED',
  ESCALATED_L1: 'ESCALATED_L1',
  ESCALATED_L2: 'ESCALATED_L2',
};

export const ROLES = {
  CITIZEN: 'CITIZEN',
  WARD_OFFICER: 'WARD_OFFICER',
  FIELD_ENGINEER: 'FIELD_ENGINEER',
  SUPERVISING_COMMISSIONER: 'SUPERVISING_COMMISSIONER',
  SYSTEM_DAEMON: 'SYSTEM_DAEMON',
};

/**
 * Transition Rule Definitions
 * Each valid transition specifies allowed current states, permitted roles, and validator callbacks.
 */
export const TRANSITIONS = [
  {
    from: [STATES.SUBMITTED],
    to: STATES.TRIAGED,
    allowedRoles: [ROLES.WARD_OFFICER, ROLES.SUPERVISING_COMMISSIONER],
    validate: (grievance, payload) => {
      if (!payload.category || !payload.ward || !payload.urgency) {
        return { valid: false, code: 'ERR_INCOMPLETE_PREREQUISITE', message: 'Triage requires verified Category, Ward, and Urgency.' };
      }
      return { valid: true };
    },
  },
  {
    from: [STATES.SUBMITTED],
    to: STATES.REJECTED_INVALID,
    allowedRoles: [ROLES.WARD_OFFICER, ROLES.SUPERVISING_COMMISSIONER],
    validate: (grievance, payload) => {
      if (!payload.rejectionReason || payload.rejectionReason.trim().length < 5) {
        return { valid: false, code: 'ERR_MISSING_JUSTIFICATION', message: 'Rejecting a grievance requires an explicit justification of at least 5 characters.' };
      }
      return { valid: true };
    },
  },
  {
    from: [STATES.TRIAGED, STATES.ESCALATED_L1],
    to: STATES.ASSIGNED,
    allowedRoles: [ROLES.WARD_OFFICER, ROLES.SUPERVISING_COMMISSIONER],
    validate: (grievance, payload) => {
      if (!payload.assignedEngineerId) {
        return { valid: false, code: 'ERR_MISSING_ASSIGNEE', message: 'Assignment requires a valid Field Engineer ID.' };
      }
      return { valid: true };
    },
  },
  {
    from: [STATES.ASSIGNED, STATES.ESCALATED_L1, STATES.ESCALATED_L2],
    to: STATES.IN_PROGRESS,
    allowedRoles: [ROLES.FIELD_ENGINEER, ROLES.SUPERVISING_COMMISSIONER],
    validate: () => ({ valid: true }),
  },
  {
    from: [STATES.IN_PROGRESS],
    to: STATES.INSPECTION_PENDING,
    allowedRoles: [ROLES.FIELD_ENGINEER],
    validate: (grievance, payload) => {
      if (!payload.workNotes || payload.workNotes.trim().length < 5) {
        return { valid: false, code: 'ERR_MISSING_EVIDENCE', message: 'Marking work complete requires detailed field work notes.' };
      }
      return { valid: true };
    },
  },
  {
    from: [STATES.INSPECTION_PENDING, STATES.ESCALATED_L2],
    to: STATES.RESOLVED,
    allowedRoles: [ROLES.WARD_OFFICER, ROLES.SUPERVISING_COMMISSIONER],
    validate: (grievance, payload) => {
      if (!payload.inspectionNotes) {
        return { valid: false, code: 'ERR_INSPECTION_REQUIRED', message: 'Resolution sign-off requires officer inspection notes.' };
      }
      return { valid: true };
    },
  },
  {
    from: [STATES.RESOLVED],
    to: STATES.CITIZEN_CONFIRMED,
    allowedRoles: [ROLES.CITIZEN],
    validate: () => ({ valid: true }),
  },
  {
    from: [STATES.RESOLVED],
    to: STATES.REOPENED,
    allowedRoles: [ROLES.CITIZEN],
    validate: (grievance, payload) => {
      if (!payload.reopenReason) {
        return { valid: false, code: 'ERR_REOPEN_JUSTIFICATION', message: 'Citizen reopen requires explanation of dissatisfaction.' };
      }
      return { valid: true };
    },
  },
  {
    from: [STATES.REOPENED],
    to: STATES.TRIAGED,
    allowedRoles: [ROLES.WARD_OFFICER, ROLES.SUPERVISING_COMMISSIONER],
    validate: () => ({ valid: true }),
  },
  // Escalations (SLA breach triggers)
  {
    from: [STATES.SUBMITTED, STATES.TRIAGED, STATES.ASSIGNED],
    to: STATES.ESCALATED_L1,
    allowedRoles: [ROLES.SYSTEM_DAEMON, ROLES.SUPERVISING_COMMISSIONER],
    validate: () => ({ valid: true }),
  },
  {
    from: [STATES.IN_PROGRESS, STATES.ESCALATED_L1],
    to: STATES.ESCALATED_L2,
    allowedRoles: [ROLES.SYSTEM_DAEMON, ROLES.SUPERVISING_COMMISSIONER],
    validate: () => ({ valid: true }),
  },
];

export class WorkflowFSM {
  /**
   * Attempts to execute a state transition.
   * If valid: returns { success: true, from, to, payload }.
   * If invalid: returns { success: false, code, reason }.
   */
  static attemptTransition(grievance, targetState, actor, role, payload = {}) {
    const currentState = grievance.status;

    // 1. Check if target state is a recognized system state
    if (!Object.values(STATES).includes(targetState)) {
      return {
        success: false,
        code: 'ERR_UNKNOWN_STATE',
        reason: `Target state '${targetState}' is not a recognized workflow state.`,
      };
    }

    // 2. Find matching transition rule
    const matchingRule = TRANSITIONS.find(
      (rule) => rule.from.includes(currentState) && rule.to === targetState
    );

    if (!matchingRule) {
      return {
        success: false,
        code: 'ERR_ILLEGAL_STATE_JUMP',
        reason: `Direct transition from '${currentState}' to '${targetState}' is prohibited by municipal governance policy. Skipped steps are refused.`,
      };
    }

    // 3. Enforce Role-Based Authorization
    if (!matchingRule.allowedRoles.includes(role)) {
      return {
        success: false,
        code: 'ERR_ROLE_UNAUTHORIZED',
        reason: `Role '${role}' is not authorized to transition this ticket from '${currentState}' to '${targetState}'. Required role: [${matchingRule.allowedRoles.join(', ')}].`,
      };
    }

    // 4. Validate prerequisite conditions
    const validationResult = matchingRule.validate(grievance, payload);
    if (!validationResult.valid) {
      return {
        success: false,
        code: validationResult.code,
        reason: validationResult.message,
      };
    }

    return {
      success: true,
      from: currentState,
      to: targetState,
      actor,
      role,
      payload,
    };
  }
}
