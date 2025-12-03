// utils/constants.js - Configuration centralisée MAKERHUB
(function() {
  'use strict';
  
  // Mapping des devises
  const CURRENCIES = [
    { code: 'EUR', symbol: '€', name: 'Euro' },
    { code: 'USD', symbol: '$', name: 'US Dollar' },
    { code: 'GBP', symbol: '£', name: 'British Pound' },
    { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
    { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
    { code: 'SAR', symbol: 'ر.س', name: 'Saudi Riyal' },
    { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
    { code: 'MAD', symbol: 'د.م.', name: 'Moroccan Dirham' },
    { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
    { code: 'CAD', symbol: '$', name: 'Canadian Dollar' },
    { code: 'AUD', symbol: '$', name: 'Australian Dollar' },
    { code: 'SEK', symbol: 'kr', name: 'Swedish Krona' },
    { code: 'DKK', symbol: 'kr', name: 'Danish Krone' },
    { code: 'NOK', symbol: 'kr', name: 'Norwegian Krone' },
    { code: 'PLN', symbol: 'zł', name: 'Polish Złoty' },
    { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
    { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
    { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
    { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
    { code: 'NZD', symbol: '$', name: 'New Zealand Dollar' },
    { code: 'SGD', symbol: '$', name: 'Singapore Dollar' },
    { code: 'HKD', symbol: '$', name: 'Hong Kong Dollar' }
  ];
  
  // Création des mappings
  const SYMBOL_TO_CODE = {};
  const CODE_TO_SYMBOL = {};
  const SUPPORTED_CURRENCIES = [];
  
  CURRENCIES.forEach(currency => {
    SYMBOL_TO_CODE[currency.symbol] = currency.code;
    CODE_TO_SYMBOL[currency.code] = currency.symbol;
    SUPPORTED_CURRENCIES.push(currency.code);
  });
  
  // Périodes supportées par le backend
  const BACKEND_PERIODS = ['mois', '3mois', 'an', 'lifetime'];
  
  const PLAN_COMMISSIONS = {
    'free': 15,
    'basic': 10,
    'premium': 5,
    'enterprise': 0
  };

  const DEFAULT_COMMISSION = 10;

  const SUBSCRIBER_SOURCES = {
    EMAIL_CAPTURE: 'Email Capture',
    EMAIL_CAPTURE_PAYMENT: 'Email Capture with Payment',
    LIVE_EVENT: 'Live / Masterclass / Webinar',
    TELEGRAM: 'Telegram Subscriber',
    PURCHASE: 'One-Time Purchase'
  };

  const PAGE_TYPES = {
    EMAIL_CAPTURE: 'email_capture',
    EMAIL_CAPTURE_PAYMENT: 'capture_with_payment',
    SALES_PAGE: 'sales_page',
    LANDING_PAGE: 'landing_page'
  };

  // Configuration pour le navigateur
  if (typeof window !== 'undefined') {
    window.MAKERHUB_CONFIG = {
      APP_NAME: 'MAKERHUB',
      VERSION: '1.0.0',
      NODE_API_URL: window.location.origin,
      API_URL: window.location.hostname === 'localhost' ? 'http://localhost:5001' : 'https://makerhub.pro',
      NODE_ENV: window.location.hostname === 'localhost' ? 'development' : 'production',
      
      // Devises
      CURRENCIES: CURRENCIES,
      SYMBOL_TO_CODE: SYMBOL_TO_CODE,
      CODE_TO_SYMBOL: CODE_TO_SYMBOL,
      SUPPORTED_CURRENCIES: SUPPORTED_CURRENCIES,
      BACKEND_PERIODS: BACKEND_PERIODS,
      
      // Autres configs
      PLAN_COMMISSIONS: PLAN_COMMISSIONS,
      DEFAULT_COMMISSION: DEFAULT_COMMISSION,
      SUBSCRIBER_SOURCES: SUBSCRIBER_SOURCES,
      PAGE_TYPES: PAGE_TYPES,
      
      // Configuration Firebase
      FIREBASE: {
        initialized: false
      },
      
      // API endpoints
      API: {
        BASE_URL: window.location.origin + '/api',
        UPLOAD: '/api/upload',
        LANDING_PAGES: '/api/landing',
        PROFILES: '/api/profiles',
        SUBSCRIBERS: '/api/subscribers',
        ANALYTICS: '/api/analytics',
        TELEGRAM: '/api/telegram'
      },
      
      // Storage config
      STORAGE_VERSION: '1.0',
      STORAGE_PREFIX: 'makerhub_',
      AUTOSAVE_INTERVAL: 10000,
      AUTOSAVE_DELAY: 5000,
      
      // Storage keys
      STORAGE_KEYS: {
        AUTH_TOKEN: 'makerhub_auth_token',
        USER_DATA: 'makerhub_user_data',
        CURRENT_PAGE: 'makerhub_current_page',
        PRICING_DATA: 'makerhub_pricing_',
        REVIEWS_DATA: 'makerhub_reviews_',
        CHANNEL_DATA: 'makerhub_channel_'
      },
      
      // Default values pour la création de pages
      DEFAULTS: {
        LOGO_SHAPE: 'circle',
        TEMPLATE: 'white-minimal',
        ACCENT_COLOR: '#ffd600',
        FONT_FAMILY: 'inter',
        CURRENCY: 'EUR',
        CURRENCY_SYMBOL: '€',
        DESCRIPTION_FORMAT: '',
        ACCESS_EMOJI: '🔒',
        BUTTON_EMOJI: '',
        BUTTON_TEXT: 'Join Now',
        GLOBAL_RATING: '4.8',
        REVIEW_RATING: 5,
        MAX_REVIEW_LENGTH: 500,
        MIN_REVIEW_LENGTH: 10
      },
      
      // Templates de design
      TEMPLATES: {
        'white-minimal': { name: 'White Minimal', background: '#ffffff' },
        'ice-crystal': { name: 'Ice Crystal', background: 'linear-gradient(135deg, #e0f7fa, #29b6f6)' },
        'navy-blue': { name: 'Navy Blue', background: 'linear-gradient(135deg, #1e3a8a, #3b82f6)' },
        'rose-gold': { name: 'Rose Gold', background: 'linear-gradient(135deg, #f8bbd9, #ffeb3b)' },
        'rose-sunset': { name: 'Rose Sunset', background: 'linear-gradient(135deg, #ff9a9e, #f093fb)' },
        'lava': { name: 'Lava', background: 'linear-gradient(45deg, #ff4500, #8b0000)' },
        'neon-mint-classic': { name: 'Neon Mint', background: 'linear-gradient(135deg, #00ff88, #00ffff)' },
        'orchid-bloom': { name: 'Orchid Bloom', background: 'linear-gradient(135deg, #da70d6, #8a2be2)' },
        'aurora': { name: 'Aurora', background: 'linear-gradient(135deg, #00ff87, #6e48aa)' },
        'sunset': { name: 'Sunset', background: 'linear-gradient(135deg, #ff9a56, #ff5722)' },
        'holographic-classic': { name: 'Holographic', background: 'linear-gradient(45deg, #ff00ff, #ffff00, #ff00ff)' },
        'metallic-silver': { name: 'Metallic Silver', background: 'linear-gradient(135deg, #e8e8e8, #f0f0f0)' },
        'nature-harmony': { name: 'Nature Harmony', background: 'linear-gradient(45deg, #8bc34a, #00695c)' },
        'electric-yellow': { name: 'Electric Yellow', background: 'linear-gradient(45deg, #ffff00, #ff8f00)' },
        'earth-tone': { name: 'Earth Tone', background: 'linear-gradient(135deg, #6d4c41, #795548)' },
        'midnight-dark': { name: 'Midnight Dark', background: 'linear-gradient(135deg, #0f0f23, #533483)' },
        'sakura-bloom': { name: 'Sakura Bloom', background: 'linear-gradient(135deg, #fdf2f8, #ec4899)' },
        'forest-green': { name: 'Forest Green', background: 'linear-gradient(135deg, #064e3b, #10b981)' },
        'electric-neon': { name: 'Electric Neon', background: 'linear-gradient(45deg, #00ffff, #ff0080)' },
        'business-gradient': { name: 'Business Gradient', background: 'linear-gradient(135deg, #667eea, #764ba2)' }
      }
    };
    
    // Fonction utilitaire pour obtenir la configuration
    window.getConfig = function(path) {
      const keys = path.split('.');
      let value = window.MAKERHUB_CONFIG;
      
      for (const key of keys) {
        if (value && typeof value === 'object' && key in value) {
          value = value[key];
        } else {
          return undefined;
        }
      }
      
      return value;
    };
    
    // Fonction pour mettre à jour la configuration
    window.setConfig = function(path, newValue) {
      const keys = path.split('.');
      let obj = window.MAKERHUB_CONFIG;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (!(key in obj) || typeof obj[key] !== 'object') {
          obj[key] = {};
        }
        obj = obj[key];
      }
      
      obj[keys[keys.length - 1]] = newValue;
    };
    
    console.log('MAKERHUB Constants loaded successfully v1.0');
  }

  // Export pour Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      PLAN_COMMISSIONS,
      DEFAULT_COMMISSION,
      SUBSCRIBER_SOURCES,
      PAGE_TYPES,
      CURRENCIES,
      SYMBOL_TO_CODE,
      CODE_TO_SYMBOL,
      SUPPORTED_CURRENCIES,
      BACKEND_PERIODS
    };
  }
})();