// payments.js - MAKERHUB.PRO (PRODUCTION VERSION - FIXED)
'use strict';

// Constants
const STORAGE_PREFIX = 'makerhub_';
const API_BASE_URL = window.location.hostname === 'localhost' || window.location.hostname.includes('127.0.0.1')
  ? 'http://localhost:3000/api' 
  : 'https://api.makerhub.pro/api';

// Rate limiting
const RATE_LIMIT_MS = 1000;
let lastApiCall = 0;

// Toast Manager
const toastManager = {
  container: null,
  
  init() {
    this.container = document.getElementById('toastContainer');
  },
  
  show(message, type = 'info', duration = 5000) {
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    
    const icon = {
      success: 'fa-check-circle',
      warning: 'fa-exclamation-circle',
      error: 'fa-times-circle',
      info: 'fa-info-circle'
    }[type];
    
    toast.innerHTML = `
      <i class="fas ${icon}"></i>
      <span>${this.escapeHtml(message)}</span>
    `;
    
    this.container.appendChild(toast);
    
    // Auto remove
    setTimeout(() => {
      toast.classList.add('slideOut');
      setTimeout(() => toast.remove(), 300);
    }, duration);
  },
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Auth Manager
const authManager = {
  currentUser: null,
  
  async getCurrentUser() {
    return new Promise((resolve) => {
      const auth = window.firebaseAuth;
      if (!auth) {
        console.error('Firebase Auth not initialized');
        resolve(null);
        return;
      }
      
      const unsubscribe = auth.onAuthStateChanged((user) => {
        unsubscribe();
        this.currentUser = user;
        resolve(user);
      });
    });
  },
  
  async getIdToken() {
    const user = await this.getCurrentUser();
    if (!user) throw new Error('User not authenticated');
    return user.getIdToken();
  },
  
  async logout() {
    try {
      await window.firebaseAuth.signOut();
      window.location.href = '/auth.html';
    } catch (error) {
      toastManager.show('Error logging out', 'error');
    }
  }
};

// API Manager
const apiManager = {
  async makeRequest(endpoint, options = {}) {
    // Rate limiting
    const now = Date.now();
    if (now - lastApiCall < RATE_LIMIT_MS) {
      toastManager.show('Please wait before trying again', 'warning');
      throw new Error('Rate limited');
    }
    lastApiCall = now;
    
    try {
      const token = await authManager.getIdToken();
      const csrfToken = document.querySelector('meta[name="csrf-token"]')?.content;
      
      const response = await fetch(`${API_BASE_URL}${endpoint}`, {
        ...options,
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
          'X-CSRF-Token': csrfToken || '',
          ...options.headers
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      if (error.message !== 'Rate limited') {
        console.error('API request error:', error);
        throw error;
      }
    }
  },
  
  async checkStripeStatus() {
    // Pas besoin du creator_id, le serveur le récupère du token
    return this.makeRequest('/stripe-status');
  },
  
  async createStripeConnectLink(data) {
    return this.makeRequest('/create-stripe-connect-link', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }
};

// Stripe Manager
const stripeManager = {
  statusElement: null,
  
  init() {
    this.statusElement = document.getElementById('stripe-status');
  },
  
  async checkStatus() {
    try {
      const user = authManager.currentUser;
      if (!user) {
        this.showNotAuthenticated();
        return;
      }
      
      const data = await apiManager.checkStripeStatus();
      
      if (data.status === 'connected' || (data.payments_enabled && data.payouts_enabled)) {
        this.showConnected(data);
      } else {
        this.showPending(data, user.uid);
      }
      
    } catch (error) {
      this.showError(error);
    }
  },
  
  showNotAuthenticated() {
    this.statusElement.innerHTML = `
      <div style="color: #666666;">
        <i class="fas fa-exclamation-triangle"></i>
        Please login to view your payment status
      </div>
    `;
  },
  
  showConnected(data) {
    this.statusElement.innerHTML = `
      <div style="text-align: center;">
        <span class="status-badge success" style="font-size: 16px; padding: 12px 24px;">
          <i class="fas fa-check-circle"></i>
          Stripe Account Connected
        </span>
        
        <p style="margin: 24px auto; color: #666666; max-width: 500px;">
          Your account is fully set up and ready to accept payments. You can manage your Stripe settings at any time.
        </p>
        
        <div style="display: flex; gap: 12px; justify-content: center; max-width: 400px; margin: 0 auto;">
          <button class="btn btn-primary" disabled>
            <i class="fas fa-check"></i>
            Connected
          </button>
          ${data.account_id ? `
          <a href="https://dashboard.stripe.com/connect/accounts/${data.account_id}" 
             target="_blank" 
             rel="noopener noreferrer" 
             class="btn btn-secondary">
            <i class="fas fa-external-link-alt"></i>
            Manage in Stripe
          </a>
          ` : ''}
        </div>
        
        <div style="margin-top: 32px; padding: 24px; background: rgba(34, 197, 94, 0.05); border-radius: 12px; max-width: 400px; margin-left: auto; margin-right: auto;">
          <h4 style="margin-bottom: 16px; color: #1a1a1a; font-size: 16px; font-weight: 600;">Account Status</h4>
          <div style="text-align: left;">
            <p style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-check-circle" style="color: #22c55e; font-size: 18px;"></i>
              <span style="color: #1a1a1a;">Documents verified</span>
            </p>
            <p style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-check-circle" style="color: #22c55e; font-size: 18px;"></i>
              <span style="color: #1a1a1a;">Payments enabled</span>
            </p>
            <p style="margin: 8px 0; display: flex; align-items: center; gap: 8px;">
              <i class="fas fa-check-circle" style="color: #22c55e; font-size: 18px;"></i>
              <span style="color: #1a1a1a;">Payouts enabled</span>
            </p>
          </div>
        </div>
      </div>
    `;
  },
  
  showPending(data, creatorId) {
    const statusItems = [];
    if (!data.documents_verified) statusItems.push('Complete identity verification');
    if (!data.payments_enabled) statusItems.push('Enable payment processing');
    if (!data.payouts_enabled) statusItems.push('Set up bank account');
    
    this.statusElement.innerHTML = `
      <div>
        <span class="status-badge warning" style="font-size: 16px; padding: 12px 24px;">
          <i class="fas fa-exclamation-circle"></i>
          Setup Required
        </span>
        
        <p style="margin: 24px auto; color: #666666; max-width: 500px;">
          Connect your Stripe account to start accepting payments and receive payouts directly to your bank.
        </p>
        
        ${statusItems.length > 0 ? `
        <div style="margin: 20px auto; max-width: 400px; text-align: left;">
          <p style="font-size: 14px; color: #666666; margin-bottom: 10px;">Action required:</p>
          ${statusItems.map(item => `<p style="font-size: 14px; color: #999999; margin: 5px 0;"><i class="fas fa-circle" style="font-size: 6px; margin-right: 8px;"></i>${this.escapeHtml(item)}</p>`).join('')}
        </div>
        ` : ''}
        
        <button class="btn btn-primary" id="connectStripeBtn" style="max-width: 300px; margin: 0 auto;">
          <i class="fas fa-link"></i>
          Connect with Stripe
        </button>
        
        <p style="margin-top: 16px; font-size: 14px; color: #999999;">
          Need help? <a href="https://t.me/MakerHubSupport" style="color: #e6c100; text-decoration: none;">Contact support</a>
        </p>
      </div>
    `;
    
    // Ajouter l'event listener après avoir créé le bouton
    setTimeout(() => {
      const btn = document.getElementById('connectStripeBtn');
      if (btn) {
        btn.addEventListener('click', () => this.connect());
      }
    }, 100);
  },
  
  showError(error) {
    console.error('Stripe status error:', error);
    
    this.statusElement.innerHTML = `
      <div>
        <span class="status-badge danger" style="font-size: 16px; padding: 12px 24px;">
          <i class="fas fa-exclamation-triangle"></i>
          Connection Error
        </span>
        
        <p style="margin: 24px auto; color: #666666; max-width: 500px;">
          Unable to check your Stripe status. Please try again later.
        </p>
        
        <button class="btn btn-secondary" id="retryBtn">
          <i class="fas fa-redo"></i>
          Retry
        </button>
        
        <p style="margin-top: 16px; font-size: 14px; color: #999999;">
          If the problem persists, <a href="https://t.me/MakerHubSupport" style="color: #e6c100; text-decoration: none;">contact support</a>
        </p>
      </div>
    `;
    
    // Ajouter l'event listener pour le bouton retry
    setTimeout(() => {
      const btn = document.getElementById('retryBtn');
      if (btn) {
        btn.addEventListener('click', () => this.checkStatus());
      }
    }, 100);
  },
  
  async connect() {
    const btn = event.target;
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Connecting...';
    btn.disabled = true;
    
    try {
      const data = await apiManager.createStripeConnectLink({
        return_url: `${window.location.origin}/payments.html?stripe_connected=true`,
        refresh_url: `${window.location.origin}/payments.html?stripe_refresh=true`
      });
      
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error('No redirect URL provided');
      }
      
    } catch (error) {
      console.error('Error connecting Stripe:', error);
      toastManager.show('Failed to connect to Stripe. Please try again or contact support.', 'error');
      btn.innerHTML = originalText;
      btn.disabled = false;
    }
  },
  
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }
};

// Profile Manager
const profileManager = {
  init() {
    this.loadProfile();
  },
  
  loadProfile() {
    const user = authManager.currentUser;
    if (!user) return;
    
    // Try to get from Firebase user first, then localStorage
    const email = user.email || localStorage.getItem(STORAGE_PREFIX + 'user_email') || '';
    const name = user.displayName || localStorage.getItem(STORAGE_PREFIX + 'user_name') || 'MakerHub Creator';
    
    const emailInput = document.getElementById('creator-email');
    const nameInput = document.getElementById('creator-name');
    
    if (emailInput) emailInput.value = email;
    if (nameInput) nameInput.value = name;
  }
};

// Mobile Menu Manager
const mobileMenuManager = {
  init() {
    const menuToggle = document.getElementById('menuToggle');
    const sidebar = document.getElementById('sidebar');
    
    if (!menuToggle || !sidebar) return;
    
    menuToggle.addEventListener('click', () => {
      sidebar.classList.toggle('active');
    });
    
    // Close sidebar when clicking outside
    document.addEventListener('click', (e) => {
      if (!sidebar.contains(e.target) && !menuToggle.contains(e.target)) {
        sidebar.classList.remove('active');
      }
    });
  }
};

// URL Parameter Manager
const urlManager = {
  checkRedirectParams() {
    const urlParams = new URLSearchParams(window.location.search);
    
    if (urlParams.get('stripe_connected') === 'true') {
      toastManager.show('Stripe account successfully connected!', 'success');
      this.cleanUrl();
      return true;
    } else if (urlParams.get('stripe_refresh') === 'true') {
      toastManager.show('Please complete your Stripe setup', 'warning');
      this.cleanUrl();
      return true;
    }
    
    return false;
  },
  
  cleanUrl() {
    window.history.replaceState({}, document.title, window.location.pathname);
  }
};

// Page Manager
const pageManager = {
  async init() {
    // Initialize toast manager
    toastManager.init();
    
    // Check authentication
    const user = await authManager.getCurrentUser();
    
    if (!user) {
      // Redirect to auth if not authenticated
      window.location.href = '/auth.html';
      return;
    }
    
    // Initialize components
    stripeManager.init();
    profileManager.init();
    mobileMenuManager.init();
    
    // Check URL parameters
    const hasRedirect = urlManager.checkRedirectParams();
    
    // Check Stripe status
    await stripeManager.checkStatus();
    
    // Setup event listeners
    this.setupEventListeners();
  },
  
  setupEventListeners() {
    // Logout button
    const logoutBtn = document.getElementById('logout');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => authManager.logout());
    }
  }
};

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', () => {
  pageManager.init().catch(error => {
    console.error('Page initialization error:', error);
    toastManager.show('Failed to initialize page', 'error');
  });
});