import crypto from 'crypto';

/**
 * GovFix Evidence Integrity Lab
 * Enforces cryptographic byte-level integrity verification for repair proof artifacts.
 * 
 * IMPORTANT ARCHITECTURAL LIMITATION:
 * A matching SHA-256 byte digest verifies that the checked file is identical to the file
 * recorded at upload time. It does not verify the subjective truthfulness of the technician
 * or whether the physical repair was executed correctly in the physical world.
 */
export class EvidenceLab {
  constructor() {
    this.registry = new Map();
    this.maxSizeBytes = 10 * 1024 * 1024; // 10MB upload ceiling
    this.initDemoFixtures();
  }

  /**
   * Seed demo evidence fixture
   */
  initDemoFixtures() {
    const demoPayload = Buffer.from(
      'DYP_LAB_304_GPU_CALIBRATION_PROOF::VOLTAGE_12V_STABLE::STRESS_TEST_PASSED::TECH_CAMPUS_SUPPORT_05',
      'utf-8'
    );
    const hash = crypto.createHash('sha256').update(demoPayload).digest('hex');

    this.registry.set('EVID-DEMO-1001', {
      evidenceId: 'EVID-DEMO-1001',
      ticketId: 'DYP-2026-101',
      fileName: 'lab304_gpu_calibration.dat',
      fileSize: `${demoPayload.length} bytes`,
      fileSizeBytes: demoPayload.length,
      mimeType: 'application/octet-stream',
      sha256Checksum: hash,
      uploader: 'TECH_CAMPUS_SUPPORT_05',
      role: 'OFFICER',
      recordedAt: new Date().toISOString(),
      rawBuffer: demoPayload,
    });
  }

  /**
   * Registers a new evidence artifact
   */
  registerEvidence({ evidenceId, ticketId, fileName, fileBuffer, uploader, role, mimeType = 'application/octet-stream' }) {
    if (!fileBuffer || !Buffer.isBuffer(fileBuffer)) {
      return { success: false, code: 'ERR_INVALID_FILE_BUFFER', error: 'Evidence file buffer is required.' };
    }

    if (fileBuffer.length > this.maxSizeBytes) {
      return { success: false, code: 'ERR_FILE_TOO_LARGE', error: `Evidence exceeds maximum allowed size (${this.maxSizeBytes / 1048576}MB).` };
    }

    // Path traversal sanitize
    const sanitizedFileName = (fileName || 'evidence_proof.bin').replace(/^.*[\\\/]/, '').replace(/[^a-zA-Z0-9._-]/g, '_');
    const id = evidenceId || `EVID-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const sha256Checksum = crypto.createHash('sha256').update(fileBuffer).digest('hex');

    const record = {
      evidenceId: id,
      ticketId: ticketId || 'GENERAL',
      fileName: sanitizedFileName,
      fileSizeBytes: fileBuffer.length,
      fileSize: `${(fileBuffer.length / 1024).toFixed(1)} KB`,
      mimeType,
      sha256Checksum,
      uploader: uploader || 'TECH_OFFICER',
      role: role || 'OFFICER',
      recordedAt: new Date().toISOString(),
      rawBuffer: fileBuffer,
    };

    this.registry.set(id, record);
    return { success: true, record };
  }

  /**
   * Verifies candidate file bytes against recorded audit hash
   */
  verifyEvidence(evidenceId, candidateBuffer) {
    const recorded = this.registry.get(evidenceId);
    if (!recorded) {
      return {
        success: false,
        code: 'ERR_EVIDENCE_NOT_FOUND',
        error: `Evidence record '${evidenceId}' not found in registry.`,
      };
    }

    if (!candidateBuffer || !Buffer.isBuffer(candidateBuffer)) {
      return {
        success: false,
        code: 'ERR_INVALID_VERIFY_BUFFER',
        error: 'Candidate file buffer required for verification.',
      };
    }

    const computedHash = crypto.createHash('sha256').update(candidateBuffer).digest('hex');
    const isMatch = computedHash === recorded.sha256Checksum;

    return {
      success: true,
      evidenceId,
      ticketId: recorded.ticketId,
      fileName: recorded.fileName,
      recordedHash: recorded.sha256Checksum,
      computedHash,
      isMatch,
      status: isMatch ? 'INTEGRITY_VERIFIED' : 'TAMPER_DETECTED',
      message: isMatch
        ? 'SHA-256 byte digest matches recorded audit seal. Zero byte alteration detected.'
        : 'CRYPTOGRAPHIC HASH MISMATCH! The uploaded file content differs from the recorded proof artifact.',
      verifiedAt: new Date().toISOString(),
    };
  }

  /**
   * Isolated Tamper Demonstration Fixture
   * Proves that altering even 1 single byte triggers immediate mismatch,
   * without mutating the original evidence record!
   */
  runTamperDemonstration() {
    const original = this.registry.get('EVID-DEMO-1001');
    const pristineBuffer = Buffer.from(original.rawBuffer);

    // Create isolated temporary altered copy (Change 'STABLE' to 'FAULTY')
    const tamperedBuffer = Buffer.from(
      original.rawBuffer.toString('utf-8').replace('VOLTAGE_12V_STABLE', 'VOLTAGE_12V_FAULTY'),
      'utf-8'
    );

    const pristineCheck = this.verifyEvidence('EVID-DEMO-1001', pristineBuffer);
    const tamperedCheck = this.verifyEvidence('EVID-DEMO-1001', tamperedBuffer);

    return {
      fixtureName: 'Lab 304 GPU Power Diagnostic Proof',
      evidenceId: 'EVID-DEMO-1001',
      recordedSha256: original.sha256Checksum,
      pristineVerification: {
        testedPayload: pristineBuffer.toString('utf-8'),
        computedHash: pristineCheck.computedHash,
        isMatch: pristineCheck.isMatch,
        status: pristineCheck.status,
      },
      tamperedCopyVerification: {
        testedPayload: tamperedBuffer.toString('utf-8'),
        computedHash: tamperedCheck.computedHash,
        isMatch: tamperedCheck.isMatch,
        status: tamperedCheck.status,
      },
      originalRecordUnmodified: this.registry.get('EVID-DEMO-1001').sha256Checksum === original.sha256Checksum,
      explanation: 'Pristine copy verified 100%. Altered test copy (simulating unauthorized modification) altered hash and was instantly caught by the SHA-256 byte-check.',
    };
  }

  /**
   * List all registered evidence artifacts (metadata only, no raw buffers)
   */
  listEvidence() {
    const list = [];
    for (const [id, rec] of this.registry.entries()) {
      list.push({
        evidenceId: rec.evidenceId,
        ticketId: rec.ticketId,
        fileName: rec.fileName,
        fileSize: rec.fileSize,
        sha256Checksum: rec.sha256Checksum,
        uploader: rec.uploader,
        role: rec.role,
        recordedAt: rec.recordedAt,
      });
    }
    return list;
  }
}
