// ==================== STRIPE CONFIG OPTIMISÉ - ANTI-CONFLITS ====================
// services/connect-stripe-node/src/config/stripe.js

const Stripe = require('stripe');

// ==================== VALIDATION ENVIRONNEMENT ====================
const requiredEnvVars = [
  'STRIPE_SECRET_KEY',
  'STRIPE_CONNECT_WEBHOOK_SECRET',  // Spécifique Connect
  'DOMAIN',
  'NODE_ENV'
];

// Vérifier variables obligatoires
requiredEnvVars.forEach(envVar => {
  if (!process.env[envVar]) {
    throw new Error(`❌ Variable d'environnement manquante: ${envVar}`);
  }
});

// Valider format clé Stripe
if (!process.env.STRIPE_SECRET_KEY.startsWith('sk_')) {
  throw new Error('❌ STRIPE_SECRET_KEY doit commencer par sk_');
}

// Valider webhook secret
if (!process.env.STRIPE_CONNECT_WEBHOOK_SECRET.startsWith('whsec_')) {
  throw new Error('❌ STRIPE_CONNECT_WEBHOOK_SECRET doit commencer par whsec_');
}

// ==================== INITIALISATION STRIPE ====================
const stripe = Stripe(process.env.STRIPE_SECRET_KEY, {
  apiVersion: '2023-10-16',  // Version fixe pour stabilité
  timeout: 20000,            // 20 secondes timeout
  maxNetworkRetries: 3,      // 3 tentatives max
  telemetry: process.env.NODE_ENV === 'production', // Télémétrie en prod
  stripeAccount: undefined   // Pas de compte par défaut
});

// ==================== CONFIGURATION CONNECT SPÉCIALISÉE ====================
const STRIPE_CONNECT_CONFIG = {
  // Webhooks
  webhookSecret: process.env.STRIPE_CONNECT_WEBHOOK_SECRET,
  
  // URLs Connect (spécialisées)
  connectReturnUrl: `${process.env.DOMAIN}/connect/return`,
  connectRefreshUrl: `${process.env.DOMAIN}/connect/refresh`,
  
  // OAuth Connect
  oauthAuthorizeUrl: 'https://connect.stripe.com/oauth/authorize',
  oauthTokenUrl: 'https://connect.stripe.com/oauth/token',
  
  // Scopes Connect (permissions demandées)
  defaultScopes: [
    'read_write'  // Accès complet aux comptes connectés
  ],
  
  // Types de comptes supportés
  accountTypes: {
    STANDARD: 'standard',    // Compte standard
    EXPRESS: 'express',      // Compte express (recommandé)
    CUSTOM: 'custom'         // Compte custom (avancé)
  },
  
  // Capacités par défaut
  defaultCapabilities: {
    card_payments: { requested: true },
    transfers: { requested: true },
    tax_reporting_us_1099_k: { requested: false }
  },
  
  // Pays supportés (étendible)
  supportedCountries: [
    'US', 'CA', 'GB', 'AU', 'FR', 'DE', 'ES', 'IT', 'NL', 'SE', 'DK', 'NO', 'FI',
    'JP', 'SG', 'HK', 'NZ', 'IE', 'AT', 'BE', 'CH', 'LU', 'PT', 'PL', 'CZ'
  ],
  
  // Devises supportées
  supportedCurrencies: [
    'usd', 'eur', 'gbp', 'cad', 'aud', 'jpy', 'chf', 'sek', 'dkk', 'nok',
    'pln', 'czk', 'hkd', 'sgd', 'nzd'
  ],
  
  // Limites et seuils
  limits: {
    minTransferAmount: 50,      // 50 cents minimum
    maxAccountsPerPlatform: 1000, // Limite recommandée
    defaultTransferSchedule: {
      delay_days: 2,            // 2 jours de délai
      interval: 'daily',        // Transferts quotidiens
      weekly_anchor: 'friday'   // Si hebdomadaire, le vendredi
    }
  },
  
  // Configuration fees (commission plateforme)
  feeConfig: {
    defaultApplicationFeePercent: 2.5,  // 2.5% de commission
    minApplicationFee: 50,              // 50 cents minimum
    maxApplicationFee: 500              // 5$ maximum
  },
  
  // Webhooks events à écouter
  webhookEvents: [
    'account.updated',
    'account.application.deauthorized', 
    'account.external_account.created',
    'account.external_account.updated',
    'payment_intent.succeeded',
    'payment_intent.payment_failed',
    'transfer.created',
    'transfer.updated',
    'payout.created',
    'payout.paid',
    'payout.failed'
  ],
  
  // Configuration retry et timeout
  retryConfig: {
    maxRetries: 3,
    baseDelay: 1000,      // 1 seconde
    maxDelay: 10000       // 10 secondes max
  },
  
  // URLs complètes pour les redirections
  getConnectUrls: (baseUrl = process.env.DOMAIN) => ({
    return: `${baseUrl}/connect/return`,
    refresh: `${baseUrl}/connect/refresh`,
    onboarding: `${baseUrl}/connect/onboarding`,
    dashboard: `${baseUrl}/connect/dashboard`
  })
};

// ==================== HELPERS STRIPE CONNECT ====================
const StripeConnectHelpers = {
  /**
   * Créer une URL d'OAuth Connect
   */
  buildOAuthUrl: (clientId, state, accountType = 'express') => {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: clientId,
      scope: STRIPE_CONNECT_CONFIG.defaultScopes.join(' '),
      redirect_uri: STRIPE_CONNECT_CONFIG.connectReturnUrl,
      state: state,
      'stripe_user[business_type]': accountType,
      'stripe_user[country]': 'US' // Par défaut, modifiable
    });
    
    return `${STRIPE_CONNECT_CONFIG.oauthAuthorizeUrl}?${params.toString()}`;
  },
  
  /**
   * Valider un webhook Connect
   */
  validateConnectWebhook: (payload, signature) => {
    try {
      return stripe.webhooks.constructEvent(
        payload,
        signature,
        STRIPE_CONNECT_CONFIG.webhookSecret
      );
    } catch (error) {
      throw new Error(`Webhook validation failed: ${error.message}`);
    }
  },
  
  /**
   * Calculer les fees d'application
   */
  calculateApplicationFee: (amount, percentage = STRIPE_CONNECT_CONFIG.feeConfig.defaultApplicationFeePercent) => {
    const fee = Math.round(amount * (percentage / 100));
    return Math.min(
      Math.max(fee, STRIPE_CONNECT_CONFIG.feeConfig.minApplicationFee),
      STRIPE_CONNECT_CONFIG.feeConfig.maxApplicationFee
    );
  },
  
  /**
   * Vérifier si pays supporté
   */
  isSupportedCountry: (countryCode) => {
    return STRIPE_CONNECT_CONFIG.supportedCountries.includes(countryCode.toUpperCase());
  },
  
  /**
   * Vérifier si devise supportée
   */
  isSupportedCurrency: (currency) => {
    return STRIPE_CONNECT_CONFIG.supportedCurrencies.includes(currency.toLowerCase());
  }
};

// ==================== GESTION ERREURS STRIPE ====================
const StripeErrorHandler = {
  /**
   * Parser les erreurs Stripe Connect
   */
  parseStripeError: (error) => {
    const errorInfo = {
      type: error.type || 'unknown',
      code: error.code || null,
      message: error.message || 'Unknown error',
      statusCode: error.statusCode || 500,
      requestId: error.requestId || null
    };
    
    // Messages personnalisés par type d'erreur
    switch (error.type) {
      case 'StripeCardError':
        errorInfo.userMessage = 'Problem with payment card';
        break;
      case 'StripeInvalidRequestError':
        errorInfo.userMessage = 'Invalid request';
        break;
      case 'StripeAPIError':
        errorInfo.userMessage = 'Temporary error, please try again';
        break;
      case 'StripeConnectionError':
        errorInfo.userMessage = 'Connection problem, please try again';
        break;
      case 'StripeAuthenticationError':
        errorInfo.userMessage = 'Erreur d\'authentification';
        break;
      default:
        errorInfo.userMessage = 'An error occurred';
    }
    
    return errorInfo;
  }
};

// ==================== LOGGING STRIPE ====================
const logger = require('../utils/logger');

// Logger spécialisé pour Stripe
const StripeLogger = {
  logRequest: (method, endpoint, data = {}) => {
    logger.info('Stripe Request', {
      method,
      endpoint,
      dataKeys: Object.keys(data),
      timestamp: new Date().toISOString()
    });
  },
  
  logResponse: (method, endpoint, success = true, duration = 0) => {
    logger.info('Stripe Response', {
      method,
      endpoint,
      success,
      duration: `${duration}ms`,
      timestamp: new Date().toISOString()
    });
  },
  
  logError: (method, endpoint, error) => {
    const errorInfo = StripeErrorHandler.parseStripeError(error);
    logger.error('Stripe Error', {
      method,
      endpoint,
      error: errorInfo,
      timestamp: new Date().toISOString()
    });
  }
};

// ==================== EXPORT CONFIGURATION ====================
module.exports = {
  // Core Stripe
  stripe,
  
  // Configuration spécialisée Connect
  STRIPE_CONNECT_CONFIG,
  
  // Helpers utilitaires
  StripeConnectHelpers,
  
  // Gestion erreurs
  StripeErrorHandler,
  
  // Logging
  StripeLogger,
  
  // Constantes pour backward compatibility
  STRIPE_CONFIG: {
    webhookSecret: STRIPE_CONNECT_CONFIG.webhookSecret,
    connectReturnUrl: STRIPE_CONNECT_CONFIG.connectReturnUrl,
    connectRefreshUrl: STRIPE_CONNECT_CONFIG.connectRefreshUrl
  }
};
