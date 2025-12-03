const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

class CurrencyService {
  constructor() {
    // Taux de change de base (à mettre à jour régulièrement ou utiliser une API)
    this.exchangeRates = {
      USD: 1,
      EUR: 0.92,
      JPY: 150.50,
      GBP: 0.79,
      AUD: 1.52,
      CAD: 1.36,
      CHF: 0.91,
      CNY: 7.24,
      SGD: 1.35,
      SEK: 10.52,
      NOK: 10.68,
      KRW: 1332.50,
      BRL: 4.95
    };
    
    // Configuration des devises
    this.currencies = {
      USD: { symbol: '$', locale: 'en-US', name: 'US Dollar' },
      EUR: { symbol: '€', locale: 'fr-FR', name: 'Euro' },
      JPY: { symbol: '¥', locale: 'ja-JP', name: 'Japanese Yen' },
      GBP: { symbol: '£', locale: 'en-GB', name: 'British Pound' },
      AUD: { symbol: 'A$', locale: 'en-AU', name: 'Australian Dollar' },
      CAD: { symbol: 'C$', locale: 'en-CA', name: 'Canadian Dollar' },
      CHF: { symbol: 'CHF', locale: 'fr-CH', name: 'Swiss Franc' },
      CNY: { symbol: '¥', locale: 'zh-CN', name: 'Chinese Yuan' },
      SGD: { symbol: 'S$', locale: 'en-SG', name: 'Singapore Dollar' },
      SEK: { symbol: 'kr', locale: 'sv-SE', name: 'Swedish Krona' },
      NOK: { symbol: 'kr', locale: 'nb-NO', name: 'Norwegian Krone' },
      KRW: { symbol: '₩', locale: 'ko-KR', name: 'Korean Won' },
      BRL: { symbol: 'R$', locale: 'pt-BR', name: 'Brazilian Real' }
    };
  }
  
  // Convertir un montant USD vers une autre devise
  convertFromUSD(amountUSD, toCurrency) {
    const rate = this.exchangeRates[toCurrency];
    if (!rate) {
      throw new Error(`Currency ${toCurrency} not supported`);
    }
    
    // Pour les devises sans décimales (JPY, KRW)
    const noDecimalCurrencies = ['JPY', 'KRW'];
    const convertedAmount = amountUSD * rate;
    
    if (noDecimalCurrencies.includes(toCurrency)) {
      return Math.round(convertedAmount);
    }
    
    return Math.round(convertedAmount * 100) / 100;
  }
  
  // Formater un montant dans une devise
  formatAmount(amount, currency) {
    const config = this.currencies[currency];
    if (!config) {
      throw new Error(`Currency ${currency} not supported`);
    }
    
    return new Intl.NumberFormat(config.locale, {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: ['JPY', 'KRW'].includes(currency) ? 0 : 2,
      maximumFractionDigits: ['JPY', 'KRW'].includes(currency) ? 0 : 2
    }).format(amount);
  }
  
  // Créer des prix Stripe pour toutes les devises
  async createMultiCurrencyPrices(productId, basePriceUSD, interval = 'month') {
    const prices = {};
    
    for (const currency of Object.keys(this.currencies)) {
      const amount = this.convertFromUSD(basePriceUSD, currency);
      
      try {
        const price = await stripe.prices.create({
          product: productId,
          unit_amount: Math.round(amount * 100), // Stripe utilise les centimes
          currency: currency.toLowerCase(),
          recurring: { interval }
        });
        
        prices[currency] = {
          priceId: price.id,
          amount: amount,
          formatted: this.formatAmount(amount, currency)
        };
      } catch (error) {
        console.error(`Error creating price for ${currency}:`, error);
      }
    }
    
    return prices;
  }
  
  // Obtenir les informations d'une devise
  getCurrencyInfo(currencyCode) {
    return {
      code: currencyCode,
      ...this.currencies[currencyCode],
      exchangeRate: this.exchangeRates[currencyCode]
    };
  }
  
  // Obtenir toutes les devises supportées
  getSupportedCurrencies() {
    return Object.entries(this.currencies).map(([code, info]) => ({
      code,
      ...info,
      exchangeRate: this.exchangeRates[code]
    }));
  }
}

module.exports = new CurrencyService();