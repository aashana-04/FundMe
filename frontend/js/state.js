// ============================================
// FundMe - State Management System
// Handles user data persistence via localStorage
// ============================================

const FundMeState = (function () {
    'use strict';

    const STORAGE_KEY = 'fundme_user_data';

    // Default state structure
    const defaultState = {
        onboardingCompleted: false,
        primaryIntent: '',
        isStudent: null,
        startupStage: '',
        domain: '',
        country: '',
        state: '',
        fundingRange: ''
    };

    // Initialize state from localStorage or defaults
    function initializeState() {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
            try {
                return { ...defaultState, ...JSON.parse(stored) };
            } catch (e) {
                console.error('Failed to parse stored state:', e);
                return { ...defaultState };
            }
        }
        return { ...defaultState };
    }

    // Current state
    let currentState = initializeState();

    // Save state to localStorage
    function saveState() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(currentState));
        } catch (e) {
            console.error('Failed to save state:', e);
        }
    }

    // Public API
    return {
        // Get entire state
        getState() {
            return { ...currentState };
        },

        // Get specific property
        get(key) {
            return currentState[key];
        },

        // Set single property
        set(key, value) {
            currentState[key] = value;
            saveState();
        },

        // Update multiple properties
        update(updates) {
            currentState = { ...currentState, ...updates };
            saveState();
        },

        // Check if onboarding is completed
        isOnboarded() {
            return currentState.onboardingCompleted === true;
        },

        // Mark onboarding as complete
        completeOnboarding(data) {
            currentState = {
                ...currentState,
                ...data,
                onboardingCompleted: true
            };
            saveState();
        },

        // Reset state (for testing)
        reset() {
            currentState = { ...defaultState };
            localStorage.removeItem(STORAGE_KEY);
        },

        // Get personalized greeting
        getGreeting() {
            const intent = currentState.primaryIntent;
            if (intent === 'Build a startup') {
                return 'Building your startup';
            } else if (intent === 'Explore student innovation opportunities') {
                return 'Exploring opportunities';
            }
            return 'Welcome to FundMe';
        },

        // Get stage display name
        getStageDisplay() {
            const stage = currentState.startupStage;
            const stages = {
                'Idea': 'Idea Stage',
                'Prototype': 'Prototype Stage',
                'Registered startup': 'Registered Startup',
                'Early revenue': 'Early Revenue'
            };
            return stages[stage] || stage;
        },

        // Get funding range display
        getFundingRangeDisplay() {
            return currentState.fundingRange || 'Not specified';
        }
    };
})();

// Make available globally
window.FundMeState = FundMeState;
