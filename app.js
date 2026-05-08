// ============================================================
// APP.JS — FundMe: Auth-first flow orchestrator
// Flow: Landing → Login/Signup → Questionnaire → Loading → Opportunities
// ============================================================

import { CONFIG } from './config.js';
import { showScreen, setLoadingStep, setLoadingMessage, resetLoadingSteps } from './ui.js';
import { renderOpportunityDashboard } from './opportunities.js';

// ── Storage keys ──
const SK_TOKEN   = 'fundme_token';
const SK_USER_ID = 'fundme_user_id';
const SK_NAME    = 'fundme_name';
const SK_EMAIL   = 'fundme_email';
const SK_PROFILE = 'fundme_profile_id'; // founder profile id once submitted

// ── Auth state ──
let _token   = localStorage.getItem(SK_TOKEN)   || null;
let _userId  = localStorage.getItem(SK_USER_ID) || null;
let _name    = localStorage.getItem(SK_NAME)    || null;
let _email   = localStorage.getItem(SK_EMAIL)   || null;

// ── Boot ──
document.addEventListener('DOMContentLoaded', () => {
  attachLanding();
  attachAuth();
  attachQuestionnaire();
  attachOpportunities();
  attachError();
  attachPasswordToggles();

  // If already logged in and has a profile, go straight to opportunities
  const savedProfileId = localStorage.getItem(SK_PROFILE);
  if (_token && _userId && savedProfileId) {
    updateNavUser();
    showScreen('opportunities');
    renderOpportunityDashboard(_userId).catch(() => showScreen('questionnaire'));
  } else if (_token && _userId) {
    // Logged in but no profile yet → questionnaire
    updateNavUser();
    showScreen('questionnaire');
  }
  // else: show landing (already active)
});

// ══════════════════════════════════════════════════════════════
// LANDING
// ══════════════════════════════════════════════════════════════
function attachLanding() {
  document.getElementById('btn-start')?.addEventListener('click', () => showScreen('signup'));
  document.getElementById('btn-signup-nav')?.addEventListener('click', () => showScreen('signup'));
  document.getElementById('btn-login-nav')?.addEventListener('click', () => showScreen('login'));
  document.getElementById('btn-login-hero')?.addEventListener('click', () => showScreen('login'));
}

// ══════════════════════════════════════════════════════════════
// AUTH
// ══════════════════════════════════════════════════════════════
function attachAuth() {
  // Login
  document.getElementById('btn-login-back')?.addEventListener('click', () => showScreen('landing'));
  document.getElementById('btn-go-signup')?.addEventListener('click', () => showScreen('signup'));
  document.getElementById('btn-login-submit')?.addEventListener('click', handleLogin);
  document.getElementById('login-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleLogin();
  });

  // Signup
  document.getElementById('btn-signup-back')?.addEventListener('click', () => showScreen('landing'));
  document.getElementById('btn-go-login')?.addEventListener('click', () => showScreen('login'));
  document.getElementById('btn-signup-submit')?.addEventListener('click', handleSignup);
  document.getElementById('signup-password')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleSignup();
  });
}

async function handleLogin() {
  const email    = document.getElementById('login-email')?.value.trim();
  const password = document.getElementById('login-password')?.value;
  const errEl    = document.getElementById('login-error');

  if (!email || !password) { showAuthError(errEl, 'Please enter your email and password.'); return; }

  setAuthLoading('login', true);
  try {
    const res = await apiFetch('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
    persistSession(res);
    showScreen('questionnaire');
    updateNavUser();
    // If user already has a profile, go to opportunities
    const savedProfileId = localStorage.getItem(SK_PROFILE);
    if (savedProfileId) {
      showScreen('opportunities');
      renderOpportunityDashboard(res.user_id).catch(() => showScreen('questionnaire'));
    }
  } catch (err) {
    showAuthError(errEl, err.message || 'Login failed. Please try again.');
  } finally {
    setAuthLoading('login', false);
  }
}

async function handleSignup() {
  const name     = document.getElementById('signup-name')?.value.trim();
  const email    = document.getElementById('signup-email')?.value.trim();
  const password = document.getElementById('signup-password')?.value;
  const errEl    = document.getElementById('signup-error');

  if (!name)           { showAuthError(errEl, 'Please enter your name.'); return; }
  if (!email)          { showAuthError(errEl, 'Please enter your email.'); return; }
  if (password.length < 6) { showAuthError(errEl, 'Password must be at least 6 characters.'); return; }

  setAuthLoading('signup', true);
  try {
    const res = await apiFetch('/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ name, email, password }),
    });
    persistSession(res);
    showScreen('questionnaire');
    updateNavUser();
  } catch (err) {
    showAuthError(errEl, err.message || 'Signup failed. Please try again.');
  } finally {
    setAuthLoading('signup', false);
  }
}

function persistSession(res) {
  _token  = res.token;
  _userId = res.user_id;
  _name   = res.name;
  _email  = res.email;
  localStorage.setItem(SK_TOKEN,   _token);
  localStorage.setItem(SK_USER_ID, _userId);
  localStorage.setItem(SK_NAME,    _name);
  localStorage.setItem(SK_EMAIL,   _email);
}

function clearSession() {
  _token = _userId = _name = _email = null;
  [SK_TOKEN, SK_USER_ID, SK_NAME, SK_EMAIL, SK_PROFILE].forEach(k => localStorage.removeItem(k));
}

function showAuthError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  // Re-trigger animation
  el.classList.remove('shake');
  void el.offsetWidth;
  el.classList.add('shake');
  setTimeout(() => el.classList.remove('shake'), 400);
}

function setAuthLoading(type, loading) {
  const btn  = document.getElementById(`btn-${type}-submit`);
  const text = document.getElementById(`${type}-btn-text`);
  const spin = document.getElementById(`${type}-spinner`);
  if (!btn) return;
  btn.disabled = loading;
  if (text) text.style.display = loading ? 'none' : 'inline';
  if (spin) spin.style.display = loading ? 'inline-block' : 'none';
}

function updateNavUser() {
  const name = _name || _email || '';
  const initial = name.charAt(0).toUpperCase();
  const html = `<span style="display:flex;align-items:center;gap:8px"><span style="width:28px;height:28px;border-radius:50%;background:var(--accent-primary-dim);border:1px solid var(--accent-primary);display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:600;color:var(--accent-primary);font-family:var(--font-display)">${initial}</span><span>${name}</span></span>`;
  document.getElementById('q-nav-user')?.innerHTML !== undefined && (document.getElementById('q-nav-user').innerHTML = html);
  document.getElementById('opp-nav-user')?.innerHTML !== undefined && (document.getElementById('opp-nav-user').innerHTML = html);
}

// ══════════════════════════════════════════════════════════════
// QUESTIONNAIRE
// ══════════════════════════════════════════════════════════════
function attachQuestionnaire() {
  // Domain chips
  const domainGrid = document.getElementById('domain-grid');
  if (domainGrid) {
    domainGrid.addEventListener('click', (e) => {
      const chip = e.target.closest('.domain-chip');
      if (!chip) return;
      const isOther = chip.dataset.value === 'Other';
      domainGrid.querySelectorAll('.domain-chip').forEach(c => c.classList.remove('selected'));
      chip.classList.add('selected');
      const customInput = document.getElementById('q-domain-custom');
      const hiddenInput = document.getElementById('q-domain');
      if (isOther) {
        customInput.style.display = 'block';
        hiddenInput.value = '';
        customInput.focus();
      } else {
        customInput.style.display = 'none';
        hiddenInput.value = chip.dataset.value;
      }
    });
  }

  document.getElementById('q-domain-custom')?.addEventListener('input', (e) => {
    document.getElementById('q-domain').value = e.target.value.trim();
  });

  document.getElementById('btn-q-submit')?.addEventListener('click', handleQuestionnaireSubmit);
}

async function handleQuestionnaireSubmit() {
  // Validate
  const problem  = document.getElementById('q-problem')?.value.trim();
  const solution = document.getElementById('q-solution')?.value.trim();
  const domain   = document.getElementById('q-domain')?.value.trim();
  const stage    = document.querySelector('input[name="stage"]:checked')?.value;
  const geography = document.querySelector('input[name="geography"]:checked')?.value;

  let hasError = false;
  const setErr = (id, msg) => { const el = document.getElementById(id); if (el) el.textContent = msg; if (msg) hasError = true; };
  setErr('err-problem',   problem  ? '' : 'Please describe the problem you are solving.');
  setErr('err-solution',  solution ? '' : 'Please describe your solution.');
  setErr('err-domain',    domain   ? '' : 'Please select your domain.');
  setErr('err-stage',     stage    ? '' : 'Please select your startup stage.');
  setErr('err-geography', geography ? '' : 'Please select your target geography.');

  if (hasError) {
    // Scroll to first error
    const firstErr = document.querySelector('.q-error:not(:empty)');
    firstErr?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    return;
  }

  if (!_token || !_userId) {
    document.getElementById('q-submit-error').textContent = 'You must be logged in. Please reload.';
    document.getElementById('q-submit-error').style.display = 'block';
    return;
  }

  setQLoading(true);

  // Build payload matching FounderProfileSubmitRequest
  const payload = {
    problem,
    solution,
    domain,
    stage,
    geography,
    github_link:  document.getElementById('q-github')?.value.trim() || null,
    linkedin_link: document.getElementById('q-linkedin')?.value.trim() || null,
    pitch_deck_url: document.getElementById('q-pitchdeck')?.value.trim() || null,
    website_link: document.getElementById('q-website')?.value.trim() || null,
  };

  // Start loading screen
  resetLoadingSteps();
  setLoadingMessage('Building your opportunity profile…', 'Saving your startup data');
  showScreen('loading');

  try {
    setLoadingStep('submit', 'active');
    const profileRes = await apiFetch(`/profile/submit`, {
      method: 'POST',
      body: JSON.stringify(payload),
      headers: { 'Authorization': `Bearer ${_token}` },
    });
    setLoadingStep('submit', 'done');

    const profileId = profileRes.profile_id;
    localStorage.setItem(SK_PROFILE, profileId);

    setLoadingStep('keywords', 'active');
    setLoadingMessage('Extracting keywords…', 'AI is analysing your domain and signals');
    await sleep(600); // Give time for keyword extraction (it's async in backend)
    setLoadingStep('keywords', 'done');

    setLoadingStep('match', 'active');
    setLoadingMessage('Matching with 200+ opportunities…', 'Ranking by relevance to your startup');
    await sleep(800);
    setLoadingStep('match', 'done');

    await sleep(400);
    updateNavUser();
    showScreen('opportunities');
    await renderOpportunityDashboard(_userId);

  } catch (err) {
    console.error('[App] Questionnaire submit failed:', err);
    showScreen('questionnaire');
    const errEl = document.getElementById('q-submit-error');
    if (errEl) {
      errEl.textContent = err.message || 'Something went wrong. Please try again.';
      errEl.style.display = 'block';
    }
  } finally {
    setQLoading(false);
  }
}

function setQLoading(loading) {
  const btn  = document.getElementById('btn-q-submit');
  const text = document.getElementById('q-submit-text');
  const spin = document.getElementById('q-spinner');
  if (!btn) return;
  btn.disabled = loading;
  if (text) text.style.display = loading ? 'none' : 'inline';
  if (spin) spin.style.display = loading ? 'inline-block' : 'none';
}

// ══════════════════════════════════════════════════════════════
// OPPORTUNITIES
// ══════════════════════════════════════════════════════════════
function attachOpportunities() {
  document.getElementById('btn-opp-new')?.addEventListener('click', () => {
    localStorage.removeItem(SK_PROFILE);
    showScreen('questionnaire');
  });
  document.getElementById('btn-logout')?.addEventListener('click', () => {
    clearSession();
    showScreen('landing');
  });
}

// ══════════════════════════════════════════════════════════════
// ERROR
// ══════════════════════════════════════════════════════════════
function attachError() {
  document.getElementById('btn-retry')?.addEventListener('click', () => showScreen('questionnaire'));
  document.getElementById('btn-restart-from-error')?.addEventListener('click', () => {
    clearSession();
    showScreen('landing');
  });
}

// ══════════════════════════════════════════════════════════════
// PASSWORD TOGGLES
// ══════════════════════════════════════════════════════════════
function attachPasswordToggles() {
  document.querySelectorAll('.password-toggle').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.dataset.target;
      const input = document.getElementById(targetId);
      if (!input) return;
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });
}

// ══════════════════════════════════════════════════════════════
// API HELPER
// ══════════════════════════════════════════════════════════════
async function apiFetch(path, options = {}) {
  const url = `${CONFIG.API_BASE}${path}`;
  const defaultHeaders = { 'Content-Type': 'application/json' };
  const merged = {
    ...options,
    headers: { ...defaultHeaders, ...(options.headers || {}) },
  };

  let response;
  try {
    response = await fetch(url, merged);
  } catch (e) {
    throw new Error('Cannot reach the server. Make sure the backend is running.');
  }

  if (!response.ok) {
    let errBody = '';
    try {
      const json = await response.json();
      errBody = json.detail || json.message || JSON.stringify(json);
    } catch (_) {
      errBody = await response.text().catch(() => '');
    }
    throw new Error(errBody || `Server error ${response.status}`);
  }

  return response.json();
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── Expose userId for opportunities module ──
export function getAuthUserId() { return _userId; }
export function getAuthToken()  { return _token; }
