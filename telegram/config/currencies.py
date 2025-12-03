"""Configuration des devises supportées"""

SUPPORTED_CURRENCIES = {
    'USD': {
        'code': 'USD',
        'name': 'Dollar américain',
        'symbol': '$',
        'locale': 'en_US',
        'country': 'US',
        'country_name': 'États-Unis',
        'flag': '🇺🇸',
        'decimals': 2,
        'stripe_supported': True
    },
    'EUR': {
        'code': 'EUR',
        'name': 'Euro',
        'symbol': '€',
        'locale': 'fr_FR',
        'country': 'FR',
        'country_name': 'Zone euro',
        'flag': '🇪🇺',
        'decimals': 2,
        'stripe_supported': True
    },
    'JPY': {
        'code': 'JPY',
        'name': 'Yen japonais',
        'symbol': '¥',
        'locale': 'ja_JP',
        'country': 'JP',
        'country_name': 'Japon',
        'flag': '🇯🇵',
        'decimals': 0,
        'stripe_supported': True
    },
    'GBP': {
        'code': 'GBP',
        'name': 'Livre sterling',
        'symbol': '£',
        'locale': 'en_GB',
        'country': 'GB',
        'country_name': 'Royaume-Uni',
        'flag': '🇬🇧',
        'decimals': 2,
        'stripe_supported': True
    },
    'AUD': {
        'code': 'AUD',
        'name': 'Dollar australien',
        'symbol': 'A$',
        'locale': 'en_AU',
        'country': 'AU',
        'country_name': 'Australie',
        'flag': '🇦🇺',
        'decimals': 2,
        'stripe_supported': True
    },
    'CAD': {
        'code': 'CAD',
        'name': 'Dollar canadien',
        'symbol': 'C$',
        'locale': 'en_CA',
        'country': 'CA',
        'country_name': 'Canada',
        'flag': '🇨🇦',
        'decimals': 2,
        'stripe_supported': True
    },
    'CHF': {
        'code': 'CHF',
        'name': 'Franc suisse',
        'symbol': 'CHF',
        'locale': 'fr_CH',
        'country': 'CH',
        'country_name': 'Suisse',
        'flag': '🇨🇭',
        'decimals': 2,
        'stripe_supported': True
    },
    'CNY': {
        'code': 'CNY',
        'name': 'Yuan chinois',
        'symbol': '¥',
        'locale': 'zh_CN',
        'country': 'CN',
        'country_name': 'Chine',
        'flag': '🇨🇳',
        'decimals': 2,
        'stripe_supported': True
    },
    'SGD': {
        'code': 'SGD',
        'name': 'Dollar de Singapour',
        'symbol': 'S$',
        'locale': 'en_SG',
        'country': 'SG',
        'country_name': 'Singapour',
        'flag': '🇸🇬',
        'decimals': 2,
        'stripe_supported': True
    },
    'SEK': {
        'code': 'SEK',
        'name': 'Couronne suédoise',
        'symbol': 'kr',
        'locale': 'sv_SE',
        'country': 'SE',
        'country_name': 'Suède',
        'flag': '🇸🇪',
        'decimals': 2,
        'stripe_supported': True
    },
    'NOK': {
        'code': 'NOK',
        'name': 'Couronne norvégienne',
        'symbol': 'kr',
        'locale': 'nb_NO',
        'country': 'NO',
        'country_name': 'Norvège',
        'flag': '🇳🇴',
        'decimals': 2,
        'stripe_supported': True
    },
    'KRW': {
        'code': 'KRW',
        'name': 'Won sud-coréen',
        'symbol': '₩',
        'locale': 'ko_KR',
        'country': 'KR',
        'country_name': 'Corée du Sud',
        'flag': '🇰🇷',
        'decimals': 0,
        'stripe_supported': True
    },
    'BRL': {
        'code': 'BRL',
        'name': 'Real brésilien',
        'symbol': 'R$',
        'locale': 'pt_BR',
        'country': 'BR',
        'country_name': 'Brésil',
        'flag': '🇧🇷',
        'decimals': 2,
        'stripe_supported': True
    }
}

# Prix de base en USD
BASE_PRICING = {
    'basic': {
        'monthly': 9.99,
        'yearly': 99.99
    },
    'premium': {
        'monthly': 29.99,
        'yearly': 299.99
    },
    'enterprise': {
        'monthly': 99.99,
        'yearly': 999.99
    }
}

def get_all_currencies():
    """Obtenir toutes les devises"""
    return list(SUPPORTED_CURRENCIES.values())

def get_currency(code):
    """Obtenir une devise spécifique"""
    return SUPPORTED_CURRENCIES.get(code)

def get_currency_codes():
    """Obtenir les codes devise"""
    return list(SUPPORTED_CURRENCIES.keys())

def is_supported(code):
    """Vérifier si devise supportée"""
    return code in SUPPORTED_CURRENCIES