// Utilitaires pour les devises

// Obtenir le pays à partir du code devise
const getCountryFromCurrency = (currency) => {
  const currencyToCountry = {
    'USD': 'US',
    'EUR': 'FR', // Ou tout pays de la zone Euro
    'JPY': 'JP',
    'GBP': 'GB',
    'AUD': 'AU',
    'CAD': 'CA',
    'CHF': 'CH',
    'CNY': 'CN',
    'SGD': 'SG',
    'SEK': 'SE',
    'NOK': 'NO',
    'KRW': 'KR',
    'BRL': 'BR'
  };
  
  return currencyToCountry[currency] || 'US';
};

// Calculer les frais de plateforme
const calculatePlatformFee = (amount, feePercentage = 10) => {
  return Math.round(amount * (feePercentage / 100));
};

// Vérifier si une devise nécessite des décimales
const requiresDecimals = (currency) => {
  const noDecimalCurrencies = ['JPY', 'KRW'];
  return !noDecimalCurrencies.includes(currency);
};

// Convertir un montant pour Stripe (en centimes)
const toStripeAmount = (amount, currency) => {
  if (requiresDecimals(currency)) {
    return Math.round(amount * 100);
  }
  return Math.round(amount);
};

// Convertir depuis Stripe (depuis centimes)
const fromStripeAmount = (stripeAmount, currency) => {
  if (requiresDecimals(currency)) {
    return stripeAmount / 100;
  }
  return stripeAmount;
};

// Obtenir le symbole de devise
const getCurrencySymbol = (currency) => {
  const symbols = {
    USD: '$',
    EUR: '€',
    JPY: '¥',
    GBP: '£',
    AUD: 'A$',
    CAD: 'C$',
    CHF: 'CHF',
    CNY: '¥',
    SGD: 'S$',
    SEK: 'kr',
    NOK: 'kr',
    KRW: '₩',
    BRL: 'R$'
  };
  
  return symbols[currency] || currency;
};

// Valider un code devise
const isValidCurrency = (currency) => {
  const validCurrencies = ['USD', 'EUR', 'JPY', 'GBP', 'AUD', 'CAD', 
                          'CHF', 'CNY', 'SGD', 'SEK', 'NOK', 'KRW', 'BRL'];
  return validCurrencies.includes(currency);
};

module.exports = {
  getCountryFromCurrency,
  calculatePlatformFee,
  requiresDecimals,
  toStripeAmount,
  fromStripeAmount,
  getCurrencySymbol,
  isValidCurrency
};