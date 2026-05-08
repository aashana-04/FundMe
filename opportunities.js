// ============================================================
// OPPORTUNITIES.JS — Opportunity Intelligence Dashboard v3
// Complete: cards, detail modal, filters, search, readiness
// ============================================================

import {
  fetchRecommendedOpportunities,
  searchOpportunities,
  fetchOpportunityDetail,
  fetchReadinessAssessment,
  shortlistOpportunity,
  removeShortlist,
  markOpportunityApplied,
  fetchShortlisted,
} from './api.js';

// ── State ─────────────────────────────────────────────────
let _userId = null;
let _opportunities = [];
let _shortlistedIds = new Set();
let _appliedIds = new Set();
let _activeFilter = 'all';
let _activeTab = 'recommended';
let _searchQuery = '';
let _sortBy = 'relevance';
let _stageFilter = 'all';
let _searchResults = [];
let _isSearchMode = false;
let _searchLoading = false;
let _searchDebounce = null;
let _keywords = [];
let _aiSummary = '';
let _domain = '';
let _stage = '';

// ── Entry Point ───────────────────────────────────────────

export async function renderOpportunityDashboard(userId) {
  _userId = userId;
  // Reset listener flag so fresh session gets a clean attachment
  _containerListenerAttached = false;
  const container = document.getElementById('opportunity-body');
  if (!container) return;
  container.innerHTML = buildLoadingSkeleton();
  try {
    const [recData, shortData] = await Promise.all([
      fetchRecommendedOpportunities(userId),
      fetchShortlisted(userId).catch(() => ({ opportunities: [] })),
    ]);
    _opportunities = recData.opportunities || [];
    _shortlistedIds = new Set((shortData.opportunities || []).map(o => o.id));
    _keywords = recData.extracted_keywords || recData.keywords || [];
    _aiSummary = recData.ai_profile_summary || recData.profile_summary || '';
    _domain = recData.domain || '';
    _stage = recData.stage || '';
    _appliedIds = new Set(
      _opportunities.filter(i => i.user_status === 'applied').map(i => i.opportunity.id)
    );
    renderDashboard(container);
  } catch (err) {
    container.innerHTML = buildErrorState(err.message);
  }
}

// ── AI Startup Understanding Panel ───────────────────────

function buildAIStartupUnderstanding() {
  // Only render if we have at least some AI data
  const hasData = _aiSummary || _keywords.length || _domain || _stage;
  if (!hasData) return '';

  const stageEmoji = {
    'idea': '💡', 'validation': '🔍', 'mvp': '🔨', 'pre-seed': '📈',
    'pre_seed': '📈', 'seed': '🚀', 'seed-ready': '🚀', 'growth': '📊',
  }[(_stage || '').toLowerCase()] || '🌱';

  const keywordTags = (_keywords.slice(0, 10)).map(k =>
    `<span class="opp-keyword-tag ai-signal-tag">${esc(k)}</span>`
  ).join('');

  const domainPills = _domain
    ? _domain.split(',').slice(0, 4).map(d =>
        `<span class="opp-pill blue">${esc(d.trim())}</span>`
      ).join('')
    : '';

  const stagePill = _stage
    ? `<span class="opp-pill green">${stageEmoji} ${esc(_stage.charAt(0).toUpperCase() + _stage.slice(1))}</span>`
    : '';

  const whySection = _opportunities.length > 0 && _opportunities[0].ai_insight?.why_recommended
    ? `<div class="ai-understand-why">
        <div class="ai-understand-section-label">Why these opportunities were recommended</div>
        <p class="ai-understand-why-text">
          Opportunities ranked by AI fit to your startup's domain signals, stage, and funding maturity.
          ${_domain ? `Strong alignment with <strong>${esc(_domain.split(',')[0].trim())}</strong> sector` : ''}
          ${_stage ? ` at <strong>${esc(_stage)}</strong> stage.` : '.'}
        </p>
      </div>`
    : '';

  return `
    <div class="ai-understand-panel">
      <div class="ai-understand-header">
        <div class="ai-understand-icon">✦</div>
        <div class="ai-understand-header-text">
          <h3 class="ai-understand-title">AI Startup Understanding</h3>
          <p class="ai-understand-subtitle">How the AI sees your startup</p>
        </div>
        <button class="ai-understand-toggle" id="ai-panel-toggle" title="Collapse">▲</button>
      </div>
      <div class="ai-understand-body" id="ai-panel-body">
        ${_aiSummary ? `
          <div class="ai-understand-summary">
            <div class="ai-understand-section-label">Startup Summary</div>
            <p class="ai-understand-summary-text">${esc(_aiSummary)}</p>
          </div>` : ''}
        <div class="ai-understand-meta-row">
          ${stagePill || domainPills ? `
            <div class="ai-understand-meta-block">
              <div class="ai-understand-section-label">Stage &amp; Domain</div>
              <div class="ai-understand-pills">${stagePill}${domainPills}</div>
            </div>` : ''}
          ${keywordTags ? `
            <div class="ai-understand-meta-block">
              <div class="ai-understand-section-label">Extracted Keywords &amp; Signals</div>
              <div class="ai-understand-keywords">${keywordTags}</div>
            </div>` : ''}
        </div>
        ${whySection}
      </div>
    </div>`;
}



function renderDashboard(container) {
  container.innerHTML = `
    ${buildAIStartupUnderstanding()}
    ${buildDashboardHeader()}
    ${buildTabBar()}
    ${buildSearchAndFilterBar()}
    <div id="opp-cards-grid" class="opp-grid">${buildCards()}</div>
  `;
  attachListeners();
  animateFitBars();
}

function buildDashboardHeader() {
  const total = _opportunities.length;
  const topPicks = _opportunities.filter(o => o.ai_insight?.priority_level === 'Top Pick').length;
  const liveCount = _opportunities.filter(o => o.opportunity?.source_type === 'live').length;
  return `
    <div class="opp-dashboard-header">
      <div class="opp-header-left">
        <div class="opp-eyebrow"><span class="opp-dot"></span>Opportunity Intelligence Engine${liveCount > 0 ? ' <span class="opp-live-pulse">● LIVE</span>' : ''}</div>
        <h2 class="opp-title">Your Funding Radar</h2>
        <p class="opp-subtitle">AI-matched grants, accelerators, fellowships &amp; programs — ranked by relevance to your startup.</p>
      </div>
      <div class="opp-header-stats">
        <div class="opp-stat-pill"><span class="opp-stat-num">${total}</span><span class="opp-stat-label">Matched</span></div>
        <div class="opp-stat-pill accent"><span class="opp-stat-num">${topPicks}</span><span class="opp-stat-label">Top Picks</span></div>
        ${liveCount > 0 ? `<div class="opp-stat-pill live"><span class="opp-stat-num">${liveCount}</span><span class="opp-stat-label">Live</span></div>` : ''}
        <div class="opp-stat-pill"><span class="opp-stat-num">${_shortlistedIds.size}</span><span class="opp-stat-label">Saved</span></div>
      </div>
    </div>`;
}

function buildTabBar() {
  const tabs = [
    { id: 'recommended', label: 'Recommended', icon: '✦' },
    { id: 'shortlisted', label: 'Saved', icon: '★' },
    { id: 'search', label: 'Search All', icon: '⌕' },
  ];
  return `<div class="opp-tabs">${tabs.map(t => `
    <button class="opp-tab ${_activeTab === t.id ? 'active' : ''}" data-tab="${t.id}">
      <span class="opp-tab-icon">${t.icon}</span>${t.label}
      ${t.id === 'shortlisted' && _shortlistedIds.size > 0 ? `<span class="opp-tab-badge">${_shortlistedIds.size}</span>` : ''}
    </button>`).join('')}</div>`;
}

function buildSearchAndFilterBar() {
  const categories = ['all','grant','accelerator','incubator','fellowship','hackathon','government','student','research'];
  const stages = ['all','idea','validation','mvp','pre-seed','seed'];
  const isSearchTab = _activeTab === 'search';
  return `
    <div class="opp-search-filter-bar">
      ${isSearchTab ? `
        <div class="opp-search-row">
          <div class="opp-search-input-wrap">
            <span class="opp-search-icon">⌕</span>
            <input type="text" id="opp-search-input" class="opp-search-input"
              placeholder="Search grants, accelerators, organizations…"
              value="${esc(_searchQuery)}" autocomplete="off"/>
            ${_searchQuery ? `<button class="opp-search-clear" id="opp-search-clear">✕</button>` : ''}
          </div>
          <div class="opp-sort-wrap">
            <select id="opp-sort-select" class="opp-sort-select">
              <option value="relevance" ${_sortBy==='relevance'?'selected':''}>Sort: Best Match</option>
              <option value="deadline" ${_sortBy==='deadline'?'selected':''}>Sort: Deadline</option>
              <option value="newest" ${_sortBy==='newest'?'selected':''}>Sort: Newest</option>
            </select>
          </div>
        </div>
        <div class="opp-advanced-filters">
          <div class="opp-filter-group">
            <span class="opp-filter-label">Stage:</span>
            <div class="opp-filter-pills">
              ${stages.map(s => `<button class="opp-filter-pill ${_stageFilter===s?'active':''}" data-stage-filter="${s}">${s==='all'?'Any Stage':cap(s)}</button>`).join('')}
            </div>
          </div>
        </div>` : ''}
      <div class="opp-filters">
        ${categories.map(cat => `<button class="opp-filter-btn ${_activeFilter===cat?'active':''}" data-filter="${cat}">${cat==='all'?'All':`${catIcon(cat)} ${cap(cat)}`}</button>`).join('')}
      </div>
    </div>`;
}

// ── Cards ──────────────────────────────────────────────────

function buildCards() {
  if (_activeTab === 'search' && _searchLoading) {
    return buildLoadingSkeleton();
  }
  const list = getFilteredList();
  if (!list.length) return buildEmptyState();
  return list.map(item => buildCard(item)).join('');
}

function getFilteredList() {
  let list = [];
  if (_activeTab === 'search' && _isSearchMode) {
    list = _searchResults.map(opp => ({
      opportunity: opp, ai_insight: {}, relevance_score: 0,
      user_status: null, is_shortlisted: _shortlistedIds.has(opp.id),
    }));
  } else if (_activeTab === 'shortlisted') {
    list = _opportunities.filter(i => _shortlistedIds.has(i.opportunity.id));
  } else {
    list = [..._opportunities];
  }
  if (_activeFilter !== 'all') {
    list = list.filter(i => i.opportunity.category === _activeFilter);
  }
  return list;
}

function buildCard(item) {
  const opp = item.opportunity;
  const ai = item.ai_insight || {};
  const isShortlisted = item.is_shortlisted || _shortlistedIds.has(opp.id);
  const isApplied = _appliedIds.has(opp.id);
  const fitScore = ai.estimated_fit_score || Math.round((item.relevance_score || 0) * 100);
  const priorityClass = (ai.priority_level || '').toLowerCase().includes('top') ? 'priority-top'
    : (ai.priority_level || '').toLowerCase().includes('strong') ? 'priority-strong' : 'priority-explore';
  const isLive = opp.source_type === 'live';
  const freshness = getFreshnessLabel(opp.last_scraped || opp.created_at);
  const deadlineInfo = getDeadlineInfo(opp.deadline);

  return `
    <div class="opp-card ${isLive ? 'opp-card-live' : ''}" data-opp-id="${opp.id}">
      <div class="opp-card-top">
        <div class="opp-card-meta">
          <span class="opp-category-badge cat-${opp.category}">${cap(opp.category)}</span>
          ${ai.priority_level ? `<span class="opp-priority-badge ${priorityClass}">${ai.priority_level}</span>` : ''}
          ${isLive ? `<span class="opp-live-badge">⚡ Live</span>` : ''}
        </div>
        <button class="opp-shortlist-btn ${isShortlisted?'active':''}" data-shortlist="${opp.id}" title="${isShortlisted?'Remove from saved':'Save opportunity'}">
          ${isShortlisted ? '★' : '☆'}
        </button>
      </div>
      <div class="opp-card-body">
        <h3 class="opp-card-title">${esc(opp.title)}</h3>
        <p class="opp-card-org">${esc(opp.organization)}</p>
        ${isLive && opp.source_name ? `<div class="opp-source-line"><span class="opp-source-dot"></span>Live from ${esc(opp.source_name)}${freshness ? ` · ${freshness}` : ''}</div>` : ''}
        <div class="opp-card-pills">
          ${opp.funding_amount ? `<span class="opp-pill green">${esc(opp.funding_amount)}</span>` : ''}
          ${deadlineInfo.badge ? `<span class="opp-pill ${deadlineInfo.cls}">${deadlineInfo.badge}</span>` : (opp.deadline ? `<span class="opp-pill yellow">${esc(opp.deadline)}</span>` : '')}
          ${(opp.geography||[]).slice(0,2).map(g=>`<span class="opp-pill blue">${esc(g)}</span>`).join('')}
        </div>
        ${fitScore > 0 ? `
          <div class="opp-fit-bar-row">
            <span class="opp-fit-label">AI Fit</span>
            <div class="opp-fit-track"><div class="opp-fit-fill" data-fit="${fitScore}"></div></div>
            <span class="opp-fit-num">${fitScore}%</span>
          </div>` : ''}
        ${ai.why_recommended ? `
          <div class="opp-ai-why">
            <span class="opp-ai-icon">✦</span>
            <p>${esc(ai.why_recommended)}</p>
          </div>` : ''}
        ${(opp.tags||[]).length ? `
          <div class="opp-tags">${(opp.tags||[]).slice(0,5).map(t=>`<span class="opp-tag">${esc(t)}</span>`).join('')}</div>` : ''}
      </div>
      <div class="opp-card-footer">
        <div class="opp-card-actions">
          <a href="${esc(opp.official_link)}" target="_blank" rel="noopener" class="opp-btn-apply">Apply →</a>
          <button class="opp-btn-details" data-detail="${opp.id}">Details</button>
          ${isApplied
            ? '<span class="opp-applied-badge">✓ Applied</span>'
            : `<button class="opp-btn-mark-applied" data-apply="${opp.id}">Mark Applied</button>`}
        </div>
      </div>
    </div>`;
}

// ── Detail Modal ──────────────────────────────────────────

async function showDetailModal(oppId) {
  const item = _opportunities.find(i => i.opportunity.id === oppId);
  const opp = item?.opportunity;
  if (!opp) return;
  const ai = item?.ai_insight || {};

  // Create overlay
  const overlay = document.createElement('div');
  overlay.className = 'opp-modal-overlay';
  overlay.id = 'opp-detail-overlay';

  // Fetch readiness
  let readiness = null;
  try {
    readiness = await fetchReadinessAssessment(oppId, _userId);
  } catch(e) { /* ignore */ }

  overlay.innerHTML = `
    <div class="opp-modal">
      <div class="opp-modal-header">
        <div>
          <h3>${esc(opp.title)}</h3>
          <p class="opp-modal-org">${esc(opp.organization)}</p>
        </div>
        <button class="opp-modal-close" id="modal-close">✕</button>
      </div>
      <div class="opp-modal-body">
        <div class="opp-modal-section">
          <h4>Overview</h4>
          <p>${esc(opp.description)}</p>
        </div>
        ${opp.funding_amount ? `<div class="opp-modal-section"><h4>Funding</h4><p>${esc(opp.funding_amount)}</p></div>` : ''}
        ${opp.deadline ? `<div class="opp-modal-section"><h4>Deadline</h4><p>${esc(opp.deadline)}</p></div>` : ''}
        ${opp.eligibility_summary ? `<div class="opp-modal-section"><h4>Eligibility</h4><p>${esc(opp.eligibility_summary)}</p></div>` : ''}
        ${(opp.benefits||[]).length ? `<div class="opp-modal-section"><h4>Benefits</h4><ul>${opp.benefits.map(b=>`<li>${esc(b)}</li>`).join('')}</ul></div>` : ''}
        ${(opp.required_docs||[]).length ? `<div class="opp-modal-section"><h4>Required Documents</h4><ul>${opp.required_docs.map(d=>`<li>${esc(d)}</li>`).join('')}</ul></div>` : ''}
        ${ai.why_recommended ? `
          <div class="opp-modal-section ai-highlight">
            <h4>✦ Why This Fits You</h4>
            <p>${esc(ai.why_recommended)}</p>
            ${ai.application_strategy ? `<p class="opp-strategy"><strong>Strategy:</strong> ${esc(ai.application_strategy)}</p>` : ''}
            ${ai.preparation_guidance ? `<p class="opp-strategy"><strong>Preparation:</strong> ${esc(ai.preparation_guidance)}</p>` : ''}
            ${ai.competitiveness ? `<p class="opp-strategy"><strong>Competitiveness:</strong> ${esc(ai.competitiveness)}</p>` : ''}
            ${ai.strongest_pathway ? `<p class="opp-strategy"><strong>Best Approach:</strong> ${esc(ai.strongest_pathway)}</p>` : ''}
          </div>` : ''}
        ${(ai.key_gaps||[]).length ? `
          <div class="opp-modal-section">
            <h4>Gaps to Address</h4>
            <ul>${ai.key_gaps.map(g=>`<li>${esc(g)}</li>`).join('')}</ul>
          </div>` : ''}
        ${readiness ? buildReadinessSection(readiness) : ''}
      </div>
      <div class="opp-modal-footer">
        <a href="${esc(opp.official_link)}" target="_blank" rel="noopener" class="opp-btn-apply">Apply →</a>
        <button class="opp-btn-ghost" id="modal-close-2">Close</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);

  // Close handlers
  const close = () => { overlay.remove(); };
  overlay.querySelector('#modal-close').addEventListener('click', close);
  overlay.querySelector('#modal-close-2').addEventListener('click', close);
  overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
  document.addEventListener('keydown', function handler(e) {
    if (e.key === 'Escape') { close(); document.removeEventListener('keydown', handler); }
  });
}

function buildReadinessSection(r) {
  const pct = r.readiness_percentage || 0;
  const barColor = pct >= 75 ? '#34d399' : pct >= 45 ? '#fbbf24' : '#f87171';
  const items = (r.checklist || []).slice(0, 10);
  return `
    <div class="opp-modal-section">
      <h4>Founder Readiness — ${pct}%</h4>
      <div class="opp-readiness-bar-wrap" style="margin-bottom:12px">
        <div style="height:6px;background:var(--surface-2);border-radius:4px;overflow:hidden">
          <div style="height:100%;width:${pct}%;background:${barColor};border-radius:4px;transition:width 0.6s"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:6px;font-size:11px;color:var(--text-muted)">
          <span>${r.completed || 0} done</span>
          <span>${r.partial || 0} partial</span>
          <span>${r.missing || 0} missing</span>
        </div>
      </div>
      ${r.preparation_summary ? `<p style="font-size:13px;color:var(--text-secondary);margin-bottom:12px">${esc(r.preparation_summary)}</p>` : ''}
      ${r.estimated_prep_time ? `<p style="font-size:12px;color:var(--text-muted)">⏱ Est. prep time: ${esc(r.estimated_prep_time)}</p>` : ''}
      ${items.length ? `<div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
        ${items.map(c => `
          <div style="display:flex;align-items:center;gap:8px;font-size:12px">
            <span style="width:8px;height:8px;border-radius:50%;flex-shrink:0;background:${c.status==='done'?'#34d399':c.status==='partial'?'#fbbf24':'#f87171'}"></span>
            <span style="color:var(--text-secondary)">${esc(c.item)}</span>
            ${c.tips ? `<span style="color:var(--text-muted);font-size:10px;margin-left:auto" title="${esc(c.tips)}">ⓘ</span>` : ''}
          </div>`).join('')}
      </div>` : ''}
    </div>`;
}

// ── Event Listeners ───────────────────────────────────────

// Track whether the persistent container listener is attached.
// Since renderDashboard replaces innerHTML (not the container itself),
// the listener on the container element survives re-renders, so we
// only need to attach it once per dashboard session.
let _containerListenerAttached = false;

function attachListeners() {
  const container = document.getElementById('opportunity-body');
  if (!container) return;

  if (!_containerListenerAttached) {
    container.addEventListener('click', handleContainerClick);
    _containerListenerAttached = true;
  }

  // AI panel collapse toggle
  const toggleBtn = container.querySelector('#ai-panel-toggle');
  const panelBody = container.querySelector('#ai-panel-body');
  if (toggleBtn && panelBody) {
    toggleBtn.addEventListener('click', () => {
      const collapsed = panelBody.style.display === 'none';
      panelBody.style.display = collapsed ? '' : 'none';
      toggleBtn.textContent = collapsed ? '▲' : '▼';
      toggleBtn.title = collapsed ? 'Collapse' : 'Expand';
    });
  }

  const searchInput = container.querySelector('#opp-search-input');
  if (searchInput) {
    searchInput.addEventListener('input', handleSearchInput);
  }

  const sortSelect = container.querySelector('#opp-sort-select');
  if (sortSelect) {
    sortSelect.addEventListener('change', e => {
      _sortBy = e.target.value;
      doSearch();
    });
  }
}

function handleContainerClick(e) {
  const target = e.target.closest('[data-tab],[data-filter],[data-stage-filter],[data-shortlist],[data-detail],[data-apply]') || e.target;

  // Tab click
  const tab = target.closest('[data-tab]');
  if (tab) {
    _activeTab = tab.dataset.tab;
    _activeFilter = 'all';
    _isSearchMode = false;
    _searchQuery = '';
    _searchResults = [];
    renderDashboard(document.getElementById('opportunity-body'));
    return;
  }

  // Category filter
  const filter = target.closest('[data-filter]');
  if (filter) {
    _activeFilter = filter.dataset.filter;
    refreshGrid();
    highlightActiveFilter();
    return;
  }

  // Stage filter
  const stageFilter = target.closest('[data-stage-filter]');
  if (stageFilter) {
    _stageFilter = stageFilter.dataset.stageFilter;
    doSearch();
    return;
  }

  // Shortlist toggle
  const shortlistBtn = target.closest('[data-shortlist]');
  if (shortlistBtn) {
    toggleShortlist(shortlistBtn.dataset.shortlist, shortlistBtn);
    return;
  }

  // Detail modal
  const detailBtn = target.closest('[data-detail]');
  if (detailBtn) {
    showDetailModal(detailBtn.dataset.detail);
    return;
  }

  // Mark applied
  const applyBtn = target.closest('[data-apply]');
  if (applyBtn) {
    handleMarkApplied(applyBtn.dataset.apply, applyBtn);
    return;
  }

  // Search clear
  if (target.closest('#opp-search-clear')) {
    _searchQuery = '';
    _isSearchMode = false;
    _searchResults = [];
    renderDashboard(document.getElementById('opportunity-body'));
    return;
  }
}

function handleSearchInput(e) {
  _searchQuery = e.target.value;
  clearTimeout(_searchDebounce);
  if (!_searchQuery.trim()) {
    _isSearchMode = false;
    _searchResults = [];
    refreshGrid();
    return;
  }
  _searchDebounce = setTimeout(() => doSearch(), 350);
}

async function doSearch() {
  if (!_searchQuery.trim() && _stageFilter === 'all') {
    _isSearchMode = false;
    _searchResults = [];
    refreshGrid();
    return;
  }
  _isSearchMode = true;
  _searchLoading = true;
  refreshGrid();
  try {
    const params = {
      q: _searchQuery || undefined,
      category: _activeFilter !== 'all' ? _activeFilter : undefined,
      stage: _stageFilter !== 'all' ? _stageFilter : undefined,
      sort_by: _sortBy,
      limit: 20,
    };
    const data = await searchOpportunities(params);
    _searchResults = data.opportunities || [];
  } catch (err) {
    _searchResults = [];
  }
  _searchLoading = false;
  refreshGrid();
}

function refreshGrid() {
  const grid = document.getElementById('opp-cards-grid');
  if (!grid) return;
  grid.innerHTML = buildCards();
  animateFitBars();
}

function highlightActiveFilter() {
  document.querySelectorAll('.opp-filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.filter === _activeFilter);
  });
}

// ── Actions ───────────────────────────────────────────────

async function toggleShortlist(oppId, btn) {
  try {
    if (_shortlistedIds.has(oppId)) {
      await removeShortlist(oppId, _userId);
      _shortlistedIds.delete(oppId);
      btn.classList.remove('active');
      btn.textContent = '☆';
    } else {
      await shortlistOpportunity(oppId, _userId);
      _shortlistedIds.add(oppId);
      btn.classList.add('active');
      btn.textContent = '★';
    }
    // Update stats
    const statEls = document.querySelectorAll('.opp-stat-pill');
    if (statEls[2]) {
      statEls[2].querySelector('.opp-stat-num').textContent = _shortlistedIds.size;
    }
  } catch (err) {
    console.error('Shortlist toggle failed:', err);
  }
}

async function handleMarkApplied(oppId, btn) {
  try {
    await markOpportunityApplied(oppId, _userId);
    _appliedIds.add(oppId);
    btn.replaceWith(Object.assign(document.createElement('span'), {
      className: 'opp-applied-badge', textContent: '✓ Applied'
    }));
  } catch (err) {
    console.error('Mark applied failed:', err);
  }
}

// ── Animations ────────────────────────────────────────────

function animateFitBars() {
  requestAnimationFrame(() => {
    document.querySelectorAll('.opp-fit-fill[data-fit]').forEach(bar => {
      bar.style.width = `${bar.dataset.fit}%`;
    });
  });
}

// ── Skeleton / Empty / Error ──────────────────────────────

function buildLoadingSkeleton() {
  const card = `<div class="opp-card skeleton">
    <div class="sk-line sk-short"></div>
    <div class="sk-line sk-title"></div>
    <div class="sk-line sk-med"></div>
    <div class="sk-line sk-long"></div>
    <div class="sk-line sk-bar"></div>
  </div>`;
  return `<div class="opp-grid">${card.repeat(6)}</div>`;
}

function buildEmptyState() {
  const msg = _activeTab === 'shortlisted'
    ? 'No saved opportunities yet. Browse recommended opportunities and save the ones you like.'
    : _isSearchMode
    ? `No opportunities found for "${esc(_searchQuery)}". Try different keywords or filters.`
    : 'No opportunities match the current filters. Try broadening your search.';
  return `<div class="opp-empty"><div class="opp-empty-icon">📭</div><p>${msg}</p></div>`;
}

function buildErrorState(message) {
  return `<div class="opp-error-state"><div class="opp-error-icon">⚠</div><h3>Failed to load opportunities</h3><p>${esc(message)}</p></div>`;
}

// ── Helpers ───────────────────────────────────────────────

function esc(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : ''; }
function catIcon(cat) {
  const icons = { grant:'💰', accelerator:'🚀', incubator:'🏢', fellowship:'🎓', hackathon:'⚡', government:'🏛', student:'📚', research:'🔬' };
  return icons[cat] || '📋';
}

function getFreshnessLabel(isoStr) {
  if (!isoStr) return '';
  try {
    const d = new Date(isoStr);
    const now = new Date();
    const diffMs = now - d;
    const mins = Math.floor(diffMs / 60000);
    if (mins < 60) return `Updated ${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `Updated ${hrs}h ago`;
    const days = Math.floor(hrs / 24);
    if (days < 7) return `Updated ${days}d ago`;
    return `Updated ${Math.floor(days/7)}w ago`;
  } catch { return ''; }
}

function getDeadlineInfo(deadline) {
  if (!deadline) return { badge: null, cls: '' };
  const lower = deadline.toLowerCase();
  if (['rolling','ongoing','open','always open','continuous'].some(k => lower.includes(k))) {
    return { badge: '🟢 Open', cls: 'green' };
  }
  // Try parse date
  const parsed = new Date(deadline);
  if (!isNaN(parsed.getTime())) {
    const now = new Date();
    const diffDays = Math.ceil((parsed - now) / 86400000);
    if (diffDays < 0) return { badge: '🔴 Closed', cls: 'red' };
    if (diffDays <= 3) return { badge: `🔴 ${diffDays}d left!`, cls: 'red' };
    if (diffDays <= 7) return { badge: `🟡 ${diffDays}d left`, cls: 'yellow' };
    if (diffDays <= 30) return { badge: `📅 ${diffDays}d left`, cls: 'yellow' };
    return { badge: `📅 ${deadline}`, cls: 'yellow' };
  }
  return { badge: null, cls: '' };
}