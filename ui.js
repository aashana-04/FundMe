// ============================================================
// UI.JS — Screen transitions, loading steps, shared UI helpers
// ============================================================

export function showScreen(name) {
  document.querySelectorAll('.screen').forEach(el => {
    el.classList.remove('active', 'entering');
  });
  const target = document.getElementById(`screen-${name}`);
  if (!target) { console.warn('[UI] Unknown screen:', name); return; }
  target.classList.add('entering');
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      target.classList.remove('entering');
      target.classList.add('active');
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  });
}

export function showError(message, onRetry, onRestart) {
  const el = document.getElementById('error-message');
  if (el) el.textContent = message;

  const retryBtn = document.getElementById('btn-retry');
  const restartBtn = document.getElementById('btn-restart-from-error');

  if (retryBtn && onRetry) {
    const fresh = retryBtn.cloneNode(true);
    retryBtn.parentNode.replaceChild(fresh, retryBtn);
    fresh.addEventListener('click', onRetry);
  }
  if (restartBtn && onRestart) {
    const fresh = restartBtn.cloneNode(true);
    restartBtn.parentNode.replaceChild(fresh, restartBtn);
    fresh.addEventListener('click', onRestart);
  }

  showScreen('error');
}

// ── Loading steps ──

const STEP_IDS = ['ls-submit', 'ls-keywords', 'ls-match'];
const STEP_KEY_MAP = { submit: 'ls-submit', keywords: 'ls-keywords', match: 'ls-match', score: 'ls-keywords', ai: 'ls-match' };

export function resetLoadingSteps() {
  STEP_IDS.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const icon = el.querySelector('.ls-icon');
    if (icon) {
      icon.className = 'ls-icon pending';
    }
  });
}

export function setLoadingStep(key, state) {
  const id  = STEP_KEY_MAP[key] || key;
  const el  = document.getElementById(id);
  if (!el) return;
  const icon = el.querySelector('.ls-icon');
  if (!icon) return;
  icon.className = `ls-icon ${state}`;
}

export function setLoadingMessage(title, sub) {
  const t = document.getElementById('loading-title');
  const s = document.getElementById('loading-sub');
  if (t) t.textContent = title;
  if (s) s.textContent = sub;
}

export function setProgress() {} // no-op (kept for compat)
export function updateSidebarSteps() {} // no-op
export function setNavButtons() {} // no-op
export function qsa(selector) { return document.querySelectorAll(selector); }
