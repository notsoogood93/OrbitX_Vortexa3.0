/**
 * GovFix Multilingual AI Copilot Sidecar
 * Connects to FreeLLMAPI router (http://localhost:3001/v1) with robust local heuristic fallback.
 * Tailored for University Service Requests (DY Patil Campus: Maintenance, IT Labs, AV, Facilities)
 * Adheres strictly to hackathon rule: AI informs decisions, never silently overrides them.
 */

export const UNIVERSITY_CATEGORIES = [
  'Academic IT & Computing Systems',
  'Campus Infrastructure & Maintenance',
  'Electrical & Power Safety',
  'Network & Connectivity',
  'Classroom & AV Facilities',
];

export const CAMPUS_ROOMS = [
  'Lab 304 - Computer Engineering',
  'Workshop W201 - Mechanical Engineering',
  'Seminar Hall 2 - Central Campus',
  'Electrical Lab 102 - High Voltage',
  'Hostel Block B - Floor 4',
  'Central Library - 2nd Floor',
  'Administration Block - Registrar Wing',
];

export class AICopilotService {
  constructor(options = {}) {
    this.routerBaseUrl = options.baseUrl || process.env.FREELLMAPI_URL || 'http://localhost:3001/v1';
    this.apiKey = options.apiKey || process.env.FREELLMAPI_API_KEY || 'freellmapi-f7137a5650227eb69df9e3a9e17eed46cdb1bb7f8f17e331';
  }

  /**
   * Main entrypoint: analyzes campus or municipal request text
   */
  async analyzeGrievance(rawText, existingTickets = []) {
    let result = null;

    // 1. Try querying FreeLLMAPI router first
    try {
      result = await this.queryRouter(rawText);
    } catch {
      // FreeLLMAPI offline or unreachable -> use deterministic local NLP fallback
      result = this.localFallbackAnalysis(rawText);
    }

    // 2. Perform duplicate & room-level recurrence check
    const recurrenceCheck = this.detectRecurrenceAndDuplicates(result, existingTickets);

    // 3. Draft official work order notes
    const drafts = this.generateDraftResponses(result, rawText);

    return {
      extracted: result,
      duplicates: recurrenceCheck,
      recurrence: recurrenceCheck,
      drafts,
      meta: {
        isAiRecommendation: true,
        enforcementRule: 'NON_BINDING_SUGGESTION',
        disclaimer: 'AI predictions are advisory decision support and require human supervisor confirmation.',
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Call FreeLLMAPI router
   */
  async queryRouter(text) {
    const prompt = `You are a university facilities and IT service triage expert for Dr. D. Y. Patil Institute of Technology (DY Patil Campus).
Analyze this campus service request:
"${text}"

Return ONLY valid JSON with:
{
  "category": (One of: "Academic IT & Computing Systems", "Campus Infrastructure & Maintenance", "Electrical & Power Safety", "Network & Connectivity", "Classroom & AV Facilities"),
  "urgency": (One of: "EMERGENCY", "HIGH", "STANDARD", "ROUTINE"),
  "roomId": "extracted room name/number (e.g. Lab 304, Seminar Hall 2, Hostel Block B, Library 2F)",
  "assetId": "extracted asset (e.g. GPU-WORKSTATION-08, CEILING-PROJECTOR, LATHE-MOTOR-03, WIFI-AP)",
  "suggestedDepartment": "Computer Engineering / Mechanical Engineering / Campus Estate / Central IT",
  "suggestedOfficer": "TECH_IT_SUPPORT_03 / TECH_ELECTRICAL_01 / TECH_NETWORKING_02 / TECH_CIVIL_04",
  "summary": "1 sentence concise summary",
  "detectedLanguage": "English/Marathi/Hindi"
}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);

    const response = await fetch(`${this.routerBaseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'auto',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
      }),
      signal: controller.signal,
    });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`Router error ${response.status}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content?.trim() || '';
    const cleanJson = content.replace(/```json/g, '').replace(/```/g, '').trim();
    return JSON.parse(cleanJson);
  }

  /**
   * Deterministic local fallback (Guarantees 100% offline uptime and zero-failure testing)
   */
  localFallbackAnalysis(text) {
    const lower = text.toLowerCase();
    let category = 'Academic IT & Computing Systems';
    let urgency = 'STANDARD';
    let roomId = 'Lab 304 - Computer Engineering';
    let assetId = 'DYP-ASSET-GENERIC';
    let suggestedDepartment = 'Computer Engineering';
    let suggestedOfficer = 'TECH_IT_SUPPORT_03';
    let detectedLanguage = 'English';

    // Language detection
    if (/[\u0900-\u097F]/.test(text)) {
      detectedLanguage = text.includes('आहे') || text.includes('खड्डा') ? 'Marathi' : 'Hindi';
    }

    // Room detection heuristics
    if (lower.includes('seminar') || lower.includes('hall 2') || lower.includes('projector')) {
      roomId = 'Seminar Hall 2 - Central Campus';
      suggestedDepartment = 'Central Campus Facilities';
    } else if (lower.includes('mech') || lower.includes('lathe') || lower.includes('workshop')) {
      roomId = 'Workshop W201 - Mechanical Engineering';
      suggestedDepartment = 'Mechanical Engineering';
    } else if (lower.includes('electrical') || lower.includes('voltage') || lower.includes('bench')) {
      roomId = 'Electrical Lab 102 - High Voltage';
      suggestedDepartment = 'Electrical Engineering';
    } else if (lower.includes('hostel') || lower.includes('plumbing') || lower.includes('water')) {
      roomId = 'Hostel Block B - Floor 4';
      suggestedDepartment = 'Campus Estate / Facilities';
    } else if (lower.includes('library') || lower.includes('wifi') || lower.includes('wi-fi')) {
      roomId = 'Central Library - 2nd Floor';
      suggestedDepartment = 'Central IT Services';
    } else if (lower.includes('lab 304') || lower.includes('gpu') || lower.includes('workstation')) {
      roomId = 'Lab 304 - Computer Engineering';
      suggestedDepartment = 'Computer Engineering';
    }

    // Category & Urgency heuristics
    if (lower.includes('spark') || lower.includes('voltage') || lower.includes('shock') || lower.includes('hazard') || lower.includes('current')) {
      category = 'Electrical & Power Safety';
      urgency = 'EMERGENCY';
      assetId = 'HIGH-VOLTAGE-BENCH-02';
      suggestedOfficer = 'TECH_ELECTRICAL_01';
    } else if (lower.includes('wifi') || lower.includes('wi-fi') || lower.includes('internet') || lower.includes('network') || lower.includes('router')) {
      category = 'Network & Connectivity';
      urgency = 'HIGH';
      assetId = 'CISCO-AP-LIB-204';
      suggestedOfficer = 'TECH_NETWORKING_02';
    } else if (lower.includes('projector') || lower.includes('display') || lower.includes('hdmi') || lower.includes('screen') || lower.includes('mic')) {
      category = 'Classroom & AV Facilities';
      urgency = 'STANDARD';
      assetId = 'EPSON-PROJECTOR-SH2';
      suggestedOfficer = 'TECH_AV_SUPPORT_05';
    } else if (lower.includes('water') || lower.includes('leak') || lower.includes('pipe') || lower.includes('pump') || lower.includes('flush')) {
      category = 'Campus Infrastructure & Maintenance';
      urgency = 'HIGH';
      assetId = 'WATER-PUMP-HB4';
      suggestedOfficer = 'TECH_PLUMBING_03';
    } else if (lower.includes('gpu') || lower.includes('server') || lower.includes('pc') || lower.includes('workstation') || lower.includes('crash')) {
      category = 'Academic IT & Computing Systems';
      urgency = lower.includes('server') || lower.includes('gpu') ? 'HIGH' : 'STANDARD';
      assetId = 'GPU-RIG-RTX4090-07';
      suggestedOfficer = 'TECH_IT_SUPPORT_03';
    }

    return {
      category,
      urgency,
      roomId,
      assetId,
      suggestedDepartment,
      suggestedOfficer,
      ward: roomId, // backward compatibility with municipal views
      location: roomId,
      summary: text.slice(0, 80) + '...',
      detectedLanguage,
      source: 'Deterministic Campus Heuristic Engine',
    };
  }

  /**
   * Detects duplicate or recurrent issues within the same room / asset
   */
  detectRecurrenceAndDuplicates(extracted, existingTickets = []) {
    const matchingRoomTickets = existingTickets.filter(
      (t) => (t.roomId === extracted.roomId || t.ward === extracted.roomId || t.category === extracted.category) &&
             t.status !== 'CLOSED' && t.status !== 'RESOLVED'
    );

    if (matchingRoomTickets.length > 0) {
      return {
        hasPotentialDuplicate: true,
        hasRecurrence: true,
        matchCount: matchingRoomTickets.length,
        matchedTickets: matchingRoomTickets.map((t) => ({ id: t.id, title: t.title, status: t.status, roomId: t.roomId })),
        warning: `Recurrence Alert: ${matchingRoomTickets.length} active request(s) already logged in '${extracted.roomId}' for '${extracted.category}'. Check for chronic equipment failure.`,
      };
    }

    return {
      hasPotentialDuplicate: false,
      hasRecurrence: false,
      matchCount: 0,
      matchedTickets: [],
    };
  }

  /**
   * Generates formal work orders and requester notifications
   */
  generateDraftResponses(extracted, rawText) {
    return {
      internalWorkOrderNote: `[GovFix Campus Work Order]\nLocation: ${extracted.roomId}\nAsset: ${extracted.assetId}\nCategory: ${extracted.category} (${extracted.urgency} Priority)\nDepartment: ${extracted.suggestedDepartment}\nAssigned Tech: ${extracted.suggestedOfficer}\nAction: On-site verification and physical repair required within SLA window.`,
      citizenEnglishDraft: `Hello Requester, your campus service request for '${extracted.category}' at '${extracted.roomId}' has been officially logged. Assigned to ${extracted.suggestedOfficer} with priority '${extracted.urgency}'.`,
      citizenMarathiDraft: `नमस्कार, तुमची तक्रार (${extracted.category} - ${extracted.roomId}) प्रणालीमध्ये नोंदवली गेली आहे. संबंधित तंत्रज्ञ लवकरच तपासणी करतील.`,
    };
  }
}
