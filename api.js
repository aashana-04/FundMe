// ============================================================
// API.JS — All backend communication, isolated
// ============================================================

import { CONFIG } from './config.js';

const BASE = CONFIG.API_BASE;

async function apiFetch(path, options = {}) {

  const url = `${BASE}${path}`;

  const defaultOptions = {
    headers: {
      'Content-Type': 'application/json'
    }
  };

  const token = localStorage.getItem('fundme_token');
  if (token) {
    defaultOptions.headers['Authorization'] = `Bearer ${token}`;
  }

  const mergedOptions = {
    ...defaultOptions,
    ...options,
    headers: {
      ...defaultOptions.headers,
      ...(options.headers || {})
    },
  };

  let response;

  try {

    response = await fetch(url, mergedOptions);

  } catch (networkErr) {

    throw new Error(
      'Cannot reach the server. Make sure the backend is running at ' + BASE
    );
  }

  if (!response.ok) {

    let errorBody = '';

    try {

      const json = await response.json();

      errorBody =
        json.detail ||
        json.message ||
        JSON.stringify(json);

    } catch (_) {

      errorBody = await response.text().catch(() => '');
    }

    throw new Error(
      `Server error ${response.status}: ${errorBody || response.statusText}`
    );
  }

  return response.json();
}


// ── Onboarding ──

export async function submitOnboarding(payload) {

  return apiFetch(
    CONFIG.ENDPOINTS.SUBMIT,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}


export async function fetchAnalysis(userId) {

  return apiFetch(
    CONFIG.ENDPOINTS.ANALYSIS(userId),
    {
      method: 'GET'
    }
  );
}


export async function fetchAiAnalysis(payload) {

  return apiFetch(
    CONFIG.ENDPOINTS.AI,
    {
      method: 'POST',
      body: JSON.stringify(payload)
    }
  );
}


// ── Opportunities ──

export async function fetchRecommendedOpportunities(
  userId,
  refresh = false
) {

  const q = refresh
    ? '?refresh=true'
    : '';

  return apiFetch(
    CONFIG.ENDPOINTS.OPPORTUNITIES_RECOMMENDED(userId) + q
  );
}


export async function searchOpportunities(params = {}) {

  const qs = new URLSearchParams();

  if (params.q)
    qs.set('q', params.q);

  if (
    params.category &&
    params.category !== 'all'
  ) {
    qs.set('category', params.category);
  }

  if (
    params.stage &&
    params.stage !== 'all'
  ) {
    qs.set('stage', params.stage);
  }

  if (
    params.domain &&
    params.domain !== 'all'
  ) {
    qs.set('domain', params.domain);
  }

  if (
    params.geography &&
    params.geography !== 'all'
  ) {
    qs.set('geography', params.geography);
  }

  if (params.sort_by)
    qs.set('sort_by', params.sort_by);

  if (params.limit)
    qs.set('limit', params.limit);

  if (params.offset)
    qs.set('offset', params.offset);

  const queryStr = qs.toString()
    ? `?${qs.toString()}`
    : '';

  return apiFetch(
    `/opportunities/search${queryStr}`
  );
}


export async function fetchOpportunityDetail(
  oppId,
  userId = ''
) {

  const qs = userId
    ? `?user_id=${userId}`
    : '';

  return apiFetch(
    CONFIG.ENDPOINTS.OPPORTUNITY_DETAIL(oppId) + qs
  );
}


export async function fetchReadinessAssessment(
  oppId,
  userId
) {

  return apiFetch(
    `/opportunities/${oppId}/readiness/${userId}`
  );
}


export async function shortlistOpportunity(
  opportunityId,
  userId
) {

  return apiFetch(
    CONFIG.ENDPOINTS.OPPORTUNITY_SHORTLIST(opportunityId),
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId
      }),
    }
  );
}


export async function removeShortlist(
  opportunityId,
  userId
) {

  return apiFetch(
    CONFIG.ENDPOINTS.OPPORTUNITY_SHORTLIST(opportunityId)
      + `?user_id=${userId}`,
    {
      method: 'DELETE'
    }
  );
}


export async function markOpportunityApplied(
  opportunityId,
  userId,
  notes = ''
) {

  return apiFetch(
    CONFIG.ENDPOINTS.OPPORTUNITY_MARK_APPLIED(opportunityId),
    {
      method: 'POST',
      body: JSON.stringify({
        user_id: userId,
        notes
      }),
    }
  );
}


export async function fetchShortlisted(userId) {

  return apiFetch(
    CONFIG.ENDPOINTS.OPPORTUNITIES_SHORTLISTED(userId)
  );
}