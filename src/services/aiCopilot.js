/**
 * GovFix Multilingual AI Copilot Sidecar
 * Connects to FreeLLMAPI router (http://localhost:3001/v1) with robust local heuristic fallback.
 * Adheres strictly to hackathon rule: AI informs decisions, never silently overrides them.
 */

const PUNE_WARDS = [
  'Baner - Balewadi',
  'Kothrud - Bavdhan',
  'Hinjawadi - Wakad',
  'Shivajinagar - Deccan',
  'Hadapsar - Magarpatta',
  'Pimpri - Chinchwad Central',
  'Viman Nagar - Kharadi',
  'Aundh - University',
];

const CATEGORIES = [
  'Roads & Potholes',
  'Water Supply & Contamination',
  'Drainage & Sewage Leakage',
  'Streetlights & Electrical Hazards',
  'Garbage & Solid Waste',
  'Stray Animals & Public Nuisance',
];

export class AICopilotService {
  constructor(options = {}) {
    this.routerBaseUrl = options.baseUrl || process.env.FREELLMAPI_URL || 'http://localhost:3001/v1';
    this.apiKey = options.apiKey || process.env.FREELLMAPI_API_KEY || 'freellmapi-f7137a5650227eb69df9e3a9e17eed46cdb1bb7f8f17e331';
  }

  /**
   * Main entrypoint: analyzes grievance text in Marathi, Hindi, or English
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

    // 2. Perform duplicate & proximity cluster check
    const duplicateCheck = this.detectDuplicatesAndClustering(result, existingTickets);

    // 3. Draft official notes
    const drafts = this.generateDraftResponses(result, rawText);

    return {
      extracted: result,
      duplicates: duplicateCheck,
      drafts,
      meta: {
        isAiRecommendation: true,
        enforcementRule: 'NON_BINDING_SUGGESTION',
        disclaimer: 'AI predictions are advisory decision support and require human officer confirmation.',
        timestamp: new Date().toISOString(),
      },
    };
  }

  /**
   * Call FreeLLMAPI router
   */
  async queryRouter(text) {
    const prompt = `You are a municipal triage expert for Pune Municipal Corporation (PMC/PCMC).
Analyze this grievance (written in Marathi, Hindi, or English):
"${text}"

Return ONLY valid JSON with:
{
  "category": (One of: "Roads & Potholes", "Water Supply & Contamination", "Drainage & Sewage Leakage", "Streetlights & Electrical Hazards", "Garbage & Solid Waste", "Stray Animals & Public Nuisance"),
  "urgency": (One of: "EMERGENCY", "HIGH", "STANDARD", "ROUTINE"),
  "ward": (One of: "Baner - Balewadi", "Kothrud - Bavdhan", "Hinjawadi - Wakad", "Shivajinagar - Deccan", "Hadapsar - Magarpatta", "Pimpri - Chinchwad Central", "Viman Nagar - Kharadi", "Aundh - University"),
  "location": "extracted street/area name",
  "summary": "1 sentence concise summary",
  "detectedLanguage": "Marathi/Hindi/English"
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
   * Deterministic local fallback (Guarantees zero-failure live demo if API is offline)
   */
  localFallbackAnalysis(text) {
    const lower = text.toLowerCase();
    let category = 'Roads & Potholes';
    let urgency = 'STANDARD';
    let ward = 'Baner - Balewadi';
    let location = 'Pune Local Area';
    let detectedLanguage = 'English';

    // Language detection
    if (/[\u0900-\u097F]/.test(text)) {
      if (text.includes('आहे') || text.includes('झाला') || text.includes('खड्डा') || text.includes('पाणी')) {
        detectedLanguage = 'Marathi';
      } else {
        detectedLanguage = 'Hindi';
      }
    }

    // Category & Urgency heuristics
    if (lower.includes('water') || lower.includes('pipeline') || lower.includes('leak') || text.includes('पाणी') || text.includes('पाईप')) {
      category = 'Water Supply & Contamination';
      urgency = 'HIGH';
    } else if (lower.includes('light') || lower.includes('wire') || lower.includes('current') || text.includes('लाईट') || text.includes('तारा')) {
      category = 'Streetlights & Electrical Hazards';
      urgency = lower.includes('wire') || text.includes('तारा') ? 'EMERGENCY' : 'STANDARD';
    } else if (lower.includes('garbage') || lower.includes('trash') || lower.includes('waste') || text.includes('कचरा')) {
      category = 'Garbage & Solid Waste';
      urgency = 'ROUTINE';
    } else if (lower.includes('gutter') || lower.includes('drain') || lower.includes('sewage') || text.includes('गटार') || text.includes('सांडपाणी')) {
      category = 'Drainage & Sewage Leakage';
      urgency = 'HIGH';
    } else if (lower.includes('pothole') || lower.includes('road') || text.includes('खड्डा') || text.includes('रस्ता')) {
      category = 'Roads & Potholes';
      urgency = lower.includes('accident') || text.includes('अपघात') ? 'HIGH' : 'STANDARD';
    }

    // Ward heuristics
    if (lower.includes('kothrud') || text.includes('कोथरूड')) ward = 'Kothrud - Bavdhan';
    else if (lower.includes('hinjawadi') || lower.includes('wakad') || text.includes('हिंजवडी') || text.includes('वाकड')) ward = 'Hinjawadi - Wakad';
    else if (lower.includes('hadapsar') || lower.includes('magarpatta') || text.includes('हडपसर')) ward = 'Hadapsar - Magarpatta';
    else if (lower.includes('shivajinagar') || text.includes('शिवाजीनगर')) ward = 'Shivajinagar - Deccan';
    else if (lower.includes('pimpri') || lower.includes('chinchwad') || text.includes('पिंपरी')) ward = 'Pimpri - Chinchwad Central';
    else if (lower.includes('viman') || lower.includes('kharadi') || text.includes('विमाननगर')) ward = 'Viman Nagar - Kharadi';
    else if (lower.includes('aundh') || text.includes('औंध')) ward = 'Aundh - University';
    else if (lower.includes('baner') || text.includes('बाणेर')) ward = 'Baner - Balewadi';

    return {
      category,
      urgency,
      ward,
      location,
      summary: text.slice(0, 80) + '...',
      detectedLanguage,
      source: 'Deterministic Local Heuristic Fallback',
    };
  }

  /**
   * Detects duplicate / clustered complaints within the same ward & category
   */
  detectDuplicatesAndClustering(extracted, existingTickets = []) {
    const matchingWardTickets = existingTickets.filter(
      (t) => t.ward === extracted.ward && t.category === extracted.category && t.status !== 'RESOLVED'
    );

    if (matchingWardTickets.length > 0) {
      return {
        hasPotentialDuplicate: true,
        matchCount: matchingWardTickets.length,
        matchedTickets: matchingWardTickets.map((t) => ({ id: t.id, title: t.title, status: t.status })),
        warning: `Notice: ${matchingWardTickets.length} active issue(s) already reported in ${extracted.ward} for '${extracted.category}'. Avoid duplicate contractor dispatch.`,
      };
    }

    return {
      hasPotentialDuplicate: false,
      matchCount: 0,
      matchedTickets: [],
    };
  }

  /**
   * Generates bilingual drafts for internal work orders and citizen notifications
   */
  generateDraftResponses(extracted, rawText) {
    return {
      internalWorkOrderNote: `[GovFix AI Work Order Draft]\nWard: ${extracted.ward}\nCategory: ${extracted.category} (${extracted.urgency} Priority)\nSummary: ${extracted.summary}\nAction Required: Immediate on-site inspection and contractor allocation within SLA window.`,
      citizenMarathiDraft: `नमस्कार, तुमची तक्रार (${extracted.category}) आमच्या प्रणालीमध्ये नोंदवली गेली आहे. वॉर्ड: ${extracted.ward}. आमचे क्षेत्रीय अधिकारी यावर त्वरित कारवाई करत आहेत. धन्यवाद!`,
      citizenEnglishDraft: `Dear Citizen, your grievance regarding '${extracted.category}' in ${extracted.ward} has been officially recorded. Field inspection scheduled under SLA priority '${extracted.urgency}'.`,
    };
  }
}
