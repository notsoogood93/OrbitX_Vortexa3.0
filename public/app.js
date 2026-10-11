/**
 * GovFix Client Application Logic
 * Integrates Citizen Portal, Ward Officer Queue, Commissioner War Room, and Judge Simulator.
 */

// Global State
let allGrievances = [];
let selectedTicketId = null;

// Initialize on DOM Ready
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initFormListeners();
  initJudgeControls();
  fetchGrievances();

  // Polling every 10 seconds for real-time updates
  setInterval(fetchGrievances, 10000);
});

// ==============================================================================
// Tab Navigation
// ==============================================================================
function initTabs() {
  const tabs = document.querySelectorAll('.tab-btn');
  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      tabs.forEach((t) => t.classList.remove('active'));
      document.querySelectorAll('.tab-pane').forEach((p) => p.classList.remove('active'));

      tab.classList.add('active');
      const targetPane = document.getElementById(tab.dataset.tab);
      if (targetPane) targetPane.classList.add('active');
    });
  });
}

// ==============================================================================
// Data Fetching & Sync
// ==============================================================================
async function fetchGrievances() {
  try {
    const res = await fetch('/api/grievances');
    if (!res.ok) return;
    const data = await res.json();

    allGrievances = data.grievances;

    // Update Simulation Clock display
    const dateObj = new Date(data.currentTime);
    document.getElementById('liveClockDisplay').textContent = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString();
    document.getElementById('virtualOffsetTag').textContent = `+${data.virtualOffsetHours}h sim`;

    renderCitizenView();
    renderOfficerQueue();
    renderCommissionerWarRoom();
    renderJudgeSelectors();
    fetchAuditLedger();
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

// ==============================================================================
// TAB 1: Citizen View & Submission
// ==============================================================================
function initFormListeners() {
  const form = document.getElementById('citizenComplaintForm');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('btnSubmitGrievance');
    btn.disabled = true;
    btn.textContent = '⏳ AI Triaging & Submitting...';

    const payload = {
      citizenName: document.getElementById('citizenName').value,
      citizenContact: document.getElementById('citizenContact').value,
      location: document.getElementById('citizenLocation').value,
      description: document.getElementById('citizenDescription').value,
    };

    try {
      const res = await fetch('/api/grievances', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.success) {
        showToast('✅ Grievance registered & AI triaged successfully!');
        form.reset();
        await fetchGrievances();
        // Select newly created ticket
        selectedTicketId = data.ticket.id;
        document.getElementById('citizenTicketSelector').value = data.ticket.id;
        renderCitizenSelectedTicket(data.ticket);
      } else {
        showToast('❌ Submission failed: ' + (data.error || 'Server error'), true);
      }
    } catch {
      showToast('❌ Network error during submission', true);
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 Submit Grievance & Run Real-Time Triage';
    }
  });

  // Pre-fill prompt chips
  document.querySelectorAll('.chip-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.getElementById('citizenDescription').value = btn.dataset.text;
      document.getElementById('citizenLocation').value = btn.dataset.loc;
    });
  });

  // Citizen ticket selector
  const selector = document.getElementById('citizenTicketSelector');
  selector.addEventListener('change', (e) => {
    selectedTicketId = e.target.value;
    const ticket = allGrievances.find((g) => g.id === selectedTicketId);
    if (ticket) renderCitizenSelectedTicket(ticket);
  });
}

function renderCitizenView() {
  const selector = document.getElementById('citizenTicketSelector');
  const currentVal = selector.value || selectedTicketId;

  selector.innerHTML = allGrievances
    .map((g) => `<option value="${g.id}" ${g.id === currentVal ? 'selected' : ''}>${g.id} — ${g.title.slice(0, 45)}... [${g.status}]</option>`)
    .join('');

  if (!selectedTicketId && allGrievances.length > 0) {
    selectedTicketId = allGrievances[0].id;
  }

  const selected = allGrievances.find((g) => g.id === selectedTicketId) || allGrievances[0];
  if (selected) renderCitizenSelectedTicket(selected);
}

function renderCitizenSelectedTicket(ticket) {
  const container = document.getElementById('citizenTicketDetails');

  // Compute completed timeline steps
  const steps = [
    { state: 'SUBMITTED', label: '1. Registered by Citizen' },
    { state: 'TRIAGED', label: '2. Triage & Ward Verification' },
    { state: 'ASSIGNED', label: '3. Dispatched to Field Engineer' },
    { state: 'IN_PROGRESS', label: '4. Physical Work In Progress' },
    { state: 'INSPECTION_PENDING', label: '5. Work Done & Inspection' },
    { state: 'RESOLVED', label: '6. Officer Sign-off' },
    { state: 'CITIZEN_CONFIRMED', label: '7. Citizen Confirmed' },
  ];

  const stateOrder = steps.map((s) => s.state);
  const currentIndex = stateOrder.indexOf(ticket.status);

  const timelineHtml = steps
    .map((step, idx) => {
      const isDone = idx <= currentIndex && ticket.status !== 'REJECTED_INVALID';
      const isActive = idx === currentIndex;
      return `
      <div class="timeline-step ${isDone ? 'completed' : ''} ${isActive ? 'active' : ''}">
        <div class="step-marker">${isDone ? '✓' : idx + 1}</div>
        <div class="step-content">
          <div class="step-title">${step.label}</div>
          <div class="step-time">${isActive ? 'Current Active Step' : isDone ? 'Completed' : 'Pending'}</div>
        </div>
      </div>
    `;
    })
    .join('');

  // Citizen Action buttons (if RESOLVED -> allow Confirm or Reopen)
  let citizenActionsHtml = '';
  if (ticket.status === 'RESOLVED') {
    citizenActionsHtml = `
      <div style="margin-top: 1.4rem; padding: 1rem; background: rgba(16, 185, 129, 0.12); border-radius: 8px;">
        <h4 style="color: #6ee7b7; margin-bottom: 0.5rem;">Citizen Satisfaction Sign-off:</h4>
        <p style="font-size: 0.85rem; color: #9ca3af; margin-bottom: 0.8rem;">Field work has been completed and verified by the Ward Officer. Are you satisfied with the resolution?</p>
        <div style="display: flex; gap: 0.6rem;">
          <button class="btn btn-success" onclick="window.govFix.transition('${ticket.id}', 'CITIZEN_CONFIRMED', 'CITIZEN', 'CITIZEN')">✓ Yes, Confirm Resolution</button>
          <button class="btn btn-danger" onclick="window.govFix.citizenReopen('${ticket.id}')">✗ No, Reopen with Feedback</button>
        </div>
      </div>
    `;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.8rem;">
      <span class="ticket-id" style="font-size: 1rem;">Ticket #${ticket.id}</span>
      <span class="badge-state state-${ticket.status}">${ticket.status}</span>
    </div>
    <h3 style="font-size: 1.1rem; color: #fff; margin-bottom: 0.4rem;">${ticket.title}</h3>
    <p style="font-size: 0.85rem; color: #9ca3af; margin-bottom: 1rem;">${ticket.description}</p>
    
    <div class="ai-grid" style="background: rgba(255,255,255,0.02); padding: 0.8rem; border-radius: 8px; margin-bottom: 1rem;">
      <div><span class="ai-item-label">Ward:</span> <span class="ai-item-val">${ticket.ward}</span></div>
      <div><span class="ai-item-label">Priority:</span> <span class="ai-item-val">${ticket.urgency}</span></div>
      <div><span class="ai-item-label">SLA Remaining:</span> <span class="ai-item-val" style="color: ${ticket.slaMetrics?.isOverdue ? '#ef4444' : '#10b981'}">${ticket.slaMetrics?.remainingHours} hrs</span></div>
      <div><span class="ai-item-label">Assigned Field Engineer:</span> <span class="ai-item-val">${ticket.assignedEngineerId || 'Unassigned'}</span></div>
    </div>

    ${citizenActionsHtml}

    <div class="timeline">${timelineHtml}</div>
  `;
}

// ==============================================================================
// TAB 2: Ward Officer Desk
// ==============================================================================
function renderOfficerQueue() {
  const container = document.getElementById('officerTicketList');
  document.getElementById('officerCountBadge').textContent = allGrievances.length;
  document.getElementById('officerFilterCount').textContent = `${allGrievances.length} Tickets`;

  container.innerHTML = allGrievances
    .map((ticket) => {
      const isSelected = ticket.id === selectedTicketId;
      return `
      <div class="ticket-card-item ${isSelected ? 'selected' : ''}" onclick="window.govFix.selectOfficerTicket('${ticket.id}')">
        <div class="ticket-item-head">
          <span class="ticket-id">${ticket.id}</span>
          <span class="badge-state state-${ticket.status}">${ticket.status}</span>
        </div>
        <div class="ticket-title">${ticket.title}</div>
        <div class="ticket-meta-line">
          <span>📍 ${ticket.ward}</span>
          <span style="color: ${ticket.slaMetrics?.isOverdue ? '#ef4444' : '#9ca3af'}">⏱️ ${ticket.slaMetrics?.remainingHours}h remaining</span>
        </div>
      </div>
    `;
    })
    .join('');

  const selected = allGrievances.find((g) => g.id === selectedTicketId) || allGrievances[0];
  if (selected) renderOfficerActionPane(selected);
}

function renderOfficerActionPane(ticket) {
  const container = document.getElementById('officerActionPane');
  document.getElementById('selectedTicketStatusBadge').textContent = ticket.status;
  document.getElementById('selectedTicketStatusBadge').className = `badge-state state-${ticket.status}`;

  // Duplicate warning
  let dupHtml = '';
  if (ticket.aiDuplicates?.hasPotentialDuplicate) {
    dupHtml = `<div class="duplicate-banner">⚠️ ${ticket.aiDuplicates.warning}</div>`;
  }

  // Work notes / Inspection notes
  let notesHtml = '';
  if (ticket.workNotes) {
    notesHtml += `<div style="margin: 0.8rem 0; padding: 0.6rem; background: rgba(255,255,255,0.03); border-radius: 6px;"><strong style="font-size:0.8rem; color:#fcd34d;">Field Work Notes:</strong> <span style="font-size:0.85rem;">${ticket.workNotes}</span></div>`;
  }
  if (ticket.inspectionNotes) {
    notesHtml += `<div style="margin: 0.8rem 0; padding: 0.6rem; background: rgba(255,255,255,0.03); border-radius: 6px;"><strong style="font-size:0.8rem; color:#6ee7b7;">Inspection Sign-off Notes:</strong> <span style="font-size:0.85rem;">${ticket.inspectionNotes}</span></div>`;
  }

  // Actions based on current FSM status
  let actionButtons = '';
  if (ticket.status === 'SUBMITTED' || ticket.status === 'REOPENED') {
    actionButtons = `
      <div style="display: flex; gap: 0.6rem; margin-top: 1rem;">
        <button class="btn btn-primary" onclick="window.govFix.officerTriage('${ticket.id}')">✓ Verify & Move to TRIAGED</button>
        <button class="btn btn-danger" onclick="window.govFix.officerReject('${ticket.id}')">✗ Reject Invalid</button>
      </div>
    `;
  } else if (ticket.status === 'TRIAGED' || ticket.status === 'ESCALATED_L1') {
    actionButtons = `
      <div style="margin-top: 1rem;">
        <label style="font-size: 0.82rem; font-weight: 600; color: #9ca3af; margin-bottom: 0.3rem; display:block;">Select Field Engineer for Ward Dispatch:</label>
        <div style="display: flex; gap: 0.6rem;">
          <select id="selectAssignee_${ticket.id}" class="form-select" style="max-width: 260px;">
            <option value="ENG_VINAYAK_04">Eng. Vinayak (Roads & Potholes)</option>
            <option value="ENG_SHANKAR_01">Eng. Shankar (Water & Sewage)</option>
            <option value="ENG_GANESH_09">Eng. Ganesh (Solid Waste)</option>
            <option value="ENG_VIJAY_03">Eng. Vijay (Electrical Hazards)</option>
          </select>
          <button class="btn btn-primary" onclick="window.govFix.officerAssign('${ticket.id}')">Dispatch & Mark ASSIGNED</button>
        </div>
      </div>
    `;
  } else if (ticket.status === 'ASSIGNED') {
    actionButtons = `
      <div style="margin-top: 1rem;">
        <button class="btn btn-warning" onclick="window.govFix.transition('${ticket.id}', 'IN_PROGRESS', 'FIELD_ENGINEER', 'FIELD_ENGINEER')">👷 [Simulate Engineer] Acknowledge & Start Work (IN_PROGRESS)</button>
      </div>
    `;
  } else if (ticket.status === 'IN_PROGRESS' || ticket.status === 'ESCALATED_L2') {
    actionButtons = `
      <div style="margin-top: 1rem;">
        <button class="btn btn-warning" onclick="window.govFix.engineerCompleteWork('${ticket.id}')">📝 [Simulate Engineer] Upload Work Proof (INSPECTION_PENDING)</button>
      </div>
    `;
  } else if (ticket.status === 'INSPECTION_PENDING') {
    actionButtons = `
      <div style="margin-top: 1rem;">
        <button class="btn btn-success" onclick="window.govFix.officerInspectAndResolve('${ticket.id}')">🔍 Inspect On-Site & Mark RESOLVED</button>
      </div>
    `;
  } else {
    actionButtons = `<div style="margin-top: 1rem; color: #6ee7b7; font-size: 0.85rem;">✓ Ticket is in final state: ${ticket.status}</div>`;
  }

  container.innerHTML = `
    <h3 style="font-size: 1.15rem; color: #fff; margin-bottom: 0.4rem;">${ticket.title}</h3>
    <p style="font-size: 0.88rem; color: #9ca3af; margin-bottom: 1rem;">${ticket.description}</p>
    
    <!-- Side-by-side Non-Binding AI Suggestion Box -->
    <div class="ai-recommendation-box">
      <div class="ai-head">
        <span class="ai-title">🤖 AI Triaging Analysis (FreeLLMAPI)</span>
        <span class="ai-non-binding">Non-Binding Recommendation</span>
      </div>
      <div class="ai-grid">
        <div><span class="ai-item-label">Predicted Category:</span> <span class="ai-item-val">${ticket.aiRecommendation?.category || ticket.category}</span></div>
        <div><span class="ai-item-label">Urgency Score:</span> <span class="ai-item-val">${ticket.aiRecommendation?.urgency || ticket.urgency}</span></div>
        <div><span class="ai-item-label">Target Ward:</span> <span class="ai-item-val">${ticket.aiRecommendation?.ward || ticket.ward}</span></div>
        <div><span class="ai-item-label">Detected Language:</span> <span class="ai-item-val">${ticket.aiRecommendation?.detectedLanguage || 'English'}</span></div>
      </div>
      ${dupHtml}
    </div>

    ${notesHtml}

    <div style="border-top: 1px solid var(--border-color); padding-top: 1rem;">
      <h4 style="font-size: 0.9rem; color: #fff; margin-bottom: 0.4rem;">Permitted Administrative Transitions:</h4>
      ${actionButtons}
    </div>
  `;
}

// ==============================================================================
// TAB 3: Commissioner War Room
// ==============================================================================
function renderCommissionerWarRoom() {
  const total = allGrievances.length;
  const l1 = allGrievances.filter((g) => g.status === 'ESCALATED_L1').length;
  const l2 = allGrievances.filter((g) => g.status === 'ESCALATED_L2').length;
  const resolved = allGrievances.filter((g) => g.status === 'RESOLVED' || g.status === 'CITIZEN_CONFIRMED').length;

  document.getElementById('metricTotal').textContent = total;
  document.getElementById('metricL1').textContent = l1;
  document.getElementById('metricL2').textContent = l2;
  document.getElementById('metricResolved').textContent = resolved;
  document.getElementById('escalationCountBadge').textContent = l1 + l2;

  const escalatedTickets = allGrievances.filter((g) => g.status === 'ESCALATED_L1' || g.status === 'ESCALATED_L2' || g.slaMetrics?.isOverdue);
  const tableBody = document.getElementById('commissionerEscalationTable');

  if (escalatedTickets.length === 0) {
    tableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: #6ee7b7; padding: 1.5rem;">🎉 Zero SLA breaches across all Pune wards. All tickets currently on track! (Advance simulation time in Tab 4 to test auto-escalation).</td></tr>`;
    return;
  }

  tableBody.innerHTML = escalatedTickets
    .map((t) => `
    <tr>
      <td class="ticket-id">${t.id}</td>
      <td><strong>${t.ward}</strong><br><small style="color: #9ca3af;">${t.location}</small></td>
      <td>${t.category}</td>
      <td><span class="badge-offset">${t.urgency}</span></td>
      <td><span class="badge-state state-${t.status}">${t.status}</span></td>
      <td style="color: ${t.slaMetrics?.isOverdue ? '#ef4444' : '#f59e0b'}; font-weight: 700;">
        ${t.slaMetrics?.isOverdue ? '⚠️ Overdue' : `${t.slaMetrics?.remainingHours}h remaining`}
      </td>
      <td>
        <button class="btn btn-sm btn-danger" onclick="window.govFix.commissionerIntervene('${t.id}')">⚡ Commissioner Force Resolve</button>
      </td>
    </tr>
  `)
    .join('');
}

// ==============================================================================
// TAB 4: Judge Simulator & Chaos Panel
// ==============================================================================
function renderJudgeSelectors() {
  const selector = document.getElementById('judgeTicketSelector');
  const currentVal = selector.value || selectedTicketId;

  selector.innerHTML = allGrievances
    .map((g) => `<option value="${g.id}" ${g.id === currentVal ? 'selected' : ''}>${g.id} [State: ${g.status}] — ${g.title.slice(0, 40)}</option>`)
    .join('');
}

function initJudgeControls() {
  // Top Navbar fast-forward buttons
  document.getElementById('btnTimeTravel12').addEventListener('click', () => advanceTime(12));
  document.getElementById('btnTimeTravel24').addEventListener('click', () => advanceTime(24));
  document.getElementById('btnTimeTravel48').addEventListener('click', () => advanceTime(48));
  document.getElementById('btnTimeReset').addEventListener('click', () => resetTime());

  // Judge Transition execution
  document.getElementById('btnExecuteJudgeTransition').addEventListener('click', async () => {
    const ticketId = document.getElementById('judgeTicketSelector').value;
    const role = document.getElementById('judgeRoleSelector').value;
    const targetState = document.getElementById('judgeTargetStateSelector').value;

    const payload = {
      targetState,
      actor: `JUDGE_SIMULATOR_${role}`,
      role,
      payload: {},
    };

    const resultBox = document.getElementById('judgeTransitionResult');
    resultBox.classList.remove('hidden');

    try {
      const res = await fetch(`/api/grievances/${ticketId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();

      if (data.refused) {
        // Refusal caught correctly!
        resultBox.className = 'judge-result-box refused';
        resultBox.innerHTML = `
          <strong style="color: #ef4444;">🛡️ TRANSITION REFUSED (FSM RULE ENFORCED):</strong><br>
          <strong>Violation Code:</strong> <code>${data.code}</code><br>
          <strong>Reason:</strong> ${data.reason}<br>
          <strong>Audit Hash:</strong> <code style="font-size: 0.75rem;">${data.auditHash}</code>
        `;
        showToast(`🛡️ Blocked with code ${data.code}`, true);
      } else {
        resultBox.className = 'judge-result-box accepted';
        resultBox.innerHTML = `
          <strong style="color: #10b981;">✓ TRANSITION ACCEPTED:</strong><br>
          State changed to <strong>${data.ticket.status}</strong>.<br>
          <strong>Audit Hash:</strong> <code style="font-size: 0.75rem;">${data.auditHash}</code>
        `;
        showToast('✓ Transition accepted & cryptographically signed');
      }

      await fetchGrievances();
    } catch (err) {
      resultBox.innerHTML = 'Network error: ' + err.message;
    }
  });

  // Audit verify button
  document.getElementById('btnVerifyChain').addEventListener('click', async () => {
    await fetchAuditLedger(true);
  });
}

async function advanceTime(hours) {
  try {
    const res = await fetch('/api/simulation/time-travel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ hours }),
    });
    const data = await res.json();

    const feed = document.getElementById('judgeEscalationFeed');
    if (data.escalationsTriggered.length > 0) {
      feed.innerHTML = data.escalationsTriggered
        .map((e) => `<div style="color: #f87171;">🚨 Auto-Escalated: <strong>${e.id}</strong> to Tier ${e.level} (${e.title})</div>`)
        .join('');
      showToast(`⏱️ Advanced +${hours}h: ${data.escalationsTriggered.length} SLA breach(es) escalated!`, true);
    } else {
      feed.innerHTML = `<div style="color: #6ee7b7;">✓ Advanced +${hours}h. Checked SLA deadlines. Zero new breaches.</div>`;
      showToast(`⏱️ Advanced simulation clock by +${hours} hours.`);
    }

    await fetchGrievances();
  } catch (err) {
    console.error(err);
  }
}

async function resetTime() {
  try {
    await fetch('/api/simulation/time-travel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reset: true }),
    });
    showToast('⏱️ Simulation clock reset to current real time.');
    await fetchGrievances();
  } catch (err) {
    console.error(err);
  }
}

async function fetchAuditLedger(showExplicitSuccess = false) {
  try {
    const res = await fetch('/api/audit');
    if (!res.ok) return;
    const data = await res.json();

    const banner = document.getElementById('auditBannerText');
    if (data.verification.valid) {
      banner.textContent = `Cryptographic SHA-256 Hash Chain Valid! All ${data.chainLength} blocks intact. Latest Hash: ${data.verification.latestHash.slice(0, 16)}...`;
      if (showExplicitSuccess) {
        showToast('🔐 Cryptographic Integrity Verified: Zero Tampering Detected!');
      }
    } else {
      banner.textContent = `⚠️ Tamper alert: ${data.verification.reason}`;
    }

    const tableBody = document.getElementById('auditLedgerTableBody');
    tableBody.innerHTML = data.ledger
      .slice(0, 15) // Show top 15
      .map((entry) => `
      <tr>
        <td>#${entry.index}</td>
        <td>${new Date(entry.timestamp).toLocaleTimeString()}</td>
        <td><span class="${entry.isRefusal ? 'refusal-highlight' : ''}">${entry.eventType}</span></td>
        <td>${entry.actor}<br><small style="color: #9ca3af;">[${entry.role}]</small></td>
        <td class="ticket-id">${entry.grievanceId}</td>
        <td style="max-width: 280px; font-size: 0.75rem;">${JSON.stringify(entry.details)}</td>
        <td class="hash-cell" title="${entry.hash}">${entry.hash}</td>
      </tr>
    `)
      .join('');
  } catch (err) {
    console.error('Audit fetch error:', err);
  }
}

// ==============================================================================
// Global Helper Handlers (Exposed on window.govFix)
// ==============================================================================
window.govFix = {
  selectOfficerTicket: (id) => {
    selectedTicketId = id;
    renderOfficerQueue();
  },

  transition: async (ticketId, targetState, actor, role, payload = {}) => {
    try {
      const res = await fetch(`/api/grievances/${ticketId}/transition`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetState, actor, role, payload }),
      });
      const data = await res.json();
      if (data.refused) {
        showToast(`🛡️ Refused: ${data.reason}`, true);
      } else {
        showToast(`✓ Ticket moved to ${data.ticket.status}`);
      }
      await fetchGrievances();
    } catch {
      showToast('❌ Transition failed', true);
    }
  },

  officerTriage: (id) => {
    const ticket = allGrievances.find((g) => g.id === id);
    window.govFix.transition(id, 'TRIAGED', 'OFFICER_DESHMUKH', 'WARD_OFFICER', {
      category: ticket.aiRecommendation?.category || ticket.category,
      ward: ticket.aiRecommendation?.ward || ticket.ward,
      urgency: ticket.aiRecommendation?.urgency || ticket.urgency,
    });
  },

  officerReject: (id) => {
    const reason = prompt('Please enter explicit reason for rejecting grievance (min 5 chars):');
    if (!reason) return;
    window.govFix.transition(id, 'REJECTED_INVALID', 'OFFICER_DESHMUKH', 'WARD_OFFICER', {
      rejectionReason: reason,
    });
  },

  officerAssign: (id) => {
    const select = document.getElementById(`selectAssignee_${id}`);
    const engineerId = select ? select.value : 'ENG_VINAYAK_04';
    window.govFix.transition(id, 'ASSIGNED', 'OFFICER_DESHMUKH', 'WARD_OFFICER', {
      assignedEngineerId: engineerId,
    });
  },

  engineerCompleteWork: (id) => {
    const notes = prompt('Enter Field Work Completion Notes / Proof of resolution:', 'Work completed on site. Asphalt patch laid and compacted.');
    if (!notes) return;
    window.govFix.transition(id, 'INSPECTION_PENDING', 'FIELD_ENGINEER_VINAYAK', 'FIELD_ENGINEER', {
      workNotes: notes,
    });
  },

  officerInspectAndResolve: (id) => {
    const notes = prompt('Enter Ward Officer Inspection Sign-off Notes:', 'Inspected on-site by Ward Officer. Standard quality met.');
    if (!notes) return;
    window.govFix.transition(id, 'RESOLVED', 'OFFICER_DESHMUKH', 'WARD_OFFICER', {
      inspectionNotes: notes,
    });
  },

  citizenReopen: (id) => {
    const reason = prompt('Please explain why the resolution is incomplete:');
    if (!reason) return;
    window.govFix.transition(id, 'REOPENED', 'CITIZEN', 'CITIZEN', {
      reopenReason: reason,
    });
  },

  commissionerIntervene: (id) => {
    window.govFix.transition(id, 'RESOLVED', 'COMMISSIONER_PUNE', 'SUPERVISING_COMMISSIONER', {
      inspectionNotes: 'Emergency intervention by Municipal Commissioner. Work authorized and closed on priority.',
    });
  },

  advanceTime,
  resetTime,
};

function showToast(message, isError = false) {
  const toast = document.getElementById('toastNotification');
  toast.textContent = message;
  toast.style.borderColor = isError ? '#ef4444' : '#10b981';
  toast.classList.remove('hidden');

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 4000);
}
