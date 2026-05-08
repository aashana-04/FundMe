// ============================================================
// WIZARD.JS — Builds all step panels, handles navigation + validation
// ============================================================

import { CONFIG } from './config.js';
import { State } from './state.js';
import {
  showScreen,
  setProgress,
  updateSidebarSteps,
  setNavButtons,
  qsa,
} from './ui.js';

// ── Panel builders ──
// Each returns an HTMLElement for the step.

function buildStep1() {
  const panel = createPanel(0);
  panel.innerHTML = buildStepHeader(0) + `
    <div class="question-group">
      <div class="question-block">
        <label class="question-label">Please describe what you are building?</label>
        <textarea
          class="form-textarea"
          id="idea_description"
          placeholder="e.g. An AI-powered tool that helps freelancers track invoices and automate follow-ups…"
          rows="3"
        >${State.formData.startup_basics.idea_description}</textarea>
        <span class="field-error" id="err-idea_description"></span>
      </div>

      <div class="question-block">
        <label class="question-label">What problem are you solving?</label>
        <textarea
          class="form-textarea"
          id="problem_statement"
          placeholder="Describe the specific pain point your startup addresses…"
          rows="3"
        >${State.formData.startup_basics.problem_statement}</textarea>
        <span class="field-error" id="err-problem_statement"></span>
      </div>

      <div class="question-block">
        <label class="question-label">Who is your target user?</label>
        <input
          class="form-input"
          id="target_user"
          type="text"
          placeholder="e.g. Freelance designers aged 25–40 in the US"
          value="${esc(State.formData.startup_basics.target_user)}"
        />
        <span class="field-error" id="err-target_user"></span>
      </div>

      <div class="question-block">
        <label class="question-label">What does your product do? (Solution)</label>
        <textarea
          class="form-textarea"
          id="solution_description"
          placeholder="Explain your solution clearly — what it does and how it solves the problem…"
          rows="3"
        >${State.formData.startup_basics.solution_description}</textarea>
        <span class="field-error" id="err-solution_description"></span>
      </div>

      <div class="question-block">
        <label class="question-label" style="color:var(--text-muted)">Links <span style="font-weight:400;font-size:12px">(optional)</span></label>
        <div class="link-inputs">
          <div class="link-input-wrapper">
            <svg class="link-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M9 19c-5 1.5-5-2.5-7-3m14 6v-3.87a3.37 3.37 0 0 0-.94-2.61c3.14-.35 6.44-1.54 6.44-7A5.44 5.44 0 0 0 20 4.77 5.07 5.07 0 0 0 19.91 1S18.73.65 16 2.48a13.38 13.38 0 0 0-7 0C6.27.65 5.09 1 5.09 1A5.07 5.07 0 0 0 5 4.77a5.44 5.44 0 0 0-1.5 3.78c0 5.42 3.3 6.61 6.44 7A3.37 3.37 0 0 0 9 18.13V22"/></svg>
            <input class="form-input" id="github_link" type="url" placeholder="GitHub URL" value="${esc(State.formData.startup_basics.github_link)}" />
          </div>
          <div class="link-input-wrapper">
            <svg class="link-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
            <input class="form-input" id="website_link" type="url" placeholder="Website URL" value="${esc(State.formData.startup_basics.website_link)}" />
          </div>
          <div class="link-input-wrapper">
            <svg class="link-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>
            <input class="form-input" id="demo_link" type="url" placeholder="Demo URL" value="${esc(State.formData.startup_basics.demo_link)}" />
          </div>
        </div>
      </div>
    </div>
  `;
  return panel;
}

function buildStep2() {
  const panel = createPanel(1);
  const data = State.formData.problem_clarity;

  panel.innerHTML = buildStepHeader(1) + `
    <div class="question-group">
      ${buildScoreQuestion('problem_definition_score', 'How clearly is your problem statement defined?', 'Can you articulate the exact pain, frequency, and who experiences it?', data.problem_definition_score)}
      ${buildScoreQuestion('target_user_clarity_score', 'How well do you understand your user?', 'Do you have a specific ICP, not just a broad demographic?', data.target_user_clarity_score)}
      ${buildScoreQuestion('frequency_score', 'How frequently does this problem occur?', 'Daily friction vs. occasional inconvenience — frequency matters for retention.', data.frequency_score)}
      ${buildScoreQuestion('severity_score', 'How severe is the problem?', 'Is this a vitamin (nice-to-have) or a painkiller (must-solve)?', data.severity_score)}
    </div>
  `;
  return panel;
}

function buildStep3() {
  const panel = createPanel(2);
  const data = State.formData.validation;

  panel.innerHTML = buildStepHeader(2) + `
    <div class="question-group">
      ${buildScoreQuestion('users_spoken_to', 'How many users have you spoken to?', '1 = 0–2 conversations, 2 = 3–10, 3 = 11–30, 4 = 30+', data.users_spoken_to)}
      ${buildScoreQuestion('user_type_score', 'Are they actual target users?', '1 = uncertain, 2 = loosely related, 3 = mostly correct, 4 = exact ICP', data.user_type_score)}
      ${buildScoreQuestion('pattern_score', 'How strong are the feedback patterns?', '1 = unclear, 2 = some signals, 3 = repeating themes, 4 = strong consensus', data.pattern_score)}
      ${buildScoreQuestion('iteration_score', 'Have you iterated based on feedback?', '1 = not yet, 2 = minor changes, 3 = significant pivots, 4 = continuous loop', data.iteration_score)}
      <div class="question-block">
        <label class="question-label">Feedback summary</label>
        <p class="question-sub">What patterns or insights emerged from user conversations?</p>
        <textarea
          class="form-textarea"
          id="validation_feedback_summary"
          placeholder="e.g. Most users said they struggle with X, three mentioned Y, common theme was Z…"
          rows="3"
        >${State.formData.validation.feedback_summary}</textarea>
      </div>
    </div>
  `;
  return panel;
}

function buildStep4() {
  const panel = createPanel(3);
  const data = State.formData.build;

  panel.innerHTML = buildStepHeader(3) + `
    <div class="question-group">
      ${buildScoreQuestion('build_stage', 'What stage is the product at?', '1 = Idea only, 2 = Wireframes/Mockups, 3 = MVP, 4 = Live product', data.build_stage)}
      ${buildScoreQuestion('accessibility_score', 'How accessible / testable is it?', '1 = Nothing to show, 2 = Internal only, 3 = Beta users, 4 = Public & functional', data.accessibility_score)}
      ${buildScoreQuestion('development_activity_score', 'How active is development?', '1 = Stalled, 2 = Slow, 3 = Regular progress, 4 = Shipping weekly', data.development_activity_score)}
    </div>
  `;
  return panel;
}

function buildStep5() {
  const panel = createPanel(4);
  const data = State.formData.traction;

  panel.innerHTML = buildStepHeader(4) + `
    <div class="question-group">
      ${buildScoreQuestion('user_count', 'How many users / customers do you have?', '1 = 0, 2 = 1–10, 3 = 11–100, 4 = 100+', data.user_count)}
      ${buildScoreQuestion('engagement_score', 'How engaged are your users?', '1 = None, 2 = Trying, 3 = Regular usage, 4 = Strong retention / referrals', data.engagement_score)}
      ${buildScoreQuestion('traction_signal_score', 'What traction signals exist?', '1 = None, 2 = Waitlist, 3 = Revenue / LOIs, 4 = DAU growth / virality', data.traction_signal_score)}
      <div class="question-block">
        <label class="question-label">Traction notes</label>
        <p class="question-sub">Any notable metrics, milestones, or signals worth highlighting?</p>
        <textarea
          class="form-textarea"
          id="traction_feedback_summary"
          placeholder="e.g. 47 waitlist signups, 3 paying customers, 65% weekly retention among beta users…"
          rows="3"
        >${State.formData.traction.feedback_summary}</textarea>
      </div>
    </div>
  `;
  return panel;
}

function buildStep6() {
  const panel = createPanel(5);
  const data = State.formData.funding_readiness;

  panel.innerHTML = buildStepHeader(5) + `
    <div class="question-group">
      ${buildScoreQuestion('market_understanding_score', 'How well do you understand your market?', '1 = Guessing, 2 = Some research, 3 = TAM/SAM/SOM defined, 4 = Deep insight', data.market_understanding_score)}
      ${buildScoreQuestion('business_model_score', 'How clear is the business model?', '1 = Undefined, 2 = Exploring, 3 = Clear model, 4 = Revenue-generating', data.business_model_score)}
      ${buildScoreQuestion('funding_history_score', 'What is your funding history / readiness?', '1 = No plan, 2 = Self-funded, 3 = Pre-seed ready, 4 = Active fundraise', data.funding_history_score)}
      <div class="question-block">
        <label class="question-label">Founder strengths</label>
        <p class="question-sub">What makes your team uniquely positioned to solve this problem?</p>
        <textarea
          class="form-textarea"
          id="founder_strength"
          placeholder="e.g. Ex-Google PM, 10 years in healthcare industry, repeat founder with exit…"
          rows="3"
        >${State.formData.funding_readiness.founder_strength}</textarea>
      </div>
    </div>
  `;
  return panel;
}

// ── Builder helpers ──

function createPanel(stepIndex) {
  const div = document.createElement('div');
  div.className = 'step-panel';
  div.id = `step-panel-${stepIndex}`;
  div.dataset.step = stepIndex;
  return div;
}

function buildStepHeader(stepIndex) {
  const step = CONFIG.STEPS[stepIndex];
  return `
    <div class="step-header">
      <div class="step-eyebrow">${step.eyebrow}</div>
      <h2 class="step-title">${step.title}</h2>
      <p class="step-desc">${step.description}</p>
    </div>
  `;
}

function buildScoreQuestion(fieldId, label, subText, currentValue) {
  const labels = CONFIG.SCORE_LABELS;

  const cards = [1, 2, 3, 4].map((score) => `
    <div
      class="chip-card${currentValue === score ? ' selected' : ''}"
      data-field="${fieldId}"
      data-score="${score}"
    >
      <div class="chip-card-score">${score}</div>
      <div class="chip-card-label">${labels[score].label}</div>
      <div class="chip-card-desc">${labels[score].desc}</div>
    </div>
  `).join('');

  return `
    <div class="question-block">
      <label class="question-label">${label}</label>
      <p class="question-sub">${subText}</p>
      <div class="chip-descriptions" data-field-group="${fieldId}">
        ${cards}
      </div>
    </div>
  `;
}

function esc(str) {
  if (!str) return '';
  return String(str).replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// ── Wizard controller ──

const PANEL_BUILDERS = [
  buildStep1,
  buildStep2,
  buildStep3,
  buildStep4,
  buildStep5,
  buildStep6,
];

let _container = null;
let _panels = [];
let _chipListenerAttached = false;

/**
 * Initialise the wizard — build all panels, attach listeners.
 * Safe to call multiple times (handles restart correctly).
 */
export function initWizard() {
  _container = document.getElementById('wizard-steps-container');
  if (!_container) return;

  // Always reset listener flag so restarts re-attach properly
  _chipListenerAttached = false;

  // Build all panels
  _container.innerHTML = '';
  _panels = PANEL_BUILDERS.map((builder) => {
    const panel = builder();
    _container.appendChild(panel);
    return panel;
  });

  // Attach chip click listener via event delegation (always fresh on init)
  _container.addEventListener('click', handleChipClick);
  _chipListenerAttached = true;

  // Render initial step
  renderStep(State.currentStep);
}

/**
 * Navigate to a specific step. Reads current step fields into state first.
 */
export function goToStep(stepIndex) {
  if (stepIndex < 0 || stepIndex >= State.totalSteps) return;

  readCurrentStepIntoState();
  State.setStep(stepIndex);
  renderStep(stepIndex);
}

/**
 * Validate the current step. Returns true if valid.
 */
export function validateCurrentStep() {
  const stepIndex = State.currentStep;

  // Clear previous errors
  qsa('.field-error.visible').forEach((el) => el.classList.remove('visible'));
  qsa('.form-input.error, .form-textarea.error').forEach((el) =>
    el.classList.remove('error')
  );

  if (stepIndex === 0) {
    return validateStep1();
  }
  // Steps 2–6 only require chip selection which already has defaults (1)
  return true;
}

/**
 * Read all input values in the current panel into State.
 */
export function readCurrentStepIntoState() {
  const stepIndex = State.currentStep;

  if (stepIndex === 0) {
    const fields = [
      'idea_description',
      'problem_statement',
      'target_user',
      'solution_description',
      'github_link',
      'website_link',
      'demo_link',
    ];
    const data = {};
    fields.forEach((f) => {
      const el = document.getElementById(f);
      if (el) data[f] = el.value.trim();
    });
    State.setFormSection('startup_basics', data);
  }

  if (stepIndex === 2) {
    const el = document.getElementById('validation_feedback_summary');
    if (el) State.setFormField('validation', 'feedback_summary', el.value.trim());
  }

  if (stepIndex === 4) {
    const el = document.getElementById('traction_feedback_summary');
    if (el) State.setFormField('traction', 'feedback_summary', el.value.trim());
  }

  if (stepIndex === 5) {
    const el = document.getElementById('founder_strength');
    if (el) State.setFormField('funding_readiness', 'founder_strength', el.value.trim());
  }
}

// ── Private ──

function renderStep(stepIndex) {
  // Hide all panels
  _panels.forEach((p) => p.classList.remove('active'));

  // Show target panel
  const target = _panels[stepIndex];
  if (target) {
    target.classList.add('active');
    // Force re-trigger animation
    target.style.animation = 'none';
    void target.offsetWidth;
    target.style.animation = '';
  }

  // Update sidebar, progress, buttons
  updateSidebarSteps(stepIndex, CONFIG.STEPS);
  setProgress(stepIndex, State.totalSteps);
  setNavButtons(stepIndex, State.totalSteps);
}

function handleChipClick(e) {
  const chip = e.target.closest('.chip-card');
  if (!chip) return;

  const fieldId = chip.dataset.field;
  const score = parseInt(chip.dataset.score, 10);
  if (!fieldId || isNaN(score)) return;

  // Deselect siblings
  const group = chip.closest('.chip-descriptions');
  if (group) {
    qsa('.chip-card', group).forEach((c) => c.classList.remove('selected'));
  }
  chip.classList.add('selected');

  // Write to state based on which section we're in
  const sectionMap = {
    problem_definition_score: 'problem_clarity',
    target_user_clarity_score: 'problem_clarity',
    frequency_score: 'problem_clarity',
    severity_score: 'problem_clarity',
    users_spoken_to: 'validation',
    user_type_score: 'validation',
    pattern_score: 'validation',
    iteration_score: 'validation',
    build_stage: 'build',
    accessibility_score: 'build',
    development_activity_score: 'build',
    user_count: 'traction',
    engagement_score: 'traction',
    traction_signal_score: 'traction',
    market_understanding_score: 'funding_readiness',
    business_model_score: 'funding_readiness',
    funding_history_score: 'funding_readiness',
  };

  const section = sectionMap[fieldId];
  if (section) {
    State.setFormField(section, fieldId, score);
  }
}

function validateStep1() {
  const required = [
    { id: 'idea_description', label: 'Please describe what you\'re building.' },
    { id: 'problem_statement', label: 'Please describe the problem you\'re solving.' },
    { id: 'target_user', label: 'Please define your target user.' },
    { id: 'solution_description', label: 'Please describe your solution.' },
  ];

  let valid = true;
  required.forEach(({ id, label }) => {
    const input = document.getElementById(id);
    const errEl = document.getElementById(`err-${id}`);
    if (!input) return;

    if (!input.value.trim()) {
      if (input) input.classList.add('error');
      if (errEl) {
        errEl.textContent = label;
        errEl.classList.add('visible');
      }
      valid = false;
    }
  });

  if (!valid) {
    // Scroll to first error
    const firstErr = document.querySelector('.form-input.error, .form-textarea.error');
    if (firstErr) firstErr.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  return valid;
}
