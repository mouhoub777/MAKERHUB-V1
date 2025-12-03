/**
 * MAKERHUB Sidebar Component v1.0
 * Composant sidebar centralisé - À inclure dans chaque page
 * Usage: <div id="sidebar-container"></div> + <script src="/assets/js/sidebar.js"></script>
 */

(function() {
  'use strict';

  // Configuration des onglets
  const MENU_ITEMS = [
    { 
      id: 'dashboard', 
      label: 'Dashboard', 
      icon: 'fas fa-th-large', 
      href: '/dashboard.html' 
    },
    { 
      id: 'telegram', 
      label: 'Telegram Members', 
      icon: 'fab fa-telegram', 
      href: '/telegramsubscription.html' 
    },
    { 
      id: 'emails', 
      label: 'Emails', 
      icon: 'fas fa-envelope', 
      href: '/emails.html' 
    },
    { 
      id: 'analytics', 
      label: 'Analytics', 
      icon: 'fas fa-chart-line', 
      href: '/statistiques.html' 
    },
    { 
      id: 'payments', 
      label: 'Payments', 
      icon: 'fas fa-credit-card', 
      href: '/payments.html' 
    },
    { 
      id: 'plans', 
      label: 'Plans', 
      icon: 'fas fa-tag', 
      href: '/prix.html' 
    }
  ];

  // Détecter la page active
  function getActivePage() {
    const path = window.location.pathname.toLowerCase();
    
    for (const item of MENU_ITEMS) {
      if (path.includes(item.href.replace('.html', '').replace('/', ''))) {
        return item.id;
      }
    }
    
    // Fallback: dashboard par défaut
    if (path === '/' || path === '/index.html') {
      return 'dashboard';
    }
    
    return null;
  }

  // Générer le HTML de la sidebar
  function generateSidebarHTML() {
    const activePage = getActivePage();
    
    const menuItemsHTML = MENU_ITEMS.map(item => {
      const isActive = item.id === activePage ? 'active' : '';
      return `
        <a href="${item.href}" class="nav-link ${isActive}" data-page="${item.id}">
          <i class="${item.icon}"></i>
          <span>${item.label}</span>
        </a>
      `;
    }).join('');

    return `
      <nav class="sidebar" id="sidebar">
        <div class="sidebar-header">
          <a href="/dashboard.html" class="logo">
            <div class="logo-icon">M</div>
            <div class="logo-text">MAKER<span class="hub">HUB</span></div>
          </a>
        </div>
        
        <div class="nav-menu">
          ${menuItemsHTML}
        </div>
      </nav>
      
      <!-- Mobile Menu Toggle -->
      <button class="menu-toggle" id="menuToggle">
        <i class="fas fa-bars"></i>
      </button>
    `;
  }

  // Injecter les styles CSS
  function injectStyles() {
    if (document.getElementById('sidebar-styles')) return;
    
    const styles = document.createElement('style');
    styles.id = 'sidebar-styles';
    styles.textContent = `
      /* ========== SIDEBAR STYLES ========== */
      .sidebar {
        width: 260px;
        height: 100vh;
        background: #1a1a1a;
        position: fixed;
        left: 0;
        top: 0;
        display: flex;
        flex-direction: column;
        z-index: 1000;
        transition: transform 0.3s ease;
      }

      .sidebar-header {
        padding: 24px 20px;
        border-bottom: 1px solid rgba(255,255,255,0.1);
        background: #1a1a1a;
      }

      .logo {
        display: flex;
        align-items: center;
        gap: 12px;
        text-decoration: none;
      }

      .logo-icon {
        width: 40px;
        height: 40px;
        background: #f5c518;
        border-radius: 10px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 20px;
        color: #1a1a1a;
      }

      .logo-text {
        font-size: 20px;
        font-weight: 700;
        color: #ffffff !important;
        letter-spacing: -0.5px;
      }

      .logo-text .hub {
        color: #f5c518 !important;
      }

      .nav-menu {
        flex: 1;
        padding: 20px 12px;
        display: flex;
        flex-direction: column;
        gap: 4px;
        overflow-y: auto;
      }

      .nav-link {
        display: flex;
        align-items: center;
        gap: 14px;
        padding: 14px 16px;
        border-radius: 10px;
        color: #a0a0a0;
        text-decoration: none;
        font-size: 15px;
        font-weight: 500;
        transition: all 0.2s ease;
      }

      .nav-link:hover {
        background: rgba(255,255,255,0.08);
        color: #ffffff;
      }

      .nav-link.active {
        background: #f5c518;
        color: #1a1a1a;
        font-weight: 600;
      }

      .nav-link.active i {
        color: #1a1a1a;
      }

      .nav-link i {
        width: 20px;
        font-size: 18px;
        text-align: center;
        color: inherit;
      }

      /* Mobile Toggle Button */
      .menu-toggle {
        display: none;
        position: fixed;
        top: 16px;
        left: 16px;
        z-index: 1001;
        width: 44px;
        height: 44px;
        border-radius: 10px;
        background: #1a1a1a;
        border: none;
        color: #ffffff;
        font-size: 20px;
        cursor: pointer;
        box-shadow: 0 2px 10px rgba(0,0,0,0.2);
        transition: all 0.2s ease;
      }

      .menu-toggle:hover {
        background: #2a2a2a;
      }

      /* Main content offset */
      .main-content,
      .dashboard-container > main,
      .content-wrapper {
        margin-left: 260px;
        min-height: 100vh;
      }

      /* ========== RESPONSIVE ========== */
      @media (max-width: 768px) {
        .sidebar {
          transform: translateX(-100%);
        }

        .sidebar.active {
          transform: translateX(0);
        }

        .menu-toggle {
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .main-content,
        .dashboard-container > main,
        .content-wrapper {
          margin-left: 0;
        }

        /* Overlay when sidebar is open */
        .sidebar.active::after {
          content: '';
          position: fixed;
          top: 0;
          left: 260px;
          right: 0;
          bottom: 0;
          background: rgba(0,0,0,0.5);
          z-index: -1;
        }
      }
    `;
    
    document.head.appendChild(styles);
  }

  // Initialiser les événements
  function initEvents() {
    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (menuToggle && sidebar) {
      menuToggle.addEventListener('click', (e) => {
        e.stopPropagation();
        sidebar.classList.toggle('active');
      });

      // Fermer la sidebar en cliquant à l'extérieur
      document.addEventListener('click', (e) => {
        if (sidebar.classList.contains('active') && 
            !sidebar.contains(e.target) && 
            !menuToggle.contains(e.target)) {
          sidebar.classList.remove('active');
        }
      });

      // Fermer avec Escape
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && sidebar.classList.contains('active')) {
          sidebar.classList.remove('active');
        }
      });
    }
  }

  // Initialisation principale
  function init() {
    // Injecter les styles
    injectStyles();
    
    // Trouver le container
    const container = document.getElementById('sidebar-container');
    
    if (container) {
      // Injecter le HTML
      container.innerHTML = generateSidebarHTML();
    } else {
      // Si pas de container, insérer au début du body
      const sidebarWrapper = document.createElement('div');
      sidebarWrapper.id = 'sidebar-container';
      sidebarWrapper.innerHTML = generateSidebarHTML();
      document.body.insertBefore(sidebarWrapper, document.body.firstChild);
    }
    
    // Initialiser les événements
    initEvents();
    
    console.log('✅ MAKERHUB Sidebar initialized');
  }

  // Lancer l'initialisation au chargement du DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

  // Exposer l'API publique
  window.MakerhubSidebar = {
    init,
    getActivePage,
    MENU_ITEMS
  };

})();