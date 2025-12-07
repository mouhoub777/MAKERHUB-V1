// dashboard.js - Development Version with Timeout Protection
(function() {
  'use strict';

  console.log('Dashboard.js loading...');

  // Get config from window
  const Config = window.MAKERHUB_CONFIG || {};
  const API_URL = Config.NODE_API_URL || 'http://localhost:3000';

  // Force load after 3 seconds if Firebase timeout
  setTimeout(() => {
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay && loadingOverlay.style.display !== 'none') {
      console.warn('⚠️ Firebase timeout - forcing dashboard load');
      loadingOverlay.style.display = 'none';
      initializeDashboard();
    }
  }, 3000);

  // Check Firebase initialization status
  (function checkFirebase() {
    console.log('Checking Firebase status...');
    console.log('firebaseServices:', !!window.firebaseServices);
    console.log('firebaseServices.auth:', window.firebaseServices ? !!window.firebaseServices.auth : false);
    console.log('firebaseServices.db:', window.firebaseServices ? !!window.firebaseServices.db : false);

    if (window.firebaseServices && window.firebaseServices.auth && window.firebaseServices.db) {
      console.log('✅ Firebase is ready, initializing dashboard...');
      initializeDashboard();
    } else {
      console.log('⏳ Waiting for Firebase...');
      setTimeout(checkFirebase, 50);
    }
  })();

  function initializeDashboard() {
    console.log('🚀 Initializing dashboard...');
    
    // Hide loading overlay
    const loadingOverlay = document.getElementById('loadingOverlay');
    if (loadingOverlay) {
      loadingOverlay.style.display = 'none';
    }

    // Check auth state using centralized services
    const auth = window.firebaseServices ? window.firebaseServices.auth : null;
    const db = window.firebaseServices ? window.firebaseServices.db : null;

    if (!auth || !db) {
      console.error('❌ Firebase services not available');
      showError('Firebase services not initialized');
      return;
    }

    // Auth state observer
    auth.onAuthStateChanged(async (user) => {
      if (user) {
        console.log('✅ User authenticated:', user.email);
        
        // Update user info in header
        const userName = document.getElementById('userName');
        const userEmail = document.getElementById('userEmail');
        const userAvatar = document.getElementById('userAvatar');
        
        if (userName) userName.textContent = user.displayName || 'User';
        if (userEmail) userEmail.textContent = user.email;
        if (userAvatar) userAvatar.textContent = (user.displayName || user.email || 'U').charAt(0).toUpperCase();
        
        // Load user data
        try {
          const userDoc = await db.collection('users').doc(user.uid).get();
          if (userDoc.exists) {
            const userData = userDoc.data();
            console.log('User data loaded:', userData);
            updateDashboardUI(userData);
          } else {
            console.warn('User document not found');
          }
        } catch (error) {
          console.error('Error loading user data:', error);
        }

        // Initialize dashboard features
        initializeSidebar();
        initializeFeatures();
        
      } else {
        console.log('❌ No user authenticated, redirecting to auth...');
        window.location.href = '/auth.html';
      }
    });
  }

  function updateDashboardUI(userData) {
    // Update user name if available
    const userName = document.getElementById('userName');
    if (userName && userData.profileName) {
      userName.textContent = userData.profileName;
    }
  }

  function initializeSidebar() {
    console.log('Initializing sidebar...');
    
    // Mobile menu toggle
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (menuToggle && sidebar) {
      menuToggle.addEventListener('click', () => {
        sidebar.classList.toggle('active');
      });
      
      // Close sidebar when clicking outside
      document.addEventListener('click', (e) => {
        if (!sidebar.contains(e.target) && !menuToggle.contains(e.target) && sidebar.classList.contains('active')) {
          sidebar.classList.remove('active');
        }
      });
    }

    // Logout button
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', async (e) => {
        e.preventDefault();
        try {
          const auth = window.firebaseServices ? window.firebaseServices.auth : null;
          if (auth) {
            await auth.signOut();
            console.log('✅ Logged out successfully');
            window.location.href = '/auth.html';
          }
        } catch (error) {
          console.error('Logout error:', error);
        }
      });
    }
  }

  function initializeFeatures() {
    console.log('Initializing features...');
    
    const featureCards = document.querySelectorAll('.feature-card');
    
    featureCards.forEach(card => {
      const featureBtn = card.querySelector('.feature-cta');
      if (featureBtn) {
        featureBtn.addEventListener('click', (e) => {
          e.preventDefault();
          const feature = card.dataset.feature;
          handleFeatureClick(feature);
        });
      }
    });
  }

  function handleFeatureClick(feature) {
    console.log('Feature clicked:', feature);
    
    switch(feature) {
      case 'telegram':
        // Redirect to create landing page
        window.location.href = '/createLanding.html';
        break;
      case 'profile':
        window.location.href = '/createProfile.html';
        break;
      case 'landing':
        window.location.href = '/createLanding.html';
        break;
      case 'email':
        window.location.href = '/emails.html';
        break;
      case 'boutique':
        window.location.href = '/boutique.html';
        break;
      case 'analytics':
        window.location.href = '/telegramstats.html';
        break;
      default:
        console.log('Unknown feature:', feature);
    }
  }

  function showError(message) {
    console.error('Dashboard error:', message);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error-message';
    errorDiv.textContent = message;
    errorDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #ff6b6b;
      color: white;
      padding: 16px 24px;
      border-radius: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
    `;
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
      errorDiv.remove();
    }, 5000);
  }

  // Development helpers
  window.dashboardDebug = {
    showError: showError,
    checkAuth: () => {
      const auth = window.firebaseServices ? window.firebaseServices.auth : null;
      const user = auth ? auth.currentUser : null;
      console.log('Current user:', user ? user.email : 'None');
      return user;
    },
    getConfig: () => {
      console.log('Config:', Config);
      return Config;
    }
  };
  console.log('🛠️ Dashboard debug helpers available at window.dashboardDebug');

})();