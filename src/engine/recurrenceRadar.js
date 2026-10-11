/**
 * GovFix Recurring-Failure Radar
 * Deterministic and explainable heuristic clustering across room, asset, and category signals.
 * 
 * IMPORTANT ARCHITECTURAL LIMITATION:
 * Detected clusters indicate statistical correlation and operational recurrence patterns.
 * They do not constitute an autonomous forensic proof of root cause.
 * Human supervisor verification is required before initiating major campus overhauls.
 */
export class RecurrenceRadar {
  constructor() {
    this.decisions = new Map(); // clusterId -> { decision, reviewer, rationale, reviewedAt }
  }

  /**
   * Scan active and historical tickets for recurring operational clusters
   */
  detectClusters(tickets = []) {
    const map = new Map();

    for (const t of tickets) {
      const room = t.roomId || t.ward || 'General Campus';
      const category = t.category || 'General Maintenance';
      const asset = t.assetId || 'Campus Infrastructure';

      // Primary key: Room + Category
      const key = `${room}:::${category}`;

      if (!map.has(key)) {
        map.set(key, {
          room,
          category,
          assets: new Set(),
          tickets: [],
        });
      }

      const entry = map.get(key);
      entry.tickets.push(t);
      if (t.assetId) entry.assets.add(t.assetId);
    }

    const clusters = [];

    for (const [key, entry] of map.entries()) {
      if (entry.tickets.length >= 2) {
        const clusterId = `RADAR-${Buffer.from(key).toString('base64').replace(/=/g, '').slice(0, 10)}`;
        const matchingSignals = ['SAME_PHYSICAL_ROOM', 'SAME_SERVICE_CATEGORY'];

        if (entry.assets.size === 1) {
          matchingSignals.push('SAME_EQUIPMENT_ASSET');
        } else if (entry.assets.size > 1) {
          matchingSignals.push('MULTIPLE_ASSETS_SAME_LAB');
        }

        const isUrgent = entry.tickets.some((t) => t.urgency === 'HIGH' || t.urgency === 'EMERGENCY');
        if (entry.tickets.length >= 3 || isUrgent) {
          matchingSignals.push('ELEVATED_FAILURE_FREQUENCY');
        }

        const severity = (entry.tickets.length >= 3 || isUrgent) ? 'CRITICAL' : 'WARNING';

        // Plain English suggested action
        let suggestedAction = `Inspect ${entry.room} facility infrastructure.`;
        if (entry.category.includes('IT') || entry.category.includes('Computing')) {
          suggestedAction = `Schedule diagnostic maintenance for lab workstations in ${entry.room}; check 220V power stability and thermal paste.`;
        } else if (entry.category.includes('Electrical')) {
          suggestedAction = `Immediate campus electrician dispatch: test circuit breaker panels and residual-current circuit breakers (RCCBs) in ${entry.room}.`;
        } else if (entry.category.includes('AV')) {
          suggestedAction = `Service ceiling projector mount and replace HDMI/DisplayPort cabling in ${entry.room}.`;
        } else if (entry.category.includes('Infrastructure') || entry.category.includes('Maintenance')) {
          suggestedAction = `Perform structural plumbing & line pressure check with Campus Facilities team.`;
        }

        const decisionRecord = this.decisions.get(clusterId);

        clusters.push({
          clusterId,
          room: entry.room,
          category: entry.category,
          assets: Array.from(entry.assets),
          incidentCount: entry.tickets.length,
          ticketIds: entry.tickets.map((t) => t.id),
          ticketTitles: entry.tickets.map((t) => t.title || t.description || 'Service Request'),
          matchingSignals,
          severity,
          suggestedAction,
          reviewStatus: decisionRecord ? decisionRecord.decision : 'PENDING_REVIEW',
          reviewDetails: decisionRecord || null,
        });
      }
    }

    // Sort by severity (CRITICAL first) then incident count descending
    return clusters.sort((a, b) => {
      if (a.severity === 'CRITICAL' && b.severity !== 'CRITICAL') return -1;
      if (b.severity === 'CRITICAL' && a.severity !== 'CRITICAL') return 1;
      return b.incidentCount - a.incidentCount;
    });
  }

  /**
   * Supervisor records a review decision (CONFIRM or DISMISS)
   */
  reviewCluster(clusterId, decision, reviewer = 'SUPERVISOR', rationale = '', auditLedger = null) {
    if (!['CONFIRM', 'DISMISS'].includes(decision)) {
      return { success: false, code: 'ERR_INVALID_DECISION', error: "Decision must be 'CONFIRM' or 'DISMISS'." };
    }

    const record = {
      decision: decision === 'CONFIRM' ? 'CONFIRMED_DEFECT' : 'DISMISSED_FALSE_POSITIVE',
      reviewer,
      rationale: rationale || (decision === 'CONFIRM' ? 'Supervisor confirmed chronic lab defect.' : 'Dismissed as unrelated operational coincidence.'),
      reviewedAt: new Date().toISOString(),
    };

    this.decisions.set(clusterId, record);

    let auditBlock = null;
    if (auditLedger) {
      auditBlock = auditLedger.logEvent({
        eventType: 'RECURRENCE_PATTERN_REVIEWED',
        actor: reviewer,
        role: 'SUPERVISOR',
        grievanceId: clusterId,
        details: record,
      });
    }

    return {
      success: true,
      clusterId,
      ...record,
      auditBlock,
    };
  }
}
