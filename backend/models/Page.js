// Modèle pour Firebase - Structure de données
const PageSchema = {
  name: String,
  language: {
    code: String,
    name: String,
    native: String,
    flag: String
  },
  currency: {
    code: String,
    name: String,
    symbol: String,
    country: String
  },
  userId: String,
  type: String, // 'telegram', 'landing', 'profile'
  stripeAccountId: String,
  stripePrices: {
    monthly: String, // ID du prix Stripe mensuel
    yearly: String   // ID du prix Stripe annuel
  },
  pricing: {
    monthly: Number,
    yearly: Number
  },
  status: String, // 'active', 'inactive', 'suspended'
  analytics: {
    views: Number,
    conversions: Number,
    revenue: Number
  },
  metadata: Object,
  createdAt: Date,
  updatedAt: Date
};

// Validation des données
const validatePage = (data) => {
  const errors = [];
  
  if (!data.name || data.name.trim().length < 3) {
    errors.push('Name must be at least 3 characters');
  }
  
  if (!data.language || !data.language.code) {
    errors.push('Language is required');
  }
  
  if (!data.currency || !data.currency.code) {
    errors.push('Currency is required');
  }
  
  const validCurrencies = ['USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 
                          'CHF', 'CNY', 'SGD', 'SEK', 'NOK', 'KRW', 'BRL'];
  
  if (!validCurrencies.includes(data.currency.code)) {
    errors.push('Invalid currency selected');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

module.exports = {
  PageSchema,
  validatePage
};