/* =========================================================================
 *  ajoutcanal.js - MakerHub / BrandLynk
 *  Telegram channel connection + CSP-safe navigation (script-src-attr 'none')
 *  VERSION 2.1 - CSP COMPATIBLE - NO INLINE EVENT HANDLERS - FIXED ENCODING
 *  NO HTML/CSS in this file - only JS.
 * ========================================================================= */
(function () {
  'use strict';

  console.log('[MAKERHUB] Connect Channel v2.1 loaded');

  // -----------------------------------------------------------------------
  // GLOBAL STATE
  // -----------------------------------------------------------------------
  let currentPageId = null;
  let auth = null;
  let db = null;
  let isSubmitting = false;

  // -----------------------------------------------------------------------
  // DOM HELPERS
  // -----------------------------------------------------------------------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  // -----------------------------------------------------------------------
  // TOASTS / UI
  // -----------------------------------------------------------------------
  function showToast(message, type = 'info') {
    const container = $('#toastContainer');
    if (!container) return;
    const existing = container.querySelectorAll('.toast');
    if (existing.length >= 3) existing[0].remove();

    const el = document.createElement('div');
    el.className = 'toast toast-' + type;
    el.style.cssText = 'display:flex;align-items:center;gap:12px;padding:14px 18px;background:#fff;border-radius:10px;box-shadow:0 4px 20px rgba(0,0,0,0.15);margin-bottom:10px;min-width:300px;max-width:450px;animation:slideIn 0.3s ease;';
    
    // Icon container - FORCE styles to override any CSS
    const iconSpan = document.createElement('span');
    iconSpan.style.cssText = 'display:flex;align-items:center;justify-content:center;width:24px;height:24px;flex-shrink:0;font-size:18px;';
    
    // Use Font Awesome icons - force inline styles
    const iconEl = document.createElement('i');
    if (type === 'success') {
      iconEl.className = 'fas fa-check-circle';
      iconEl.style.color = '#22c55e';
    } else if (type === 'error') {
      iconEl.className = 'fas fa-exclamation-circle';
      iconEl.style.color = '#ef4444';
    } else if (type === 'warning') {
      iconEl.className = 'fas fa-exclamation-triangle';
      iconEl.style.color = '#f59e0b';
    } else {
      iconEl.className = 'fas fa-info-circle';
      iconEl.style.color = '#3b82f6';
    }
    iconSpan.appendChild(iconEl);
    
    // Message content
    const contentSpan = document.createElement('span');
    contentSpan.style.cssText = 'flex:1;font-size:14px;color:#333;line-height:1.4;';
    contentSpan.textContent = message;
    
    // Close button - FORCE styles
    const closeBtn = document.createElement('button');
    closeBtn.style.cssText = 'background:none;border:none;cursor:pointer;padding:4px;display:flex;align-items:center;justify-content:center;color:#999;font-size:14px;';
    closeBtn.setAttribute('aria-label', 'Close');
    
    const closeIcon = document.createElement('i');
    closeIcon.className = 'fas fa-times';
    closeBtn.appendChild(closeIcon);
    
    // Hover effect
    closeBtn.addEventListener('mouseenter', function() { this.style.color = '#333'; });
    closeBtn.addEventListener('mouseleave', function() { this.style.color = '#999'; });
    
    // CSP SAFE: addEventListener instead of onclick
    closeBtn.addEventListener('click', function() {
      el.remove();
    });
    
    el.appendChild(iconSpan);
    el.appendChild(contentSpan);
    el.appendChild(closeBtn);
    
    container.appendChild(el);

    // Animations with inline styles (no CSS dependency)
    el.style.opacity = '0';
    el.style.transform = 'translateX(100%)';
    
    setTimeout(() => {
      el.style.transition = 'all 0.3s ease';
      el.style.opacity = '1';
      el.style.transform = 'translateX(0)';
    }, 10);
    
    setTimeout(() => {
      if (!el.parentNode) return;
      el.style.opacity = '0';
      el.style.transform = 'translateX(100%)';
      setTimeout(() => el.parentNode && el.remove(), 300);
    }, 5000);
  }

  function showLoading(show) {
    const overlay = $('#loadingOverlay');
    if (overlay) overlay.style.display = show ? 'flex' : 'none';
    const connectBtn = $('#connectBtn');
    if (connectBtn) {
      const btnSpan = connectBtn.querySelector('span');
      if (btnSpan) {
        btnSpan.textContent = show ? 'Connecting...' : 'Connect Channel';
      }
      connectBtn.disabled = !!show;
    }
  }

  function disableForm(disabled) {
    const form = $('#canalForm');
    if (!form) return;
    form.querySelectorAll('input,select,button,textarea').forEach((el) => {
      el.disabled = !!disabled;
    });
  }

  // -----------------------------------------------------------------------
  // NAVIGATION / REDIRECTIONS (CSP SAFE)
  // -----------------------------------------------------------------------
  function handleBackNavigation() {
    console.log('[NAV] Handling back navigation...');
    try {
      if (window.history.length > 1) {
        window.history.back();
        return;
      }
    } catch (_) {}
    const target = currentPageId
      ? `/telegramsubscription.html?page=${encodeURIComponent(currentPageId)}`
      : '/telegramsubscription.html';
    window.location.href = target;
  }

  function redirectToTelegramDashboard() {
    console.log('[NAV] Redirecting to Telegram Dashboard...');
    const params = [];
    if (currentPageId) params.push(`page=${encodeURIComponent(currentPageId)}`);
    params.push('connected=true', 'activated=true');
    window.location.href = `/telegramsubscription.html?${params.join('&')}`;
  }

  function redirectToTelegramPage(success = false) {
    showToast('Redirecting to subscription page...', 'info');
    const params = [];
    if (currentPageId) params.push(`page=${encodeURIComponent(currentPageId)}`);
    if (success) params.push('connected=true', 'activated=true');
    const url = `/telegramsubscription.html${params.length ? '?' + params.join('&') : ''}`;
    console.log('[NAV] Final Redirection URL:', url);
    setTimeout(() => (window.location.href = url), 500);
  }

  // -----------------------------------------------------------------------
  // FIREBASE BOOTSTRAP
  // -----------------------------------------------------------------------
  async function waitForFirebase() {
    console.log('[FIREBASE] Waiting for Firebase...');
    return new Promise((resolve) => {
      let i = 0;
      const max = 50; // ~5s
      const t = setInterval(() => {
        i++;
        if (window.firebaseAuth && window.firebaseDb) {
          clearInterval(t);
          console.log('[FIREBASE] Ready (window.firebaseAuth/firebaseDb)');
          return resolve();
        }
        if (window.firebaseServices?.auth && window.firebaseServices?.db) {
          clearInterval(t);
          console.log('[FIREBASE] Services found (window.firebaseServices)');
          return resolve();
        }
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
          clearInterval(t);
          console.log('[FIREBASE] Compat global detected (firebase.*)');
          return resolve();
        }
        if (i >= max) {
          clearInterval(t);
          console.warn('[FIREBASE] Timeout - continuing anyway');
          return resolve();
        }
      }, 100);
    });
  }

  function initializeFirebase() {
    console.log('[FIREBASE] Initializing references...');
    if (window.firebaseAuth && window.firebaseDb) {
      auth = window.firebaseAuth;
      db = window.firebaseDb;
    } else if (window.firebaseServices?.auth && window.firebaseServices?.db) {
      auth = window.firebaseServices.auth;
      db = window.firebaseServices.db;
    } else if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
      auth = firebase.auth(); // compat
      db = firebase.firestore();
    } else {
      console.error('[FIREBASE] Services not available');
      showToast('Firebase loading error. Please refresh the page.', 'error');
      return;
    }

    auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('[AUTH] User authenticated:', user.email);
        initializeForm();
        checkPageExists();
      } else {
        console.log('[AUTH] User not authenticated, redirecting...');
        window.location.href = '/auth.html';
      }
    });
  }

  // -----------------------------------------------------------------------
  // FIRESTORE: PAGE / STATUS
  // -----------------------------------------------------------------------
  async function checkPageExists() {
    if (!currentPageId) {
      console.error('[PAGE] No page ID provided');
      showToast('No page selected', 'error');
      setTimeout(() => (window.location.href = '/telegramsubscription.html'), 2000);
      return;
    }
    
    try {
      const pageDoc = await db.collection('landingPages').doc(currentPageId).get();
      if (!pageDoc.exists) {
        console.error('[PAGE] Page not found:', currentPageId);
        showToast('Page not found. Redirecting...', 'error');
        setTimeout(() => (window.location.href = '/telegramsubscription.html'), 2000);
        return;
      }
      
      // Verify ownership
      const data = pageDoc.data() || {};
      if (data.creatorId && auth.currentUser && data.creatorId !== auth.currentUser.uid) {
        console.error('[PAGE] Unauthorized access to page:', currentPageId);
        showToast('Unauthorized access to this page', 'error');
        setTimeout(() => (window.location.href = '/telegramsubscription.html'), 2000);
        return;
      }
      
      console.log('[PAGE] Page found:', data.brand || data.slug || currentPageId);
      updatePageInfo(data);
      if (data.telegram?.isConnected) showExistingChannel(data.telegram);
    } catch (err) {
      console.error('[PAGE] Error checking page:', err);
      showToast('Error verifying page', 'error');
    }
  }

  function updatePageInfo(pageData) {
    const hint = $('#currentPageHint');
    if (hint) hint.textContent = pageData.slug || pageData.brand || currentPageId || '-';
  }

  function showExistingChannel(telegramData) {
    const channelLink = $('#channelLink');
    if (channelLink && telegramData.channelLink) channelLink.value = telegramData.channelLink;
    showToast('This page already has a Telegram channel connected', 'info');
    console.log('[CHANNEL] Existing channel:', {
      channelName: telegramData.channelName,
      channelLink: telegramData.channelLink,
      connectedAt: telegramData.connectedAt
    });
  }

  async function updatePageActiveStatus(pageId, isActive = true) {
    try {
      console.log(`[PAGE] Updating page ${pageId} active status ->`, isActive);
      await db.collection('landingPages').doc(pageId).update({
        isActive: isActive,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('[PAGE] Status updated successfully');
      return true;
    } catch (err) {
      console.error('[PAGE] Error updating status:', err);
      return false;
    }
  }

  // -----------------------------------------------------------------------
  // FORM LOGIC
  // -----------------------------------------------------------------------
  function initializeForm() {
    const pageIdField = $('#pageId');
    if (pageIdField && currentPageId) pageIdField.value = currentPageId;

    const canalForm = $('#canalForm');
    if (canalForm) {
      // CSP SAFE: addEventListener instead of onsubmit
      canalForm.addEventListener('submit', handleFormSubmit);
    }
  }

  async function handleFormSubmit(e) {
    e.preventDefault();
    if (isSubmitting) return;

    const linkInput = $('#channelLink');
    const rawLink = linkInput ? linkInput.value.trim() : '';

    if (!rawLink) {
      showToast('Please enter a Telegram channel link', 'error');
      return;
    }

    const extracted = extractTelegramIdentifier(rawLink);
    if (!extracted.success) {
      showToast(extracted.error || 'Invalid Telegram link', 'error');
      return;
    }

    isSubmitting = true;
    disableForm(true);
    showLoading(true);

    try {
      console.log('[TELEGRAM] Connecting channel:', extracted);

      // Update Firestore
      await db.collection('landingPages').doc(currentPageId).update({
        telegram: {
          channelLink: extracted.fullLink,
          channelType: extracted.type,
          channelIdentifier: extracted.identifier,
          isConnected: true,
          connectedAt: firebase.firestore.FieldValue.serverTimestamp()
        },
        isActive: true,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      console.log('[TELEGRAM] Channel connected successfully');
      showToast('Telegram channel connected successfully!', 'success');

      // Try to verify with Python backend (optional)
      try {
        const response = await fetch('/api/python/telegram/channel-info?' + new URLSearchParams({
          channel_id: extracted.identifier
        }));
        
        if (response.ok) {
          const info = await response.json();
          console.log('[TELEGRAM] Channel verified by backend:', info);
          
          // Update with channel name if available
          if (info.title) {
            await db.collection('landingPages').doc(currentPageId).update({
              'telegram.channelName': info.title
            });
          }
        }
      } catch (verifyError) {
        console.warn('[TELEGRAM] Backend verification skipped:', verifyError.message);
      }

      // Redirect to dashboard with success params
      setTimeout(() => {
        redirectToTelegramDashboard();
      }, 1500);

    } catch (err) {
      console.error('[TELEGRAM] Error connecting channel:', err);
      showToast('Connection error: ' + err.message, 'error');
    } finally {
      isSubmitting = false;
      disableForm(false);
      showLoading(false);
    }
  }

  // -----------------------------------------------------------------------
  // TELEGRAM LINK EXTRACTION (ROBUST)
  // -----------------------------------------------------------------------
  function extractTelegramIdentifier(input) {
    if (!input || typeof input !== 'string') {
      return { success: false, error: 'Empty or invalid link' };
    }

    let s = input.trim();

    // Handle @username format
    if (s.startsWith('@')) {
      const username = s.substring(1);
      if (/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(username)) {
        return {
          success: true,
          type: 'public_channel',
          identifier: username,
          fullLink: `https://t.me/${username}`,
          format: 'at_username'
        };
      }
      return { success: false, error: 'Invalid username format' };
    }

    // Add protocol if missing
    if (!/^https?:\/\//.test(s) && !s.startsWith('tg://')) {
      if (s.startsWith('t.me/') || s.startsWith('telegram.me/')) {
        s = 'https://' + s;
      } else if (/^[a-zA-Z][a-zA-Z0-9_]{3,31}$/.test(s)) {
        return {
          success: true,
          type: 'public_channel',
          identifier: s,
          fullLink: `https://t.me/${s}`,
          format: 'username_only'
        };
      } else {
        return { success: false, error: 'Unrecognized link format' };
      }
    }

    try {
      const url = new URL(s);
      const host = url.hostname.toLowerCase();
      const valid = ['t.me', 'telegram.me', 'telegram.dog'];
      if (!valid.includes(host)) return { success: false, error: 'Domain not recognized as Telegram' };

      const path = url.pathname || '';

      // /+HASH (private invite)
      if (path.startsWith('/+')) {
        const hash = path.substring(2).split('/')[0];
        if (hash.length >= 10 && /^[A-Za-z0-9_-]+$/.test(hash)) {
          return {
            success: true,
            type: 'private_invite',
            identifier: hash,
            fullLink: `https://t.me/+${hash}`,
            format: 'plus_prefix'
          };
        }
        return { success: false, error: 'Invalid invitation hash' };
      }

      // /joinchat/HASH (legacy private invite)
      if (path.startsWith('/joinchat/')) {
        const hash = path.substring(10).split('/')[0];
        if (hash.length >= 10 && /^[A-Za-z0-9_-]+$/.test(hash)) {
          return {
            success: true,
            type: 'private_invite',
            identifier: hash,
            fullLink: `https://t.me/joinchat/${hash}`,
            format: 'joinchat'
          };
        }
        return { success: false, error: 'Invalid joinchat hash' };
      }

      // /username (public)
      const m = path.match(/^\/([a-zA-Z][a-zA-Z0-9_]{3,31})(\/|$)/);
      if (m) {
        const username = m[1];
        const reserved = ['share', 'addstickers', 'proxy', 'setlanguage'];
        if (reserved.includes(username.toLowerCase())) {
          return { success: false, error: 'This link is not a channel or group' };
        }
        return {
          success: true,
          type: 'public_channel',
          identifier: username,
          fullLink: `https://t.me/${username}`,
          format: 'username'
        };
      }

      // tg://join?invite=...
      if (url.protocol === 'tg:') {
        if (url.pathname === 'join' && url.searchParams.has('invite')) {
          const hash = url.searchParams.get('invite');
          if (hash && hash.length >= 10 && /^[A-Za-z0-9_-]+$/.test(hash)) {
            return {
              success: true,
              type: 'private_invite',
              identifier: hash,
              fullLink: `https://t.me/+${hash}`,
              format: 'deep_link'
            };
          }
        }
        return { success: false, error: 'Invalid Telegram deep link' };
      }

      return { success: false, error: 'Unrecognized Telegram URL format' };
    } catch (e) {
      return { success: false, error: 'Parse error: ' + e.message };
    }
  }

  // -----------------------------------------------------------------------
  // SUCCESS UI
  // -----------------------------------------------------------------------
  function showSuccess() {
    const formSection = $('#formSection');
    const statusCard = $('#statusCard');
    if (formSection) formSection.style.display = 'none';
    if (statusCard) statusCard.style.display = 'flex';
  }

  function showForm() {
    const formSection = $('#formSection');
    const statusCard = $('#statusCard');
    if (formSection) formSection.style.display = 'block';
    if (statusCard) statusCard.style.display = 'none';
    
    const channelLink = $('#channelLink');
    if (channelLink) channelLink.focus();
  }

  // -----------------------------------------------------------------------
  // EVENT LISTENERS SETUP (CSP SAFE - NO INLINE HANDLERS)
  // -----------------------------------------------------------------------
  function setupEventListeners() {
    // Back buttons
    const backButtonTop = $('#backButtonTop');
    if (backButtonTop) {
      backButtonTop.addEventListener('click', handleBackNavigation);
    }
    
    const backButtonBottom = $('#backButtonBottom');
    if (backButtonBottom) {
      backButtonBottom.addEventListener('click', handleBackNavigation);
    }
    
    // Dashboard button
    const backToDashboardBtn = $('#backToDashboardBtn');
    if (backToDashboardBtn) {
      backToDashboardBtn.addEventListener('click', redirectToTelegramDashboard);
    }
    
    // Success screen buttons
    const goToDashboardSuccess = $('#goToDashboardSuccess');
    if (goToDashboardSuccess) {
      goToDashboardSuccess.addEventListener('click', redirectToTelegramDashboard);
    }
    
    const backToEdit = $('#backToEdit');
    if (backToEdit) {
      backToEdit.addEventListener('click', showForm);
    }
    
    // Mobile menu
    const menuToggle = $('#menuToggle');
    const sidebar = $('#sidebar');
    if (menuToggle && sidebar) {
      menuToggle.addEventListener('click', function() {
        sidebar.classList.toggle('active');
      });
      
      // Close sidebar on outside click
      document.addEventListener('click', function(e) {
        if (window.innerWidth <= 768 && 
            !sidebar.contains(e.target) && 
            !menuToggle.contains(e.target) && 
            sidebar.classList.contains('active')) {
          sidebar.classList.remove('active');
        }
      });
    }
    
    // Sign out
    const signoutBtn = $('#signoutBtn');
    if (signoutBtn) {
      signoutBtn.addEventListener('click', async function(e) {
        e.preventDefault();
        if (auth) {
          try {
            await auth.signOut();
            window.location.href = '/auth.html';
          } catch (error) {
            console.error('[AUTH] Sign out error:', error);
            showToast('Logout error', 'error');
          }
        }
      });
    }
  }

  // -----------------------------------------------------------------------
  // DEBUG HELPERS
  // -----------------------------------------------------------------------
  window.debugStorage = function () {
    console.log('=== STORAGE DEBUG ===');
    console.log('SessionStorage:');
    Object.keys(sessionStorage).forEach((k) => {
      if (k.includes('makerhub') || k.includes('Landing')) {
        console.log(' ', k, sessionStorage.getItem(k));
      }
    });
    console.log('LocalStorage:');
    Object.keys(localStorage).forEach((k) => {
      if (k.includes('makerhub') || k.includes('Landing')) {
        console.log(' ', k, localStorage.getItem(k));
      }
    });
    console.log('Current Page ID:', currentPageId);
    console.log('===================');
  };

  window.testTelegramLinks = function () {
    const tests = [
      'https://t.me/+dkxPXujHaPM1NjRk',
      'https://t.me/mychannel',
      't.me/joinchat/ABC123def456GHI',
      '@testchannel',
      'testuser123',
      'https://telegram.me/mygroup',
      'tg://join?invite=ABC123',
      'invalide.com/test',
      't.me/+abc',
      'https://t.me/share/url?url=test'
    ];
    console.log('=== TEST TELEGRAM LINK EXTRACTION ===');
    tests.forEach((link) => {
      const res = extractTelegramIdentifier(link);
      console.log('\nLink:', JSON.stringify(link), '\nResult:', res);
    });
    console.log('=====================================');
  };

  window.debugAjoutCanal = function() {
    return {
      currentPageId,
      auth: auth ? { currentUser: auth.currentUser?.email } : null,
      db: db ? 'Connected' : null,
      isSubmitting
    };
  };

  // -----------------------------------------------------------------------
  // GLOBAL HANDLERS
  // -----------------------------------------------------------------------
  window.addEventListener('unhandledrejection', (e) => {
    console.error('[ERROR] Unhandled promise rejection:', e?.reason);
    showToast('An unexpected error occurred', 'error');
  });

  window.addEventListener('beforeunload', () => {
    if (currentPageId) {
      sessionStorage.setItem('lastVisitedPageId', currentPageId);
      localStorage.setItem('makerhub_last_page', currentPageId);
    }
  });

  // -----------------------------------------------------------------------
  // BOOT
  // -----------------------------------------------------------------------
  document.addEventListener('DOMContentLoaded', async () => {
    console.log('[INIT] DOM loaded, initializing channel manager...');

    // Get page ID from URL or storage
    const q = new URLSearchParams(window.location.search);
    currentPageId =
      q.get('page') ||
      sessionStorage.getItem('currentLandingPageId') ||
      localStorage.getItem('currentLandingPageId') ||
      localStorage.getItem('makerhub_current_page');

    if (currentPageId) {
      sessionStorage.setItem('currentLandingPageId', currentPageId);
      localStorage.setItem('currentLandingPageId', currentPageId);
      localStorage.setItem('makerhub_current_page', currentPageId);
      console.log('[INIT] Page ID:', currentPageId);
    } else {
      // Try to get from last created pages
      const all = JSON.parse(localStorage.getItem('makerhub_all_pages') || '[]');
      if (all.length > 0) {
        currentPageId = all[all.length - 1].channelSlug || all[all.length - 1].id;
        sessionStorage.setItem('currentLandingPageId', currentPageId);
        localStorage.setItem('currentLandingPageId', currentPageId);
        localStorage.setItem('makerhub_current_page', currentPageId);
        console.log('[INIT] Using last created page:', currentPageId);
      }
    }

    if (!currentPageId) {
      showToast('No page selected', 'error');
      setTimeout(() => (window.location.href = '/telegramsubscription.html'), 2000);
      return;
    }

    // Setup event listeners immediately (CSP SAFE)
    setupEventListeners();

    // Wait for Firebase and initialize
    await waitForFirebase();
    initializeFirebase();
  });
})();