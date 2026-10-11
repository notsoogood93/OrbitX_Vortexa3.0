/**
 * GovFix Smart Grievance Intelligence & Recurring-Failure Radar
 * Heuristic clustering across room, asset, category, text symptoms, and temporal windows.
 * 
 * CORE ARCHITECTURAL PRINCIPLES:
 * 1. Explainability First: Always provide human-readable justification for why items are linked.
 * 2. Distinction: Distinguishes 'POSSIBLE_DUPLICATE' (same user / 24h symptom match) from 'RECURRING_DEFECT' (chronic location/asset failures).
 * 3. Zero Auto-Merge: Individual complaints remain independent and are NEVER silently merged or closed.
 * 4. Human-in-the-Loop: Supervisors hold sole authority to confirm or dismiss clusters, permanently recording decisions to the SHA-256 audit ledger.
 */

// Significant technical keywords to detect shared symptoms
const SYMPTOM_KEYWORDS = [
  'flicker', 'flickering', 'screen', 'display', 'freeze', 'freezing', 'crash', 'smps',
  'breaker', 'tripped', 'spark', 'short', 'voltage', 'power', 'surge', 'leak', 'leaking',
  'pipe', 'water', 'pump', 'pressure', 'audio', 'projector', 'hdmi', 'mic', 'sound',
  'wifi', 'network', 'ethernet', 'switch', 'router', 'gateway', 'slow', 'heating', 'thermal'
];

function extractKeywords(text = '') {
  const lower = text.toLowerCase();
  return SYMPTOM_KEYWORDS.filter((kw) => lower.includes(kw));
}

export class RecurrenceRadar {
  constructor() {
    this.decisions = new Map(); // clusterId -> { decision, reviewer, rationale, reviewedAt }
  }

  /**
   * Find and explain related complaints for a specific ticket
   */
  findRelatedComplaints(targetTicket, allTickets = []) {
    if (!targetTicket || !Array.isArray(allTickets)) {
      return { count: 0, related: [], explanation: 'No target ticket provided.' };
    }

    const targetRoom = (targetTicket.roomId || targetTicket.ward || '').trim().toLowerCase();
    const targetAsset = (targetTicket.assetId || '').trim().toLowerCase();
    const targetCategory = (targetTicket.category || '').trim().toLowerCase();
    const targetKeywords = extractKeywords(`${targetTicket.title} ${targetTicket.description}`);
    const targetTime = new Date(targetTicket.createdAt || Date.now()).getTime();

    const related = [];

    for (const other of allTickets) {
      if (other.id === targetTicket.id) continue;

      const otherRoom = (other.roomId || other.ward || '').trim().toLowerCase();
      const otherAsset = (other.assetId || '').trim().toLowerCase();
      const otherCategory = (other.category || '').trim().toLowerCase();
      const otherKeywords = extractKeywords(`${other.title} ${other.description}`);
      const otherTime = new Date(other.createdAt || Date.now()).getTime();

      const sameRoom = targetRoom && otherRoom && targetRoom === otherRoom;
      const sameAsset = targetAsset && otherAsset && targetAsset === otherAsset;
      const sameCategory = targetCategory && otherCategory && targetCategory === otherCategory;
      const sharedKeywords = targetKeywords.filter((k) => otherKeywords.includes(k));
      const hoursDelta = Math.abs(targetTime - otherTime) / (3600 * 1000);

      const isSameRequester = (
        (targetTicket.citizenName && other.citizenName && targetTicket.citizenName.toLowerCase() === other.citizenName.toLowerCase()) ||
        (targetTicket.citizenContact && other.citizenContact && targetTicket.citizenContact.toLowerCase() === other.citizenContact.toLowerCase())
      );

      // Determine match relevance
      const reasons = [];
      if (sameRoom) reasons.push(`Same physical room: ${targetTicket.roomId || targetTicket.ward}`);
      if (sameAsset) reasons.push(`Identical hardware asset tag: ${targetTicket.assetId}`);
      if (sameCategory) reasons.push(`Matching service category: ${targetTicket.category}`);
      if (sharedKeywords.length > 0) reasons.push(`Overlapping technical symptoms: "${sharedKeywords.join(', ')}"`);
      if (hoursDelta <= 24) reasons.push(`Reported within ${hoursDelta.toFixed(1)}h of each other`);

      // Require at least 2 correlating dimensions to qualify as related
      const matchScore = (sameRoom ? 2 : 0) + (sameAsset ? 3 : 0) + (sameCategory ? 1 : 0) + (sharedKeywords.length >= 1 ? 2 : 0);

      if (matchScore >= 3 || (sameRoom && sameAsset) || (sameRoom && sharedKeywords.length > 0)) {
        // Distinguish Possible Duplicate vs Recurring Defect
        let relationType = 'RECURRING_DEFECT';
        let typeReason = 'Recurring failure pattern across multiple users in the same campus facility.';

        if (isSameRequester || (hoursDelta <= 24 && sharedKeywords.length >= 2)) {
          relationType = 'POSSIBLE_DUPLICATE';
          typeReason = 'Possible duplicate submission within 24h window with matching symptoms.';
        }

        related.push({
          ticketId: other.id,
          title: other.title,
          status: other.status,
          room: other.roomId || other.ward,
          assetId: other.assetId,
          createdAt: other.createdAt,
          relationType,
          typeReason,
          reasons,
          hoursDelta: Number(hoursDelta.toFixed(1)),
          sharedKeywords,
          neverAutoMerge: true,
        });
      }
    }

    return {
      targetTicketId: targetTicket.id,
      count: related.length,
      hasRelatedComplaints: related.length > 0,
      hasPossibleDuplicates: related.some((r) => r.relationType === 'POSSIBLE_DUPLICATE'),
      hasRecurringDefects: related.some((r) => r.relationType === 'RECURRING_DEFECT'),
      related,
      ruleGuarantee: 'Individual complaints retain independent lifecycle and are NEVER automatically merged or closed.',
    };
  }

  /**
   * Scan active and historical tickets for recurring operational clusters
   */
  detectClusters(tickets = []) {
    const map = new Map();

    for (const t of tickets) {
      const room = t.roomId || t.ward || 'General Campus';
      const category = t.category || 'General Maintenance';

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

        // Shared keyword analysis across cluster tickets
        const allClusterText = entry.tickets.map((t) => `${t.title} ${t.description}`).join(' ');
        const clusterKeywords = extractKeywords(allClusterText);
        if (clusterKeywords.length > 0) {
          matchingSignals.push(`COMMON_SYMPTOMS:${clusterKeywords.slice(0, 3).join(',')}`);
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
          clusterKeywords,
          severity,
          suggestedAction,
          reviewStatus: decisionRecord ? decisionRecord.decision : 'PENDING_REVIEW',
          reviewDetails: decisionRecord || null,
          neverAutoMerge: true,
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
