// ============================================
// FundMe - Onboarding Flow Logic
// Multi-step form progression and validation
// ============================================

(function () {
    'use strict';

    let currentStep = 1;
    const totalSteps = 6;

    const formData = {
        primaryIntent: '',
        isStudent: null,
        startupStage: '',
        domain: '',
        country: 'India',
        state: '',
        fundingRange: ''
    };

    // Domain options
    const domains = [
        'Technology & Software',
        'E-commerce & Retail',
        'Healthcare & Biotech',
        'Education & EdTech',
        'Finance & FinTech',
        'Agriculture & AgriTech',
        'Clean Energy & Sustainability',
        'Manufacturing & Industry',
        'Consumer Products',
        'Media & Entertainment',
        'Other'
    ];

    // Indian states
    const indianStates = [
        'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
        'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
        'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
        'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
        'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
        'Delhi', 'Puducherry'
    ];

    function init() {
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', setup);
        } else {
            setup();
        }
    }

    function setup() {
        // Populate dropdowns
        populateDomains();
        populateStates();

        // Setup navigation
        const nextButtons = document.querySelectorAll('.next-step');
        const prevButtons = document.querySelectorAll('.prev-step');
        const submitButton = document.getElementById('submitOnboarding');

        nextButtons.forEach(btn => {
            btn.addEventListener('click', nextStep);
        });

        prevButtons.forEach(btn => {
            btn.addEventListener('click', prevStep);
        });

        if (submitButton) {
            submitButton.addEventListener('click', submitOnboarding);
        }

        // Setup form inputs
        setupFormInputs();

        // Update progress
        updateProgress();
    }

    function populateDomains() {
        const select = document.getElementById('domain');
        if (select) {
            select.innerHTML = '<option value="">Select domain</option>' +
                domains.map(d => `<option value="${d}">${d}</option>`).join('');
        }
    }

    function populateStates() {
        const select = document.getElementById('state');
        if (select) {
            select.innerHTML = '<option value="">Select state</option>' +
                indianStates.map(s => `<option value="${s}">${s}</option>`).join('');
        }
    }

    function setupFormInputs() {
        // Primary intent radio buttons
        const intentRadios = document.querySelectorAll('input[name="primaryIntent"]');
        intentRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                formData.primaryIntent = e.target.value;
            });
        });

        // Student status radio buttons
        const studentRadios = document.querySelectorAll('input[name="isStudent"]');
        studentRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                formData.isStudent = e.target.value === 'yes';
            });
        });

        // Startup stage radio buttons
        const stageRadios = document.querySelectorAll('input[name="startupStage"]');
        stageRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                formData.startupStage = e.target.value;
            });
        });

        // Domain select
        const domainSelect = document.getElementById('domain');
        if (domainSelect) {
            domainSelect.addEventListener('change', (e) => {
                formData.domain = e.target.value;
            });
        }

        // State select
        const stateSelect = document.getElementById('state');
        if (stateSelect) {
            stateSelect.addEventListener('change', (e) => {
                formData.state = e.target.value;
            });
        }

        // Funding range radio buttons
        const rangeRadios = document.querySelectorAll('input[name="fundingRange"]');
        rangeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                formData.fundingRange = e.target.value;
            });
        });
    }

    function validateStep(step) {
        switch (step) {
            case 1:
                return formData.primaryIntent !== '';
            case 2:
                return formData.isStudent !== null;
            case 3:
                return formData.startupStage !== '';
            case 4:
                return formData.domain !== '';
            case 5:
                return formData.state !== '';
            case 6:
                return formData.fundingRange !== '';
            default:
                return false;
        }
    }

    function nextStep() {
        if (!validateStep(currentStep)) {
            alert('Please complete this step before continuing.');
            return;
        }

        if (currentStep < totalSteps) {
            hideStep(currentStep);
            currentStep++;
            showStep(currentStep);
            updateProgress();
        }
    }

    function prevStep() {
        if (currentStep > 1) {
            hideStep(currentStep);
            currentStep--;
            showStep(currentStep);
            updateProgress();
        }
    }

    function hideStep(step) {
        const stepElement = document.getElementById(`step${step}`);
        if (stepElement) {
            stepElement.classList.add('hidden');
        }
    }

    function showStep(step) {
        const stepElement = document.getElementById(`step${step}`);
        if (stepElement) {
            stepElement.classList.remove('hidden');
        }
    }

    function updateProgress() {
        const indicators = document.querySelectorAll('.progress-step');
        indicators.forEach((indicator, index) => {
            const stepNum = index + 1;
            indicator.classList.remove('active', 'completed');

            if (stepNum < currentStep) {
                indicator.classList.add('completed');
            } else if (stepNum === currentStep) {
                indicator.classList.add('active');
            }
        });

        // Update step counter
        const counter = document.getElementById('stepCounter');
        if (counter) {
            counter.textContent = `Step ${currentStep} of ${totalSteps}`;
        }
    }

    async function submitOnboarding() {

    if (!validateStep(currentStep)) {
        alert('Please complete all fields.');
        return;
    }

    try {

        const response = await fetch("http://localhost:5000/users", {

            method: "POST",

            headers: {
                "Content-Type": "application/json"
            },

            body: JSON.stringify(formData)

        });

        const user = await response.json();

        // store user id locally
        formData._id = user._id;

        if (window.FundMeState) {
            window.FundMeState.completeOnboarding(formData);
        }

        window.location.href = "home.html";

    } catch (error) {

        console.error("Error creating user:", error);

    }
}

    // Initialize
    init();
})();
