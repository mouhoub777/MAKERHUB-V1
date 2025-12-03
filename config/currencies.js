module.exports = {
  // Configuration complète des devises
  currencies: {
    USD: {
      code: 'USD',
      name: 'Dollar américain',
      symbol: '$',
      locale: 'en-US',
      country: 'US',
      countryName: 'États-Unis',
      flag: '🇺🇸',
      decimals: 2,
      stripSupported: true
    },
    EUR: {
      code: 'EUR',
      name: 'Euro',
      symbol: '€',
      locale: 'fr-FR',
      country: 'FR',
      countryName: 'Zone euro',
      flag: '🇪🇺',
      decimals: 2,
      stripSupported: true
    },
    JPY: {
      code: 'JPY',
      name: 'Yen japonais',
      symbol: '¥',
      locale: 'ja-JP',
      country: 'JP',
      countryName: 'Japon',
      flag: '🇯🇵',
      decimals: 0,
      stripSupported: true
    },
    GBP: {
      code: 'GBP',
      name: 'Livre sterling',
      symbol: '£',
      locale: 'en-GB',
      country: 'GB',
      countryName: 'Royaume-Uni',
      flag: '🇬🇧',
      decimals: 2,
      stripSupported: true
    },
    AUD: {
      code: 'AUD',
      name: 'Dollar australien',
      symbol: 'A$',
      locale: 'en-AU',
      country: 'AU',
      countryName: 'Australie',
      flag: '🇦🇺',
      decimals: 2,
      stripSupported: true
    },
    CAD: {
      code: 'CAD',
      name: 'Dollar canadien',
      symbol: 'C$',
      locale: 'en-CA',
      country: 'CA',
      countryName: 'Canada',
      flag: '🇨🇦',
      decimals: 2,
      stripSupported: true
    },
    CHF: {
      code: 'CHF',
      name: 'Franc suisse',
      symbol: 'CHF',
      locale: 'fr-CH',
      country: 'CH',
      countryName: 'Suisse',
      flag: '🇨🇭',
      decimals: 2,
      stripSupported: true
    },
    CNY: {
      code: 'CNY',
      name: 'Yuan chinois',
      symbol: '¥',
      locale: 'zh-CN',
      country: 'CN',
      countryName: 'Chine',
      flag: '🇨🇳',
      decimals: 2,
      stripSupported: true
    },
    SGD: {
      code: 'SGD',
      name: 'Dollar de Singapour',
      symbol: 'S$',
      locale: 'en-SG',
      country: 'SG',
      countryName: 'Singapour',
      flag: '🇸🇬',
      decimals: 2,
      stripSupported: true
    },
    SEK: {
      code: 'SEK',
      name: 'Couronne suédoise',
      symbol: 'kr',
      locale: 'sv-SE',
      country: 'SE',
      countryName: 'Suède',
      flag: '🇸🇪',
      decimals: 2,
      stripSupported: true
    },
    NOK: {
      code: 'NOK',
      name: 'Couronne norvégienne',
      symbol: 'kr',
      locale: 'nb-NO',
      country: 'NO',
      countryName: 'Norvège',
      flag: '🇳🇴',
      decimals: 2,
      stripSupported: true
    },
    KRW: {
      code: 'KRW',
      name: 'Won sud-coréen',
      symbol: '₩',
      locale: 'ko-KR',
      country: 'KR',
      countryName: 'Corée du Sud',
      flag: '🇰🇷',
      decimals: 0,
      stripSupported: true
    },
    BRL: {
      code: 'BRL',
      name: 'Real brésilien',
      symbol: 'R$',
      locale: 'pt-BR',
      country: 'BR',
      countryName: 'Brésil',
      flag: '🇧🇷',
      decimals: 2,
      stripSupported: true
    }
  },
  
  // Prix de base en USD
  basePricing: {
    basic: {
      monthly: 9.99,
      yearly: 99.99
    },
    premium: {
      monthly: 29.99,
      yearly: 299.99
    },
    enterprise: {
      monthly: 99.99,
      yearly: 999.99
    }
  },
  
  // Obtenir toutes les devises
  getAll() {
    return Object.values(this.currencies);
  },
  
  // Obtenir une devise spécifique
  get(currencyCode) {
    return this.currencies[currencyCode];
  },
  
  // Obtenir les codes de devise
  getCodes() {
    return Object.keys(this.currencies);
  },
  
  // Vérifier si une devise est supportée
  isSupported(currencyCode) {
    return this.currencies.hasOwnProperty(currencyCode);
  }
};