// ============================================
// FundMe - Interactive Features Library
// Collapsibles, tabs, filters, and other UI interactions
// ============================================

const FundMeInteractions = (function () {
    'use strict';

    // === Collapsible Sections ===
    function initCollapsibles() {
        const collapsibles = document.querySelectorAll('.collapsible');

        collapsibles.forEach(collapsible => {
            const header = collapsible.querySelector('.collapsible-header');

            if (header) {
                header.addEventListener('click', () => {
                    collapsible.classList.toggle('open');
                });
            }
        });
    }

    // === Tab Navigation ===
    function initTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetId = button.getAttribute('data-tab');
                const tabGroup = button.closest('.tabs').nextElementSibling;

                // Remove active class from all buttons in this group
                button.parentElement.querySelectorAll('.tab-button').forEach(btn => {
                    btn.classList.remove('active');
                });

                // Add active class to clicked button
                button.classList.add('active');

                // Hide all tab contents
                if (tabGroup) {
                    tabGroup.querySelectorAll('.tab-content').forEach(content => {
                        content.classList.remove('active');
                    });

                    // Show target tab content
                    const targetContent = tabGroup.querySelector(`#${targetId}`);
                    if (targetContent) {
                        targetContent.classList.add('active');
                    }
                }
            });
        });
    }

    // === Card Hover Effects ===
    function initCardEffects() {
        const cards = document.querySelectorAll('.card-interactive');

        cards.forEach(card => {
            card.addEventListener('mouseenter', function () {
                this.style.transform = 'translateY(-4px)';
            });

            card.addEventListener('mouseleave', function () {
                this.style.transform = 'translateY(0)';
            });
        });
    }

    // === Filter Logic ===
    function createFilterSystem(config) {
        const {
            filterSelectors,
            itemSelector,
            getItemData
        } = config;

        const filters = {};

        // Initialize filter selectors
        Object.keys(filterSelectors).forEach(filterKey => {
            const selector = filterSelectors[filterKey];
            const element = document.querySelector(selector);

            if (element) {
                element.addEventListener('change', () => {
                    filters[filterKey] = element.value;
                    applyFilters();
                });
            }
        });

        function applyFilters() {
            const items = document.querySelectorAll(itemSelector);

            items.forEach(item => {
                const itemData = getItemData(item);
                let show = true;

                // Check each active filter
                Object.keys(filters).forEach(filterKey => {
                    const filterValue = filters[filterKey];
                    if (filterValue && filterValue !== 'all') {
                        const itemValue = itemData[filterKey];
                        if (itemValue !== filterValue) {
                            show = false;
                        }
                    }
                });

                // Show or hide item
                if (show) {
                    item.style.display = '';
                } else {
                    item.style.display = 'none';
                }
            });
        }

        return {
            applyFilters,
            reset() {
                Object.keys(filterSelectors).forEach(key => {
                    filters[key] = '';
                });
                applyFilters();
            }
        };
    }

    // === Vote/Like Handler ===
    function initVoteButtons() {
        const voteButtons = document.querySelectorAll('.vote-button');

        voteButtons.forEach(button => {
            button.addEventListener('click', function (e) {
                e.stopPropagation();

                const countElement = this.querySelector('.vote-count');
                if (countElement) {
                    let count = parseInt(countElement.textContent) || 0;

                    // Toggle voted state
                    if (this.classList.contains('voted')) {
                        this.classList.remove('voted');
                        count--;
                    } else {
                        this.classList.add('voted');
                        count++;
                    }

                    countElement.textContent = count;
                }
            });
        });
    }

    // === Reply Toggle ===
    function initReplyToggles() {
        const replyButtons = document.querySelectorAll('.reply-toggle');

        replyButtons.forEach(button => {
            button.addEventListener('click', function (e) {
                e.stopPropagation();

                const postCard = this.closest('.post-card');
                const repliesSection = postCard.querySelector('.replies-section');

                if (repliesSection) {
                    repliesSection.classList.toggle('hidden');
                }
            });
        });
    }

    // === Smooth Scroll ===
    function initSmoothScroll() {
        document.querySelectorAll('a[href^="#"]').forEach(anchor => {
            anchor.addEventListener('click', function (e) {
                const href = this.getAttribute('href');
                if (href !== '#') {
                    e.preventDefault();
                    const target = document.querySelector(href);
                    if (target) {
                        target.scrollIntoView({
                            behavior: 'smooth',
                            block: 'start'
                        });
                    }
                }
            });
        });
    }

    // Public API
    return {
        init() {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', () => {
                    initCollapsibles();
                    initTabs();
                    initCardEffects();
                    initVoteButtons();
                    initReplyToggles();
                    initSmoothScroll();
                });
            } else {
                initCollapsibles();
                initTabs();
                initCardEffects();
                initVoteButtons();
                initReplyToggles();
                initSmoothScroll();
            }
        },

        // Export utilities for custom usage
        createFilterSystem,
        initCollapsibles,
        initTabs,
        initVoteButtons,
        initReplyToggles
    };
})();

// Auto-initialize
FundMeInteractions.init();
