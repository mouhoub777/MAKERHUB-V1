// utils/constants.js
(function() {
  'use strict';
  
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
      NODE_ENV: 'development',
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
        LANDING_PAGES: '/api/landing-pages',
        PROFILES: '/api/profiles',
        SUBSCRIBERS: '/api/subscribers',
        ANALYTICS: '/api/analytics'
      },
      
      // Storage keys
      STORAGE_KEYS: {
        AUTH_TOKEN: 'makerhub_auth_token',
        USER_DATA: 'makerhub_user_data',
        CURRENT_PAGE: 'makerhub_current_page'
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
        BUTTON_TEXT: 'Join Now'
      },
      
      // Configuration des prix
      PRICE_PLANS: {
        monthly: {
          name: 'Monthly Plan',
          period: 'month',
          icon: '📅',
          defaultPrice: 67,
          defaultEmoji: '🚀',
          defaultDescription: 'Cancel anytime'
        },
        quarterly: {
          name: '3 Months Plan',
          period: '3 months',
          icon: '📆',
          defaultPrice: 197,
          defaultEmoji: '🔥',
          defaultSavings: 24
        },
        annual: {
          name: 'Annual Plan',
          period: 'year',
          icon: '🎯',
          defaultRegularPrice: 804,
          defaultPrice: 497,
          defaultEmoji: '💎',
          defaultDescription: 'Save 307€ (Best Value!)',
          isPopular: true
        }
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
      },
      
      // Liste complète des 22 devises supportées
      CURRENCIES: [
        { code: 'EUR', symbol: '€', name: 'Euro' },
        { code: 'USD', symbol: '$', name: 'US Dollar' },
        { code: 'GBP', symbol: '£', name: 'British Pound' },
        { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
        { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
        { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
        { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
        { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham' },
        { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
        { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
        { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
        { code: 'SEK', symbol: 'SEK', name: 'Swedish Krona' },
        { code: 'DKK', symbol: 'DKK', name: 'Danish Krone' },
        { code: 'NOK', symbol: 'NOK', name: 'Norwegian Krone' },
        { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
        { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
        { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
        { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
        { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
        { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
        { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
        { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' }
      ],
      
      // Mapping symbole vers code ISO
      SYMBOL_TO_CODE: {
        '€': 'EUR',
        '$': 'USD',
        '£': 'GBP',
        'CHF': 'CHF',
        'AED': 'AED',
        'SAR': 'SAR',
        '₪': 'ILS',
        'MAD': 'MAD',
        '¥': 'JPY',
        'CA$': 'CAD',
        'A$': 'AUD',
        'SEK': 'SEK',
        'DKK': 'DKK',
        'NOK': 'NOK',
        'zł': 'PLN',
        'Kč': 'CZK',
        'Ft': 'HUF',
        'lei': 'RON',
        '₺': 'TRY',
        'NZ$': 'NZD',
        'S$': 'SGD',
        'HK$': 'HKD'
      },
      
      // Mapping code ISO vers symbole
      CODE_TO_SYMBOL: {
        'EUR': '€',
        'USD': '$',
        'GBP': '£',
        'CHF': 'CHF',
        'AED': 'AED',
        'SAR': 'SAR',
        'ILS': '₪',
        'MAD': 'MAD',
        'JPY': '¥',
        'CAD': 'CA$',
        'AUD': 'A$',
        'SEK': 'SEK',
        'DKK': 'DKK',
        'NOK': 'NOK',
        'PLN': 'zł',
        'CZK': 'Kč',
        'HUF': 'Ft',
        'RON': 'lei',
        'TRY': '₺',
        'NZD': 'NZ$',
        'SGD': 'S$',
        'HKD': 'HK$'
      },
      
      // Périodes supportées par le backend
      BACKEND_PERIODS: ['mois', '3mois', 'an']
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
    
    console.log('MAKERHUB Constants loaded successfully');
    console.log('✅ Configuration des devises MAKERHUB chargée (22 devises)');
  }

  // Export pour Node.js
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
      PLAN_COMMISSIONS,
      DEFAULT_COMMISSION,
      SUBSCRIBER_SOURCES,
      PAGE_TYPES,
      // Export aussi les devises pour Node.js
      CURRENCIES: [
        { code: 'EUR', symbol: '€', name: 'Euro' },
        { code: 'USD', symbol: '$', name: 'US Dollar' },
        { code: 'GBP', symbol: '£', name: 'British Pound' },
        { code: 'CHF', symbol: 'CHF', name: 'Swiss Franc' },
        { code: 'AED', symbol: 'AED', name: 'UAE Dirham' },
        { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal' },
        { code: 'ILS', symbol: '₪', name: 'Israeli Shekel' },
        { code: 'MAD', symbol: 'MAD', name: 'Moroccan Dirham' },
        { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
        { code: 'CAD', symbol: 'CA$', name: 'Canadian Dollar' },
        { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
        { code: 'SEK', symbol: 'SEK', name: 'Swedish Krona' },
        { code: 'DKK', symbol: 'DKK', name: 'Danish Krone' },
        { code: 'NOK', symbol: 'NOK', name: 'Norwegian Krone' },
        { code: 'PLN', symbol: 'zł', name: 'Polish Zloty' },
        { code: 'CZK', symbol: 'Kč', name: 'Czech Koruna' },
        { code: 'HUF', symbol: 'Ft', name: 'Hungarian Forint' },
        { code: 'RON', symbol: 'lei', name: 'Romanian Leu' },
        { code: 'TRY', symbol: '₺', name: 'Turkish Lira' },
        { code: 'NZD', symbol: 'NZ$', name: 'New Zealand Dollar' },
        { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
        { code: 'HKD', symbol: 'HK$', name: 'Hong Kong Dollar' }
      ],
      SYMBOL_TO_CODE: {
        '€': 'EUR',
        '$': 'USD',
        '£': 'GBP',
        'CHF': 'CHF',
        'AED': 'AED',
        'SAR': 'SAR',
        '₪': 'ILS',
        'MAD': 'MAD',
        '¥': 'JPY',
        'CA$': 'CAD',
        'A$': 'AUD',
        'SEK': 'SEK',
        'DKK': 'DKK',
        'NOK': 'NOK',
        'zł': 'PLN',
        'Kč': 'CZK',
        'Ft': 'HUF',
        'lei': 'RON',
        '₺': 'TRY',
        'NZ$': 'NZD',
        'S$': 'SGD',
        'HK$': 'HKD'
      },
      CODE_TO_SYMBOL: {
        'EUR': '€',
        'USD': '$',
        'GBP': '£',
        'CHF': 'CHF',
        'AED': 'AED',
        'SAR': 'SAR',
        'ILS': '₪',
        'MAD': 'MAD',
        'JPY': '¥',
        'CAD': 'CA$',
        'AUD': 'A$',
        'SEK': 'SEK',
        'DKK': 'DKK',
        'NOK': 'NOK',
        'PLN': 'zł',
        'CZK': 'Kč',
        'HUF': 'Ft',
        'RON': 'lei',
        'TRY': '₺',
        'NZD': 'NZ$',
        'SGD': 'S$',
        'HKD': 'HK$'
      }
    };
  }
})();