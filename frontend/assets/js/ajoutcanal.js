/* =========================================================================
 *  ajoutcanal.js — MakerHub / BrandLynk
 *  Connexion d'un canal Telegram + navigation CSP-safe (script-src-attr 'none')
 *  VERSION 2.0 - CSP COMPATIBLE - NO INLINE EVENT HANDLERS
 *  AUCUN HTML/CSS dans ce fichier — uniquement du JS.
 * ========================================================================= */
(function () {
  'use strict';

  console.log('📱 MAKERHUB Connect Channel v2.0 CSP-Safe loaded');

  // -----------------------------------------------------------------------
  // ÉTAT GLOBAL
  // -----------------------------------------------------------------------
  let currentPageId = null;
  let auth = null;
  let db = null;
  let isSubmitting = false;

  // -----------------------------------------------------------------------
  // HELPERS DOM
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
    el.className = `toast ${type}`;
    
    // CSP SAFE: Build toast with DOM methods
    const iconSpan = document.createElement('span');
    iconSpan.className = 'toast-icon';
    iconSpan.textContent = type === 'success' ? '✅' : type === 'error' ? '⛔' : 'ℹ️';
    
    const contentSpan = document.createElement('span');
    contentSpan.className = 'toast-content';
    contentSpan.textContent = message;
    
    const closeBtn = document.createElement('button');
    closeBtn.className = 'toast-close';
    closeBtn.setAttribute('aria-label', 'Fermer');
    closeBtn.textContent = '✖';
    
    // CSP SAFE: addEventListener instead of onclick
    closeBtn.addEventListener('click', function() {
      el.remove();
    });
    
    el.appendChild(iconSpan);
    el.appendChild(contentSpan);
    el.appendChild(closeBtn);
    
    container.appendChild(el);

    // Animations (déclarées en CSS)
    setTimeout(() => (el.style.animation = 'slideIn .3s ease forwards'), 10);
    setTimeout(() => {
      if (!el.parentNode) return;
      el.style.animation = 'slideOut .3s ease forwards';
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
        btnSpan.textContent = show ? 'Connexion...' : 'Connect Channel';
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
    console.log('↩️ Handling back navigation...');
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
    console.log('🚀 Redirecting to Telegram Dashboard...');
    const params = [];
    if (currentPageId) params.push(`page=${encodeURIComponent(currentPageId)}`);
    params.push('connected=true', 'activated=true');
    window.location.href = `/telegramsubscription.html?${params.join('&')}`;
  }

  function redirectToTelegramPage(success = false) {
    showToast("Redirection vers la page d'abonnement...", 'info');
    const params = [];
    if (currentPageId) params.push(`page=${encodeURIComponent(currentPageId)}`);
    if (success) params.push('connected=true', 'activated=true');
    const url = `/telegramsubscription.html${params.length ? '?' + params.join('&') : ''}`;
    console.log('Final Redirection URL:', url);
    setTimeout(() => (window.location.href = url), 500);
  }

  // -----------------------------------------------------------------------
  // FIREBASE BOOTSTRAP (SOUPLE : compat window.* ou compat global)
  // -----------------------------------------------------------------------
  async function waitForFirebase() {
    console.log('⏳ Waiting for Firebase...');
    return new Promise((resolve) => {
      let i = 0;
      const max = 50; // ~5s
      const t = setInterval(() => {
        i++;
        if (window.firebaseAuth && window.firebaseDb) {
          clearInterval(t);
          console.log('✅ Firebase is ready! (window.firebaseAuth/firebaseDb)');
          return resolve();
        }
        if (window.firebaseServices?.auth && window.firebaseServices?.db) {
          clearInterval(t);
          console.log('✅ Firebase services found! (window.firebaseServices)');
          return resolve();
        }
        if (typeof firebase !== 'undefined' && firebase.auth && firebase.firestore) {
          clearInterval(t);
          console.log('✅ Firebase compat global detected (firebase.*)');
          return resolve();
        }
        if (i >= max) {
          clearInterval(t);
          console.warn('⚠️ Firebase timeout - continuing anyway');
          return resolve();
        }
      }, 100);
    });
  }

  function initializeFirebase() {
    console.log('🔥 Initializing Firebase references...');
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
      console.error('❌ Firebase services not available');
      showToast('Erreur de chargement Firebase. Veuillez rafraîchir la page.', 'error');
      return;
    }

    auth.onAuthStateChanged((user) => {
      if (user) {
        console.log('👤 User authenticated:', user.email);
        initializeForm();
        checkPageExists();
      } else {
        console.log('❌ User not authenticated, redirecting...');
        window.location.href = '/auth.html';
      }
    });
  }

  // -----------------------------------------------------------------------
  // FIRESTORE : PAGE / STATUT
  // -----------------------------------------------------------------------
  async function checkPageExists() {
    if (!currentPageId) {
      console.error('❌ No page ID provided');
      showToast('Aucune page sélectionnée', 'error');
      setTimeout(() => (window.location.href = '/telegramsubscription.html'), 2000);
      return;
    }
    
    try {
      const pageDoc = await db.collection('landingPages').doc(currentPageId).get();
      if (!pageDoc.exists) {
        console.error('❌ Page not found:', currentPageId);
        showToast('Page introuvable. Redirection...', 'error');
        setTimeout(() => (window.location.href = '/telegramsubscription.html'), 2000);
        return;
      }
      
      // Verify ownership
      const data = pageDoc.data() || {};
      if (data.creatorId && auth.currentUser && data.creatorId !== auth.currentUser.uid) {
        console.error('❌ Unauthorized access to page:', currentPageId);
        showToast('Accès non autorisé à cette page', 'error');
        setTimeout(() => (window.location.href = '/telegramsubscription.html'), 2000);
        return;
      }
      
      console.log('✅ Page found:', data.brand || data.slug || currentPageId);
      updatePageInfo(data);
      if (data.telegram?.isConnected) showExistingChannel(data.telegram);
    } catch (err) {
      console.error('❌ Error checking page:', err);
      showToast('Erreur de vérification de la page', 'error');
    }
  }

  function updatePageInfo(pageData) {
    const hint = $('#currentPageHint');
    if (hint) hint.textContent = pageData.slug || pageData.brand || currentPageId || '—';
  }

  function showExistingChannel(telegramData) {
    const channelLink = $('#channelLink');
    if (channelLink && telegramData.channelLink) channelLink.value = telegramData.channelLink;
    showToast('Cette page a déjà un canal Telegram connecté', 'info');
    console.log('Canal existant:', {
      channelName: telegramData.channelName,
      channelLink: telegramData.channelLink,
      connectedAt: telegramData.connectedAt
    });
  }

  async function updatePageActiveStatus(pageId, isActive = true) {
    try {
      console.log(`📝 Updating page ${pageId} active status ->`, isActive);
      await db.collection('landingPages').doc(pageId).update({
        isActive: isActive,
        updatedAt: firebase.firestore.FieldValue.serverTimestamp()
      });
      console.log('✅ Page status updated successfully');
      return true;
    } catch (err) {
      console.error('❌ Error updating page status:', err);
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
      showToast('Veuillez entrer un lien de canal Telegram', 'error');
      return;
    }

    const extracted = extractTelegramIdentifier(rawLink);
    if (!extracted.success) {
      showToast(extracted.error || 'Lien Telegram invalide', 'error');
      return;
    }

    isSubmitting = true;
    disableForm(true);
    showLoading(true);

    try {
      console.log('📡 Connecting Telegram channel:', extracted);

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

      console.log('✅ Channel connected successfully');
      showToast('Canal Telegram connecté avec succès!', 'success');

      // Try to verify with Python backend (optional)
      try {
        const response = await fetch('/api/python/telegram/channel-info?' + new URLSearchParams({
          channel_id: extracted.identifier
        }));
        
        if (response.ok) {
          const info = await response.json();
          console.log('✅ Channel verified by backend:', info);
          
          // Update with channel name if available
          if (info.title) {
            await db.collection('landingPages').doc(currentPageId).update({
              'telegram.channelName': info.title
            });
          }
        }
      } catch (verifyError) {
        console.warn('⚠️ Backend verification skipped:', verifyError.message);
      }

      // Redirect to dashboard with success params
      setTimeout(() => {
        redirectToTelegramDashboard();
      }, 1500);

    } catch (err) {
      console.error('❌ Error connecting channel:', err);
      showToast('Erreur lors de la connexion: ' + err.message, 'error');
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
      return { success: false, error: 'Lien vide ou invalide' };
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
      return { success: false, error: "Nom d'utilisateur invalide" };
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
        return { success: false, error: 'Format non reconnu' };
      }
    }

    try {
      const url = new URL(s);
      const host = url.hostname.toLowerCase();
      const valid = ['t.me', 'telegram.me', 'telegram.dog'];
      if (!valid.includes(host)) return { success: false, error: 'Domaine non reconnu comme Telegram' };

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
        return { success: false, error: "Hash d'invitation invalide" };
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
        return { success: false, error: 'Hash joinchat invalide' };
      }

      // /username (public)
      const m = path.match(/^\/([a-zA-Z][a-zA-Z0-9_]{3,31})(\/|$)/);
      if (m) {
        const username = m[1];
        const reserved = ['share', 'addstickers', 'proxy', 'setlanguage'];
        if (reserved.includes(username.toLowerCase())) {
          return { success: false, error: "Ce lien n'est pas un canal/groupe" };
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
        return { success: false, error: 'Deep link Telegram invalide' };
      }

      return { success: false, error: "Format d'URL Telegram non reconnu" };
    } catch (e) {
      return { success: false, error: `Erreur d'analyse: ${e.message}` };
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
            console.error('Sign out error:', error);
            showToast('Erreur de déconnexion', 'error');
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
    console.log('=== TEST EXTRACTION LIENS TELEGRAM ===');
    tests.forEach((link) => {
      const res = extractTelegramIdentifier(link);
      console.log('\nLien:', JSON.stringify(link), '\nRésultat:', res);
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
  // HANDLERS GLOBAUX
  // -----------------------------------------------------------------------
  window.addEventListener('unhandledrejection', (e) => {
    console.error('Unhandled promise rejection:', e?.reason);
    showToast("Une erreur inattendue s'est produite", 'error');
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
    console.log('📄 DOM loaded, initializing channel manager...');

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
      console.log('✅ Page ID:', currentPageId);
    } else {
      // Try to get from last created pages
      const all = JSON.parse(localStorage.getItem('makerhub_all_pages') || '[]');
      if (all.length > 0) {
        currentPageId = all[all.length - 1].channelSlug || all[all.length - 1].id;
        sessionStorage.setItem('currentLandingPageId', currentPageId);
        localStorage.setItem('currentLandingPageId', currentPageId);
        localStorage.setItem('makerhub_current_page', currentPageId);
        console.log('✅ Using last created page:', currentPageId);
      }
    }

    if (!currentPageId) {
      showToast('Aucune page sélectionnée', 'error');
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