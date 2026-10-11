import crypto from 'crypto';

/**
 * Tamper-Evident SHA-256 Cryptographic Audit Ledger
 * Every accepted transition, refused attempt, and escalation is cryptographically chained.
 */
export class AuditLedger {
  constructor() {
    this.chain = [];
    this.initGenesis();
  }

  initGenesis() {
    const genesisEvent = {
      index: 0,
      timestamp: new Date().toISOString(),
      eventType: 'GENESIS',
      actor: 'SYSTEM',
      role: 'ROOT',
      grievanceId: 'SYSTEM_INIT',
      details: 'GovFix Cryptographic Audit Ledger Initialized',
      previousHash: '0000000000000000000000000000000000000000000000000000000000000000',
    };
    genesisEvent.hash = this.calculateHash(genesisEvent);
    this.chain.push(genesisEvent);
  }

  calculateHash(event) {
    const payload = `${event.index}|${event.timestamp}|${event.eventType}|${event.actor}|${event.role}|${event.grievanceId}|${JSON.stringify(event.details)}|${event.previousHash}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }

  /**
   * Records an audit event (accepted, refused, escalation, assignment)
   */
  logEvent({ eventType, actor, role, grievanceId, details, isRefusal = false }) {
    const previousEvent = this.chain[this.chain.length - 1];
    const newEvent = {
      index: this.chain.length,
      timestamp: new Date().toISOString(),
      eventType,
      actor: actor || 'ANONYMOUS',
      role: role || 'CITIZEN',
      grievanceId: grievanceId || 'N/A',
      isRefusal: Boolean(isRefusal),
      details: details || {},
      previousHash: previousEvent.hash,
    };
    newEvent.hash = this.calculateHash(newEvent);
    this.chain.push(newEvent);
    return newEvent;
  }

  /**
   * Returns complete history for a specific grievance
   */
  getGrievanceHistory(grievanceId) {
    return this.chain.filter((entry) => entry.grievanceId === grievanceId);
  }

  /**
   * Verifies the cryptographic integrity of the entire chain
   */
  verifyIntegrity() {
    for (let i = 1; i < this.chain.length; i++) {
      const current = this.chain[i];
      const previous = this.chain[i - 1];

      // Verify previous hash pointer
      if (current.previousHash !== previous.hash) {
        return {
          valid: false,
          brokenAtIndex: i,
          reason: `Broken chain pointer at index ${i}: stored previousHash does not match previous block hash.`,
        };
      }

      // Recalculate hash of current block
      const computedHash = this.calculateHash(current);
      if (current.hash !== computedHash) {
        return {
          valid: false,
          brokenAtIndex: i,
          reason: `Tampered payload detected at index ${i}: hash mismatch.`,
        };
      }
    }

    return {
      valid: true,
      totalBlocks: this.chain.length,
      verifiedAt: new Date().toISOString(),
      latestHash: this.chain[this.chain.length - 1].hash,
    };
  }
}
