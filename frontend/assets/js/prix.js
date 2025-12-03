// prix.js - MAKERHUB.PRO Pricing Management JavaScript (VERSION FINALE CORRIGÉE)
'use strict';

// Variables Firebase
let auth = null;
let db = null;

// Configuration globale - UTILISE LA CONFIG CENTRALISÉE
const PricingConfig = {
  AUTOSAVE_INTERVAL: 10000, // 10 secondes
  AUTOSAVE_DELAY: 5000, // 5 secondes après le dernier changement
  STORAGE_VERSION: '1.0',
  STORAGE_PREFIX: 'makerhub_',
  MAX_PLANS: 3 // Limite maximale de plans
};

// Map périodes builder -> backend
const PERIOD_MAP = {
  monthly: 'mois',
  yearly: 'an',
  quarterly: '3mois',
  '3months': '3mois',
  weekly: 'semaine',
  daily: 'jour'
};

// Utility functions
const PricingUtils = {
  // Génère un ID unique
  generateId() {
    return `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  },
  
  // Sauvegarde avec expiration
  saveToStorage(key, data) {
    const dataWithMeta = {
      version: PricingConfig.STORAGE_VERSION,
      data: data,
      savedAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString() // 30 jours
    };
    localStorage.setItem(PricingConfig.STORAGE_PREFIX + key, JSON.stringify(dataWithMeta));
  },
  
  // Récupère avec vérification d'expiration
  getFromStorage(key) {
    try {
      const stored = localStorage.getItem(PricingConfig.STORAGE_PREFIX + key);
      if (!stored) return null;
      
      const parsed = JSON.parse(stored);
      
      // Vérifier la version
      if (parsed.version !== PricingConfig.STORAGE_VERSION) {
        console.warn('Storage version mismatch, clearing old data');
        localStorage.removeItem(PricingConfig.STORAGE_PREFIX + key);
        return null;
      }
      
      // Vérifier l'expiration
      if (new Date(parsed.expiresAt) < new Date()) {
        console.warn('Storage data expired, clearing');
        localStorage.removeItem(PricingConfig.STORAGE_PREFIX + key);
        return null;
      }
      
      return parsed.data;
    } catch (error) {
      console.error('Error reading from storage:', error);
      return null;
    }
  },
  
  // Format currency using centralized config
  formatCurrency(amount, currencyCode = 'EUR') {
    try {
      return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: currencyCode,
        minimumFractionDigits: 0,
        maximumFractionDigits: 2
      }).format(amount);
    } catch (e) {
      return `${currencyCode} ${amount}`;
    }
  }
};

// Pricing Management Module
class PricingManager {
  constructor() {
    this.plansCount = 0;
    this.currentPageId = null;
    this.autoSaveTimeout = null;
    this.hasUnsavedChanges = false;
    this.plans = new Map();
    this.removeHandlers = new Map(); // Pour gérer les handlers de suppression
    this.redirectSource = null; // NOUVEAU - pour tracker d'où on vient
  }

  // Initialize
  async init() {
    // Attendre Firebase si nécessaire
    if (window.firebaseServices) {
      auth = window.firebaseServices.auth;
      db = window.firebaseServices.db;
    }
    
    // Vérifier que la config est chargée
    if (!window.MAKERHUB_CONFIG) {
      console.error('MAKERHUB_CONFIG not found. Make sure constants.js is loaded first.');
      alert('Configuration error. Please refresh the page.');
      return;
    }
    
    this.currentPageId = this.getPageId();
    if (!this.currentPageId) {
      console.error('No page ID found');
      alert('Error: No page ID specified');
      return;
    }
    
    // NOUVEAU - Vérifier la source de redirection
    const urlParams = new URLSearchParams(window.location.search);
    this.redirectSource = urlParams.get('redirect');
    console.log('Redirect source:', this.redirectSource);
    
    this.setupEventListeners();
    await this.loadPricingData(this.currentPageId);
    this.startAutoSave();
    this.updateAddButtonState(); // Vérifier l'état du bouton au démarrage
    
    console.log('MAKERHUB Pricing Manager v3.2 initialized with centralized config');
  }

  // Get page ID with multiple fallbacks
  getPageId() {
    const p = new URLSearchParams(window.location.search);
    return (
      p.get('page') ||
      p.get('pageId') ||
      sessionStorage.getItem('currentLandingPageId') ||
      localStorage.getItem('currentLandingPageId')
    );
  }

  // Populate currency select avec fallback robuste
  populateCurrencySelect(select, selectedSymbol = null) {
    if (!select || !window.MAKERHUB_CONFIG) return;
    const C = window.MAKERHUB_CONFIG;

    // Construire une liste sûre de devises
    let list = [];
    if (Array.isArray(C.CURRENCIES) && C.CURRENCIES.length) {
      list = C.CURRENCIES; // format moderne [{code,symbol,name}]
    } else if (Array.isArray(C.SUPPORTED_CURRENCIES)) {
      // fallback depuis anciennes constantes (codes uniquement)
      list = C.SUPPORTED_CURRENCIES.map(code => ({
        code,
        symbol: (C.CODE_TO_SYMBOL && C.CODE_TO_SYMBOL[code]) || code,
        name: code
      }));
    } else {
      // Fallback ultime si aucune config
      console.warn('No currency configuration found, using defaults');
      list = [
        { code: 'EUR', symbol: '€', name: 'Euro' },
        { code: 'USD', symbol: '$', name: 'US Dollar' },
        { code: 'GBP', symbol: '£', name: 'British Pound' }
      ];
    }

    // Vider et remplir
    select.innerHTML = '';
    list.forEach(cur => {
      const option = document.createElement('option');
      option.value = cur.symbol;
      option.textContent = `${cur.symbol} (${cur.code})`;
      select.appendChild(option);
    });

    // Sélection par défaut
    if (selectedSymbol && C.SYMBOL_TO_CODE && C.SYMBOL_TO_CODE[selectedSymbol]) {
      select.value = selectedSymbol;
    } else {
      select.value = (C.CODE_TO_SYMBOL && C.CODE_TO_SYMBOL.EUR) || '€';
    }
  }

  // Setup event listeners
  setupEventListeners() {
    // Mobile menu toggle
    document.getElementById('menuToggle')?.addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('active');
    });

    // Warn before leaving with unsaved changes
    window.addEventListener('beforeunload', (e) => {
      if (this.hasUnsavedChanges) {
        e.preventDefault();
        e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
      }
    });

    // Track changes
    document.addEventListener('input', () => {
      this.hasUnsavedChanges = true;
      this.scheduleAutoSave();
    });
    
    document.addEventListener('change', () => {
      this.hasUnsavedChanges = true;
      this.scheduleAutoSave();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if (confirm('Are you sure you want to close? Any unsaved changes will be lost.')) {
          this.tryCloseWindow();
        }
      }
      
      if (e.ctrlKey || e.metaKey) {
        switch(e.key) {
          case 's':
            e.preventDefault();
            this.savePricing();
            break;
          case 'n':
            e.preventDefault();
            if (this.plansCount < PricingConfig.MAX_PLANS) {
              this.addPricingPlan();
            }
            break;
          case 'd':
            e.preventDefault();
            this.debugExport();
            break;
        }
      }
    });

    // Setup MutationObserver for dynamic currency selects
    const pricingPlansContainer = document.getElementById('pricingPlans');
    if (pricingPlansContainer) {
      const observer = new MutationObserver(() => {
        // Populate any new currency selects
        document.querySelectorAll('select[data-field="currency"]:not([data-initialized])').forEach(select => {
          this.populateCurrencySelect(select);
          select.setAttribute('data-initialized', 'true');
        });
      });
      
      observer.observe(pricingPlansContainer, {
        childList: true,
        subtree: true
      });
    }

    // PAS DE POPUP DE RESTAURATION - SUPPRIMÉ
    // this.checkAutoSavedData(); // SUPPRIMÉ
  }

  // MODIFIÉ - Try to close window safely avec redirection intelligente
  tryCloseWindow() {
    const urlParams = new URLSearchParams(window.location.search);
    const pageId = urlParams.get('page');
    
    // NOUVEAU - Si on vient de createLanding, on y retourne
    if (this.redirectSource === 'createLanding') {
      const redirectUrl = `/createLanding.html?page=${pageId}&fromPrices=true`;
      console.log('Redirecting back to createLanding:', redirectUrl);
      window.location.href = redirectUrl;
      return;
    }
    
    // Sinon comportement par défaut vers telegramsubscription
    const defaultRedirectUrl = pageId ? `/telegramsubscription.html?page=${pageId}` : '/telegramsubscription.html';
    
    try {
      window.close();
      // Si on arrive ici, c'est que la fenêtre ne s'est pas fermée
      setTimeout(() => {
        window.location.href = defaultRedirectUrl;
      }, 100);
    } catch (e) {
      console.log('Cannot close window - redirecting to telegramsubscription');
      window.location.href = defaultRedirectUrl;
    }
  }

  // SUPPRIMÉ - Plus de popup de restauration
  /*
  checkAutoSavedData() {
    // SUPPRIMÉ
  }

  restoreAutoSavedData(data) {
    // SUPPRIMÉ
  }
  */

  // Update button state based on plans count
  updateAddButtonState() {
    const addBtn = document.getElementById('addPlanBtn');
    if (addBtn) {
      if (this.plansCount >= PricingConfig.MAX_PLANS) {
        addBtn.disabled = true;
        addBtn.innerHTML = '<i class="fas fa-ban"></i> Maximum 3 Plans';
        addBtn.style.opacity = '0.5';
        addBtn.style.cursor = 'not-allowed';
      } else {
        addBtn.disabled = false;
        addBtn.innerHTML = '<i class="fas fa-plus"></i> Add Plan';
        addBtn.style.opacity = '1';
        addBtn.style.cursor = 'pointer';
      }
    }
  }

  // Add Pricing Plan avec event handlers appropriés
  addPricingPlan(existingData = null) {
    // Vérifier la limite
    if (this.plansCount >= PricingConfig.MAX_PLANS) {
      alert(`Maximum ${PricingConfig.MAX_PLANS} pricing plans allowed.`);
      return;
    }

    const container = document.getElementById('pricingPlans');
    if (!container) {
      console.error('#pricingPlans container not found.');
      return;
    }

    this.plansCount++;
    const planId = existingData?.id || PricingUtils.generateId();
    
    // Déterminer le symbole de devise à utiliser
    let currencySymbol = '€'; // défaut
    if (existingData) {
      if (existingData.currency && window.MAKERHUB_CONFIG?.SYMBOL_TO_CODE?.[existingData.currency]) {
        currencySymbol = existingData.currency;
      } else if (existingData.currencyCode && window.MAKERHUB_CONFIG?.CODE_TO_SYMBOL?.[existingData.currencyCode]) {
        currencySymbol = window.MAKERHUB_CONFIG.CODE_TO_SYMBOL[existingData.currencyCode];
      }
    }
    
    const planHTML = `
      <div class="pricing-plan review-item" id="${planId}" data-plan-id="${planId}">
        <div class="review-header plan-header">
          <h4 class="review-title plan-title"><span class="review-number">#${this.plansCount}</span> Plan ${this.plansCount}</h4>
          <button class="remove-review-btn remove-plan-btn" data-plan-id="${planId}">
            <i class="fas fa-times"></i>
          </button>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">Price <span class="required">*</span></label>
            <input type="number" class="form-input" placeholder="99" 
                   value="${existingData?.price || ''}"
                   data-field="price" required min="0" step="0.01">
          </div>
          
          <div class="form-group">
            <label class="form-label">Currency</label>
            <select class="form-select" data-field="currency">
              <!-- Options will be populated dynamically -->
            </select>
          </div>
          
          <div class="form-group">
            <label class="form-label">Billing Period</label>
            <select class="form-select" data-field="billingPeriod">
              <option value="monthly" ${existingData?.billingPeriod === 'monthly' ? 'selected' : ''}>Monthly</option>
              <option value="quarterly" ${(existingData?.billingPeriod === 'quarterly' || existingData?.billingPeriod === '3months') ? 'selected' : ''}>Quarterly (3 months)</option>
              <option value="yearly" ${existingData?.billingPeriod === 'yearly' ? 'selected' : ''}>Yearly</option>
              <option value="weekly" ${existingData?.billingPeriod === 'weekly' ? 'selected' : ''}>Weekly</option>
              <option value="daily" ${existingData?.billingPeriod === 'daily' ? 'selected' : ''}>Daily</option>
            </select>
          </div>
        </div>
        
        <div class="form-row">
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" data-field="isPopular" 
                     ${existingData?.isPopular ? 'checked' : ''}>
              Mark as Popular/Best Offer
            </label>
          </div>
          
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" data-field="hasFreeTrial" 
                     ${existingData?.hasFreeTrial ? 'checked' : ''}>
              Offer Free Trial
            </label>
          </div>
          
          <div class="form-group">
            <label class="form-label">
              <input type="checkbox" data-field="hasLimitedSpots" 
                     ${existingData?.hasLimitedSpots ? 'checked' : ''}>
              Limited Spots Available
            </label>
          </div>
        </div>
        
        <div class="form-group trial-days" style="${existingData?.hasFreeTrial ? '' : 'display:none'}">
          <label class="form-label">Free Trial Days</label>
          <input type="number" class="form-input" placeholder="14" 
                 value="${existingData?.freeTrialDays || '14'}"
                 data-field="freeTrialDays" min="1" max="90">
          <span class="help-text">Number of days for the free trial period</span>
        </div>
        
        <div class="form-group limited-spots" style="${existingData?.hasLimitedSpots ? '' : 'display:none'}">
          <label class="form-label">Number of Spots Available</label>
          <input type="number" class="form-input" placeholder="100" 
                 value="${existingData?.limitedSpots || '100'}"
                 data-field="limitedSpots" min="1" max="99999">
          <span class="help-text">Creates urgency by showing limited availability</span>
        </div>
        
        <div class="form-group">
          <label class="form-label">Discount Percentage</label>
          <div class="form-row">
            <input type="number" class="form-input" placeholder="20" 
                   value="${existingData?.discountPercent || ''}"
                   data-field="discountPercent" min="0" max="100">
            <span class="form-suffix">% off original price</span>
          </div>
          <span class="help-text">Leave empty for no discount</span>
        </div>
        
        <div class="price-preview" data-for="${planId}"></div>
      </div>
    `;
    
    container.insertAdjacentHTML('beforeend', planHTML);
    
    // Add to plans map
    this.plans.set(planId, {
      id: planId,
      order: this.plansCount
    });
    
    // Setup currency select
    const planElement = document.getElementById(planId);
    const currencySelect = planElement.querySelector('select[data-field="currency"]');
    this.populateCurrencySelect(currencySelect, currencySymbol);
    currencySelect.setAttribute('data-initialized', 'true');
    
    // Setup remove button handler
    const removeBtn = planElement.querySelector('.remove-plan-btn');
    const removeHandler = () => this.removePlan(planId);
    removeBtn.addEventListener('click', removeHandler);
    this.removeHandlers.set(planId, removeHandler);
    
    // Setup toggles
    // Free trial toggle
    const freeTrialCheckbox = planElement.querySelector('[data-field="hasFreeTrial"]');
    const trialDaysGroup = planElement.querySelector('.trial-days');
    
    freeTrialCheckbox.addEventListener('change', (e) => {
      trialDaysGroup.style.display = e.target.checked ? '' : 'none';
    });
    
    // Limited spots toggle
    const limitedSpotsCheckbox = planElement.querySelector('[data-field="hasLimitedSpots"]');
    const limitedSpotsGroup = planElement.querySelector('.limited-spots');
    
    limitedSpotsCheckbox.addEventListener('change', (e) => {
      limitedSpotsGroup.style.display = e.target.checked ? '' : 'none';
    });
    
    // Setup price preview
    this.setupPricePreview(planId);
    
    // Update add button state
    this.updateAddButtonState();
  }

  // Setup price preview with visual feedback
  setupPricePreview(planId) {
    const el = document.getElementById(planId);
    if (!el) return;
    
    const priceInput = el.querySelector('[data-field="price"]');
    const currencySelect = el.querySelector('[data-field="currency"]');
    const discountInput = el.querySelector('[data-field="discountPercent"]');
    const preview = document.querySelector(`.price-preview[data-for="${planId}"]`);

    const updatePreview = () => {
      const price = parseFloat(priceInput.value) || 0;
      const symbol = currencySelect.value;
      const code = window.MAKERHUB_CONFIG?.SYMBOL_TO_CODE?.[symbol] || 'EUR';
      const pct = Math.min(Math.max(parseFloat(discountInput.value) || 0, 0), 100);
      const finalPrice = pct > 0 ? price * (1 - pct / 100) : price;

      if (preview) {
        preview.textContent = pct > 0
          ? `${PricingUtils.formatCurrency(finalPrice, code)} (was ${PricingUtils.formatCurrency(price, code)}, -${Math.round(pct)}%)`
          : PricingUtils.formatCurrency(price, code);
      }
    };

    ['input', 'change'].forEach(evt => {
      priceInput.addEventListener(evt, updatePreview);
      currencySelect.addEventListener(evt, updatePreview);
      discountInput.addEventListener(evt, updatePreview);
    });

    updatePreview();
  }

  // Remove Plan
  removePlan(planId) {
    if (confirm('Are you sure you want to delete this pricing plan?')) {
      const planElement = document.getElementById(planId);
      if (planElement) {
        planElement.style.opacity = '0';
        planElement.style.transform = 'translateX(-20px)';
        setTimeout(() => {
          planElement.remove();
          this.plans.delete(planId);
          this.removeHandlers.delete(planId);
          this.updatePlanNumbers();
          this.hasUnsavedChanges = true;
          this.updateAddButtonState(); // Update button state after removal
        }, 300);
      }
    }
  }

  // Update plan numbers
  updatePlanNumbers() {
    const plans = document.querySelectorAll('.pricing-plan');
    plans.forEach((plan, index) => {
      const titleElement = plan.querySelector('.plan-title');
      if (titleElement) {
        titleElement.innerHTML = `<span class="review-number">#${index + 1}</span> Plan ${index + 1}`;
      }
    });
    this.plansCount = plans.length;
  }

  // Load Pricing Data (avec support Firestore optionnel)
  async loadPricingData(pageId) {
    // D'abord essayer de charger depuis Firestore si disponible
    if (db && auth && auth.currentUser) {
      try {
        const doc = await db.collection('landingPages').doc(pageId).get();
        if (doc.exists && doc.data().prices && doc.data().prices.length > 0) {
          console.log('Loading prices from Firestore');
          const prices = doc.data().prices;
          // Limiter au nombre maximum de plans
          const plansToLoad = prices.slice(0, PricingConfig.MAX_PLANS);
          plansToLoad.forEach(plan => {
            this.addPricingPlan(plan);
          });
          return;
        }
      } catch (error) {
        console.warn('Could not load from Firestore:', error);
      }
    }
    
    // Sinon charger depuis localStorage
    const existingData = PricingUtils.getFromStorage(`prices_${pageId}`);
    
    if (existingData && existingData.prices && existingData.prices.length > 0) {
      // Limiter au nombre maximum de plans
      const plansToLoad = existingData.prices.slice(0, PricingConfig.MAX_PLANS);
      plansToLoad.forEach(plan => {
        this.addPricingPlan(plan);
      });
    } else {
      // Add default plan
      this.addPricingPlan({
        price: 0,
        currency: '€',
        currencyCode: 'EUR',
        billingPeriod: 'monthly',
        isPopular: false,
        hasFreeTrial: false,
        hasLimitedSpots: false
      });
    }
    
    this.hasUnsavedChanges = false;
  }

  // Gather pricing data with proper currency mapping and sanitization
  gatherPricingData() {
    const plans = [];
    const SYMBOL_TO_CODE = window.MAKERHUB_CONFIG?.SYMBOL_TO_CODE || {};
    
    document.querySelectorAll('.pricing-plan').forEach((planElement, index) => {
      const plan = {
        id: planElement.getAttribute('data-plan-id'),
        order: index + 1
      };
      
      // Get all fields
      const price = parseFloat(planElement.querySelector('[data-field="price"]')?.value) || 0;
      const currencySymbol = planElement.querySelector('[data-field="currency"]')?.value || '€';
      const currencyCode = SYMBOL_TO_CODE[currencySymbol] || 'EUR';
      const billingPeriod = planElement.querySelector('[data-field="billingPeriod"]')?.value || 'monthly';
      const isPopular = planElement.querySelector('[data-field="isPopular"]')?.checked || false;
      const hasFreeTrial = planElement.querySelector('[data-field="hasFreeTrial"]')?.checked || false;
      const freeTrialDaysRaw = parseInt(planElement.querySelector('[data-field="freeTrialDays"]')?.value) || 14;
      const hasLimitedSpots = planElement.querySelector('[data-field="hasLimitedSpots"]')?.checked || false;
      const limitedSpotsRaw = parseInt(planElement.querySelector('[data-field="limitedSpots"]')?.value) || 100;
      const discountPercentRaw = parseFloat(planElement.querySelector('[data-field="discountPercent"]')?.value) || 0;
      
      // Sanitize numeric fields
      const pct = Math.min(Math.max(Number(discountPercentRaw || 0), 0), 100);
      const ft = hasFreeTrial ? Math.min(Math.max(parseInt(freeTrialDaysRaw || 0), 1), 90) : 0;
      const spots = hasLimitedSpots ? Math.min(Math.max(parseInt(limitedSpotsRaw || 0), 1), 999999) : 0;
      
      // Only include if has required data
      if (price >= 0) {
        plan.price = price;
        plan.currency = currencySymbol;  // Stocke le symbole
        plan.currencyCode = currencyCode;  // Stocke le code ISO
        plan.billingPeriod = billingPeriod;
        plan.isPopular = isPopular;
        plan.hasFreeTrial = hasFreeTrial;
        plan.freeTrialDays = ft;
        plan.hasLimitedSpots = hasLimitedSpots;
        plan.limitedSpots = spots;
        plan.discountPercent = pct;
        
        // Calculate final price
        plan.finalPrice = pct > 0 ? price * (1 - pct / 100) : price;
        
        // Mapper la période pour le format backend
        plan.period = PERIOD_MAP[billingPeriod] || 'mois';
        
        plans.push(plan);
      }
    });
    
    return {
      plans,
      prices: plans, // NOUVEAU - ajouter aussi sous la clé "prices" pour compatibilité
      plansCount: plans.length,
      currency: plans[0]?.currencyCode || 'EUR',
      showPrices: true,
      updatedAt: new Date().toISOString()
    };
  }

  // Export for landing page backend format (robuste)
  exportForLanding() {
    const { plans } = this.gatherPricingData();
    const C = window.MAKERHUB_CONFIG || {};
    const SYM2CODE = C.SYMBOL_TO_CODE || {};
    const CODE2SYM = C.CODE_TO_SYMBOL || {};
    const ALLOWED_CODES = new Set(
      (C.CURRENCIES || []).map(c => c.code)
    );

    return plans.map((p, idx) => {
      // 1) Devise : priorise le code ISO
      let code = p.currencyCode || SYM2CODE[p.currency] || 'EUR';
      if (!ALLOWED_CODES.size || !ALLOWED_CODES.has(code)) code = 'EUR';
      const symbol = CODE2SYM[code] || p.currency || '€';

      // 2) Période : map vers format backend
      let period = PERIOD_MAP[p.billingPeriod] || 'mois';

      // 3) Prix & affichages
      const base = Number(p.price || 0);
      const pct = Math.min(Math.max(Number(p.discountPercent || 0), 0), 100);
      const finalPrice = pct > 0 ? base * (1 - pct / 100) : base;

      const labelPeriod = period === '3mois' ? '3 mois' : (period === 'an' ? 'an' : period === 'semaine' ? 'semaine' : period === 'jour' ? 'jour' : 'mois');
      const label = `${Math.round(finalPrice)}${symbol} / ${labelPeriod}`;
      const strike = pct > 0 ? `${Math.round(base)}${symbol}` : '';
      const discount = pct > 0 ? `-${Math.round(pct)}%` : '';

      return {
        id: p.id || `plan-${idx + 1}`,
        label,
        price: finalPrice.toString(),
        period,
        currency: symbol,
        currencyCode: code,
        best: !!p.isPopular,
        isPopular: !!p.isPopular,
        strike,
        discount,
        limitedSeats: !!p.hasLimitedSpots,
        limitedSpots: p.hasLimitedSpots ? (p.limitedSpots || 100) : 0, // MODIFICATION ICI
        freeTrialDays: p.hasFreeTrial ? (Number(p.freeTrialDays) || 0) : 0,
        buttonText: "S'abonner"
      };
    });
  }

  // Debug export (Ctrl+D)
  debugExport() {
    const landing = this.exportForLanding();
    console.log('=== Debug Export ===');
    console.log('Builder format:', this.gatherPricingData());
    console.log('Landing format:', JSON.stringify(landing, null, 2));
    console.log('===================');
    this.showSuccessMessage('Export debug logged to console (Ctrl+Shift+I)');
  }

  // Save to Firestore (optionnel)
  async saveToFirestore(pageId, pricingData) {
    if (!db || !auth || !auth.currentUser) {
      console.warn('Firestore not available, saving to localStorage only');
      return false;
    }
    
    try {
      // Convertir au format pour le backend
      const prices = this.exportForLanding();
      
      await db.collection('landingPages').doc(pageId).update({
        prices: prices,
        showPrices: true,
        pricesUpdatedAt: new Date()
      });
      
      console.log('✅ Prices saved to Firestore');
      return true;
    } catch (error) {
      console.error('Error saving to Firestore:', error);
      return false;
    }
  }

  // MODIFIÉ - Save Pricing avec redirection intelligente
  async savePricing() {
    try {
      const pricingData = this.gatherPricingData();
      
      // Validate at least one plan
      if (pricingData.plans.length === 0) {
        alert('Please add at least one pricing plan.');
        return;
      }
      
      // NOUVEAU - Sauvegarder dans le format attendu par createLanding
      const forLanding = this.exportForLanding();
      const dataToSave = {
        prices: forLanding,
        currency: pricingData.currency,
        showPrices: true,
        updatedAt: pricingData.updatedAt
      };
      
      // Save to localStorage avec la bonne clé
      localStorage.setItem(`makerhub_prices_${this.currentPageId}`, JSON.stringify(dataToSave));
      
      // Aussi sauvegarder l'ancien format pour compatibilité
      PricingUtils.saveToStorage(`pricing_${this.currentPageId}`, pricingData);
      PricingUtils.saveToStorage(`prices_${this.currentPageId}`, dataToSave);
      
      // Essayer de sauver dans Firestore aussi
      await this.saveToFirestore(this.currentPageId, pricingData);
      
      // Clear auto-save
      localStorage.removeItem(PricingConfig.STORAGE_PREFIX + `pricing_${this.currentPageId}_autosave`);
      
      this.hasUnsavedChanges = false;
      
      // Show success message
      const message = this.redirectSource === 'createLanding' 
        ? 'Prix configurés ! Retour à la création de page...'
        : 'Pricing configuration saved successfully!';
      
      this.showSuccessMessage(message);
      
      // Log the saved data structure for debugging
      console.log('Saved pricing data:', pricingData);
      console.log('Export format:', forLanding);
      console.log('Data for createLanding:', dataToSave);
      
      // Try to close window after delay
      setTimeout(() => {
        this.tryCloseWindow();
      }, 1500);
      
    } catch (error) {
      console.error('Error saving pricing:', error);
      alert('Error saving pricing configuration. Please try again.');
    }
  }

  // Show success message
  showSuccessMessage(message) {
    const toast = document.createElement('div');
    toast.className = 'success-toast';
    toast.innerHTML = `
      <i class="fas fa-check-circle"></i>
      <span>${message}</span>
    `;
    
    // CSS inline pour le toast
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: #10b981;
      color: white;
      padding: 12px 20px;
      border-radius: 8px;
      display: flex;
      align-items: center;
      gap: 10px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      z-index: 9999;
      opacity: 0;
      transform: translateY(-10px);
      transition: all 0.3s ease;
    `;
    
    document.body.appendChild(toast);
    
    setTimeout(() => {
      toast.style.opacity = '1';
      toast.style.transform = 'translateY(0)';
    }, 10);
    
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(-10px)';
      setTimeout(() => toast.remove(), 300);
    }, 3000);
  }

  // Start auto-save
  startAutoSave() {
    // Save periodically
    setInterval(() => {
      if (this.hasUnsavedChanges) {
        this.performAutoSave();
      }
    }, PricingConfig.AUTOSAVE_INTERVAL);
  }

  // Schedule auto-save
  scheduleAutoSave() {
    clearTimeout(this.autoSaveTimeout);
    this.autoSaveTimeout = setTimeout(() => {
      this.performAutoSave();
    }, PricingConfig.AUTOSAVE_DELAY);
  }

  // Perform auto-save
  performAutoSave() {
    const data = this.gatherPricingData();
    if (data.plans.length > 0) {
      PricingUtils.saveToStorage(`pricing_${this.currentPageId}_autosave`, data);
      console.log('Auto-saved pricing data');
    }
  }
}

// Initialize on DOM load
window.pricingManager = new PricingManager();
document.addEventListener('DOMContentLoaded', () => {
  window.pricingManager.init();
});

// Event handlers pour les boutons de l'interface
document.addEventListener('DOMContentLoaded', function() {
  // Gestionnaire pour le bouton "Add Plan"
  const addPlanBtn = document.getElementById('addPlanBtn');
  if (addPlanBtn) {
    addPlanBtn.addEventListener('click', function() {
      if (window.pricingManager) {
        window.pricingManager.addPricingPlan();
      }
    });
  }

  // Gestionnaire pour le bouton "Save"
  const saveBtn = document.getElementById('saveBtn');
  if (saveBtn) {
    saveBtn.addEventListener('click', function() {
      if (window.pricingManager) {
        window.pricingManager.savePricing();
      }
    });
  }

  // Gestionnaire pour le bouton "Cancel"
  const cancelBtn = document.getElementById('cancelBtn');
  if (cancelBtn) {
    cancelBtn.addEventListener('click', function() {
      if (window.pricingManager && window.pricingManager.hasUnsavedChanges) {
        if (confirm('You have unsaved changes. Are you sure you want to cancel?')) {
          window.pricingManager.tryCloseWindow();
        }
      } else {
        window.pricingManager?.tryCloseWindow();
      }
    });
  }

  // Gestionnaire pour le bouton "Close"
  const closeBtn = document.getElementById('closeBtn');
  if (closeBtn) {
    closeBtn.addEventListener('click', function() {
      if (window.pricingManager && window.pricingManager.hasUnsavedChanges) {
        if (confirm('You have unsaved changes. Are you sure you want to close?')) {
          window.pricingManager.tryCloseWindow();
        }
      } else {
        window.pricingManager?.tryCloseWindow();
      }
    });
  }
});