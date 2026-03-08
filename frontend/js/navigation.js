// ============================================
// FundMe - Navigation System
// Shared header and footer injection
// ============================================

const FundMeNav = (function () {
    'use strict';

    const pages = [
        { name: 'Home', path: 'home.html' },
        { name: 'Community', path: 'community.html' },
        { name: 'Funding Opportunities', path: 'opportunities.html' },
        { name: 'Guidance', path: 'guidance.html' },
        { name: 'Resources', path: 'resources.html' },
        { name: 'About', path: 'about.html' },
        { name: 'Profile', path: 'profile.html' }
    ];

    // Get current page filename
    function getCurrentPage() {
        const path = window.location.pathname;
        const filename = path.substring(path.lastIndexOf('/') + 1);
        return filename || 'index.html';
    }

    // Create header HTML
    function createHeader() {
        const currentPage = getCurrentPage();

        const navItems = pages.map(page => {
            const isActive = currentPage === page.path ? 'active' : '';
            return `<a href="${page.path}" class="${isActive}">${page.name}</a>`;
        }).join('');

        return `
      <header class="header">
        <div class="header-content">
          <a href="home.html" class="header-logo">FundMe</a>
          <button class="mobile-menu-toggle" id="mobileMenuToggle" aria-label="Toggle menu">
            ☰
          </button>
          <nav class="header-nav" id="headerNav">
            ${navItems}
          </nav>
        </div>
      </header>
    `;
    }

    // Create footer HTML
    function createFooter() {
        const currentYear = new Date().getFullYear();

        return `
      <footer class="footer">
        <div class="footer-content">
          <p class="footer-text">
            FundMe - Understanding funding comes before raising funding
          </p>
          <div class="footer-links">
            <a href="about.html">About</a>
            <a href="resources.html">Resources</a>
            <a href="community.html">Community</a>
          </div>
          <p class="footer-text" style="margin-top: var(--space-3);">
            © ${currentYear} FundMe. Built for students and early-stage founders.
          </p>
        </div>
      </footer>
    `;
    }

    // Inject header and footer
    function inject() {
        // Inject header at the beginning of body
        const headerHTML = createHeader();
        document.body.insertAdjacentHTML('afterbegin', headerHTML);

        // Inject footer at the end of body
        const footerHTML = createFooter();
        document.body.insertAdjacentHTML('beforeend', footerHTML);

        // Setup mobile menu toggle
        setupMobileMenu();
    }

    // Setup mobile menu functionality
    function setupMobileMenu() {
        const toggle = document.getElementById('mobileMenuToggle');
        const nav = document.getElementById('headerNav');

        if (toggle && nav) {
            toggle.addEventListener('click', () => {
                nav.classList.toggle('show');
            });

            // Close menu when clicking a link
            nav.querySelectorAll('a').forEach(link => {
                link.addEventListener('click', () => {
                    nav.classList.remove('show');
                });
            });
        }
    }

    // Public API
    return {
        init() {
            // Wait for DOM to be ready
            if (document.readyState === 'loading') {
                document.addEventListener('DOMContentLoaded', inject);
            } else {
                inject();
            }
        }
    };
})();

// Auto-initialize on script load
FundMeNav.init();
