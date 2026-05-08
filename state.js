// ============================================================
// STATE.JS — Centralised, isolated state management
// ============================================================

// Default empty onboarding payload (matches backend schema exactly)
const DEFAULT_FORM_DATA = () => ({
  startup_basics: {
    idea_description: '',
    problem_statement: '',
    target_user: '',
    solution_description: '',
    github_link: '',
    website_link: '',
    demo_link: '',
  },
  problem_clarity: {
    problem_definition_score: 1,
    target_user_clarity_score: 1,
    frequency_score: 1,
    severity_score: 1,
  },
  validation: {
    users_spoken_to: 1,
    user_type_score: 1,
    feedback_summary: '',
    pattern_score: 1,
    iteration_score: 1,
  },
  build: {
    build_stage: 1,
    accessibility_score: 1,
    development_activity_score: 1,
  },
  traction: {
    user_count: 1,
    engagement_score: 1,
    feedback_summary: '',
    traction_signal_score: 1,
  },
  funding_readiness: {
    market_understanding_score: 1,
    business_model_score: 1,
    founder_strength: '',
    funding_history_score: 1,
  },
});

// App state — NOT exported directly; accessed via getters/setters
let _state = {
  currentStep: 0,
  totalSteps: 6,
  formData: DEFAULT_FORM_DATA(),

  // Analysis results (set after fetch)
  userId: null,
  analysis: null,
  aiInsights: null,

  // UI state
  isSubmitting: false,
  lastError: null,
  lastAttemptedAction: null, // for retry
};

// ── Getters ──
export const State = {
  get currentStep() { return _state.currentStep; },
  get totalSteps() { return _state.totalSteps; },
  get formData() { return _state.formData; },
  get userId() { return _state.userId; },
  get analysis() { return _state.analysis; },
  get aiInsights() { return _state.aiInsights; },
  get isSubmitting() { return _state.isSubmitting; },
  get lastError() { return _state.lastError; },
  get lastAttemptedAction() { return _state.lastAttemptedAction; },

  // ── Setters ──
  setStep(step) {
    _state.currentStep = Math.max(0, Math.min(step, _state.totalSteps - 1));
  },

  setFormSection(sectionKey, data) {
    if (!(_state.formData.hasOwnProperty(sectionKey))) {
      console.warn(`[State] Unknown section: ${sectionKey}`);
      return;
    }
    _state.formData[sectionKey] = { ..._state.formData[sectionKey], ...data };
  },

  setFormField(sectionKey, fieldKey, value) {
    if (_state.formData[sectionKey] !== undefined) {
      _state.formData[sectionKey][fieldKey] = value;
    }
  },

  setUserId(id) { _state.userId = id; },
  setAnalysis(data) { _state.analysis = data; },
  setAiInsights(data) { _state.aiInsights = data; },
  setSubmitting(bool) { _state.isSubmitting = bool; },
  setError(message, action = null) {
    _state.lastError = message;
    _state.lastAttemptedAction = action;
  },
  clearError() {
    _state.lastError = null;
    _state.lastAttemptedAction = null;
  },

  // ── Reset ──
  reset() {
    _state = {
      currentStep: 0,
      totalSteps: 6,
      formData: DEFAULT_FORM_DATA(),
      userId: null,
      analysis: null,
      aiInsights: null,
      isSubmitting: false,
      lastError: null,
      lastAttemptedAction: null,
    };
  },

  // ── Snapshot (read-only copy for API submission) ──
  getPayload() {
    return JSON.parse(JSON.stringify(_state.formData));
  },
};
