// ============================================================
// ANALYSIS.JS — Opportunity-first dashboard render
// Reduced scoring-card emphasis, stronger discovery CTA
// ============================================================

import { CONFIG } from './config.js';

/**
 * Render the analysis dashboard.
 * Called after both analysis + aiInsights are fully loaded.
 */
export function renderDashboard(analysis, ai) {
  const container = document.getElementById('analysis-body');
  if (!container) return;

  container.innerHTML =
    buildDiscoverCTA(analysis) +   // CTA first — opportunity-first UX
    buildStageInsight(analysis) +  // stage context (not score-card)
    buildAiSection(ai) +           // AI insights
    buildNextStepsCard(analysis.next_steps || []) +
    buildScoreBreakdownCard(analysis.scores || {});  // scores last, de-emphasized

  requestAnimationFrame(() => {
    animateScoreBars();
  });
}

// ── Discover CTA (top — primary call to action) ──

function buildDiscoverCTA(analysis) {
  const stage = analysis?.stage || 'your stage';
  const score = analysis?.overall_score || 0;

  // Map score to opportunity count signal
  const matchHint = score >= 70
    ? 'Your profile is strong — expect high-relevance matches across accelerators and grants.'
    : score >= 45
    ? 'Your profile is solid — AI has matched you with programs suited to your current stage.'
    : 'Great start — we\'ve found early-stage grants and incubators well-matched to your profile.';

  return `
    <div class="discover-cta-section">
      <div class="cta-badge">
        <span class="cta-badge-dot"></span>
        Opportunities Ready
      </div>
      <h2 class="discover-cta-title">Your Opportunity Dashboard is Ready</h2>
      <p class="discover-cta-sub">${esc(matchHint)}</p>
      <div class="cta-action-row">
        <button type="button" class="btn-discover-opportunities" id="btn-discover-inline">
          <span>✦</span>
          View My Matched Opportunities
        </button>
        <div class="cta-meta">
          <span class="cta-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
            AI-ranked
          </span>
          <span class="cta-meta-item">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
            Updated today
          </span>
        </div>
      </div>
    </div>`;
}

// ── Stage Insight (replaces the scoring hero) ──

function buildStageInsight(analysis) {
  const stageLower = (analysis.stage || 'idea').toLowerCase();
  const stageClass = CONFIG.STAGE_CLASSES[stageLower] || 'idea';

  const stageEmoji = {
    'seed-ready': '🚀', 'pre-seed': '📈', 'validation': '🔍',
    'ideation': '💡', 'exploration': '🌱',
  }[stageLower] || '💡';

  return `
    <div class="stage-insight-card">
      <div class="stage-insight-left">
        <div class="stage-insight-emoji">${stageEmoji}</div>
        <div>
          <div class="stage-insight-label">Your Startup Stage</div>
          <span class="stage-badge ${stageClass}">
            <span class="stage-dot"></span>
            ${esc(analysis.stage_label || analysis.stage)}
          </span>
        </div>
      </div>
      <div class="stage-insight-right">
        <p class="stage-insight-desc">${esc(analysis.stage_label || '')}</p>
        ${(analysis.strengths || []).length ? `
          <div class="stage-signals">
            ${(analysis.strengths || []).slice(0,2).map(s => `
              <span class="stage-signal green">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>
                ${esc(s)}
              </span>`).join('')}
            ${(analysis.weaknesses || []).slice(0,1).map(w => `
              <span class="stage-signal amber">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                ${esc(w)}
              </span>`).join('')}
          </div>` : ''}
      </div>
    </div>`;
}

// ── AI Section ──

function buildAiSection(ai) {
  if (!ai) return '';

  const risks = (ai.key_risks || []).map((r) => `
    <div class="risk-item">
      <span class="risk-dot"></span>
      <span>${esc(r)}</span>
    </div>
  `).join('');

  const detailedSteps = (ai.next_steps_detailed || []).map((s, i) => `
    <div class="step-item">
      <div class="step-num">${i + 1}</div>
      <div class="step-text">${esc(s)}</div>
    </div>
  `).join('');

  return `
    <div class="ai-section">
      <div class="ai-card">
        <div class="ai-header">
          <div class="ai-icon-wrapper">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>
          </div>
          <div class="ai-header-text">
            <h3>AI Startup Insights</h3>
            <p>Personalised to your startup's domain and stage</p>
          </div>
        </div>

        <div class="ai-grid">
          ${ai.stage_explanation ? `
            <div class="ai-block full">
              <div class="ai-block-title">Startup Context</div>
              <div class="ai-block-content">${esc(ai.stage_explanation)}</div>
            </div>
          ` : ''}

          ${ai.personalized_advice ? `
            <div class="ai-block full">
              <div class="ai-block-title">Strategic Advice for Your Startup</div>
              <div class="ai-block-content">${esc(ai.personalized_advice)}</div>
              ${ai.improvement_focus ? `<span class="ai-focus-tag">
                Focus: ${esc(ai.improvement_focus)}
              </span>` : ''}
            </div>
          ` : ''}

          ${risks ? `
            <div class="ai-block">
              <div class="ai-block-title">Key Risks to Address</div>
              <div>${risks}</div>
            </div>
          ` : ''}

          ${detailedSteps ? `
            <div class="ai-block">
              <div class="ai-block-title">Action Plan</div>
              <div class="steps-list">${detailedSteps}</div>
            </div>
          ` : ''}
        </div>
      </div>
    </div>`;
}

// ── Next Steps (compact) ──

function buildNextStepsCard(steps) {
  if (!steps.length) return '';

  const items = steps.map((step, i) => `
    <div class="step-item">
      <div class="step-num">${i + 1}</div>
      <div class="step-text">${esc(step)}</div>
    </div>
  `).join('');

  return `
    <div class="analysis-grid full">
      <div class="analysis-card">
        <div class="card-header">
          <span class="card-title">Recommended Next Steps</span>
          <span class="card-icon blue">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
          </span>
        </div>
        <div class="steps-list">${items}</div>
      </div>
    </div>`;
}

// ── Score Breakdown (de-emphasized, at bottom) ──

function buildScoreBreakdownCard(scores) {
  const entries = Object.entries(scores);
  if (!entries.length) return '';

  const labelMap = {
    problem_clarity: 'Problem Clarity',
    validation: 'Validation',
    build: 'Build',
    traction: 'Traction',
    funding_readiness: 'Funding Readiness',
  };

  const bars = entries.map(([key, value]) => {
    const pct = Math.min(value, 100);
    const colorClass = pct >= 70 ? 'high' : pct >= 45 ? 'mid' : pct >= 25 ? 'low' : 'critical';
    return `
      <div class="score-bar-item">
        <div class="score-bar-header">
          <span class="score-bar-label">${labelMap[key] || key}</span>
          <span class="score-bar-value">${value}%</span>
        </div>
        <div class="score-bar-track">
          <div class="score-bar-fill ${colorClass}" data-pct="${pct}" style="width:0%"></div>
        </div>
      </div>`;
  }).join('');

  return `
    <div class="analysis-grid full">
      <div class="analysis-card" style="opacity:0.85">
        <div class="card-header">
          <span class="card-title" style="font-size:13px;color:var(--text-muted)">Founder Readiness Breakdown</span>
        </div>
        <div class="score-breakdown">${bars}</div>
      </div>
    </div>`;
}

// ── Animations ──

function animateScoreBars() {
  const bars = document.querySelectorAll('.score-bar-fill[data-pct]');
  bars.forEach((bar) => {
    const pct = bar.dataset.pct;
    requestAnimationFrame(() => {
      bar.style.width = `${pct}%`;
    });
  });
}

function esc(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
