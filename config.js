// ============================================================
// CONFIG.JS — Application configuration and constants
// ============================================================

export const CONFIG = {
  API_BASE: 'http://127.0.0.1:8000/api/v1',

  ENDPOINTS: {
    // Auth
    SIGNUP: '/auth/signup',
    LOGIN:  '/auth/login',

    // Founder profile (new simplified flow)
    PROFILE_SUBMIT:  '/profile/submit',
    PROFILE_GET:     (profileId) => `/profile/${profileId}`,

    // Legacy onboarding (kept for backward compat)
    SUBMIT:   '/onboarding/submit',
    ANALYSIS: (userId) => `/onboarding/${userId}/analysis`,
    AI:       '/ai/analysis',

    // Opportunities
    OPPORTUNITIES_RECOMMENDED: (userId) => `/opportunities/recommended/${userId}`,
    OPPORTUNITY_DETAIL:        (id)     => `/opportunities/${id}`,
    OPPORTUNITY_SHORTLIST:     (id)     => `/opportunities/${id}/shortlist`,
    OPPORTUNITY_MARK_APPLIED:  (id)     => `/opportunities/${id}/mark-applied`,
    OPPORTUNITIES_SHORTLISTED: (userId) => `/opportunities/shortlisted/${userId}`,
  },

  STAGE_CLASSES: {
    'Idea':           'idea',
    'MVP':            'build',
    'Early users':    'traction',
    'Revenue stage':  'scale',
    'exploration':    'idea',
    'ideation':       'idea',
    'idea':           'idea',
    'validation':     'validation',
    'pre-seed':       'traction',
    'pre_seed':       'traction',
    'seed-ready':     'scale',
    'seed':           'scale',
    'mvp':            'build',
    'build':          'build',
    'traction':       'traction',
    'scale':          'scale',
    'growth':         'scale',
  },
};
