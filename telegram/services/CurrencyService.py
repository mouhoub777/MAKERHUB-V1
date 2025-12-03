import os
from decimal import Decimal

class CurrencyService:
    def __init__(self):
        # Taux de change (à mettre à jour ou utiliser une API)
        self.exchange_rates = {
            'USD': 1,
            'EUR': 0.92,
            'JPY': 150.50,
            'GBP': 0.79,
            'AUD': 1.52,
            'CAD': 1.36,
            'CHF': 0.91,
            'CNY': 7.24,
            'SGD': 1.35,
            'SEK': 10.52,
            'NOK': 10.68,
            'KRW': 1332.50,
            'BRL': 4.95
        }
        
        # Configuration des devises
        self.currencies = {
            'USD': {'symbol': '$', 'locale': 'en_US', 'name': 'US Dollar'},
            'EUR': {'symbol': '€', 'locale': 'fr_FR', 'name': 'Euro'},
            'JPY': {'symbol': '¥', 'locale': 'ja_JP', 'name': 'Japanese Yen'},
            'GBP': {'symbol': '£', 'locale': 'en_GB', 'name': 'British Pound'},
            'AUD': {'symbol': 'A$', 'locale': 'en_AU', 'name': 'Australian Dollar'},
            'CAD': {'symbol': 'C$', 'locale': 'en_CA', 'name': 'Canadian Dollar'},
            'CHF': {'symbol': 'CHF', 'locale': 'fr_CH', 'name': 'Swiss Franc'},
            'CNY': {'symbol': '¥', 'locale': 'zh_CN', 'name': 'Chinese Yuan'},
            'SGD': {'symbol': 'S$', 'locale': 'en_SG', 'name': 'Singapore Dollar'},
            'SEK': {'symbol': 'kr', 'locale': 'sv_SE', 'name': 'Swedish Krona'},
            'NOK': {'symbol': 'kr', 'locale': 'nb_NO', 'name': 'Norwegian Krone'},
            'KRW': {'symbol': '₩', 'locale': 'ko_KR', 'name': 'Korean Won'},
            'BRL': {'symbol': 'R$', 'locale': 'pt_BR', 'name': 'Brazilian Real'}
        }
    
    def convert_from_usd(self, amount_usd, to_currency):
        """Convertir USD vers autre devise"""
        rate = self.exchange_rates.get(to_currency)
        if not rate:
            raise ValueError(f"Currency {to_currency} not supported")
        
        # Devises sans décimales
        no_decimal_currencies = ['JPY', 'KRW']
        converted = Decimal(str(amount_usd)) * Decimal(str(rate))
        
        if to_currency in no_decimal_currencies:
            return int(converted)
        
        return float(round(converted, 2))
    
    def format_amount(self, amount, currency):
        """Formater montant avec symbole"""
        config = self.currencies.get(currency)
        if not config:
            return f"{amount} {currency}"
        
        symbol = config['symbol']
        
        # Format selon la devise
        if currency in ['JPY', 'KRW']:
            return f"{symbol}{int(amount):,}"
        else:
            return f"{symbol}{amount:,.2f}"
    
    def calculate_platform_fee(self, amount, fee_percentage=None):
        """Calculer frais de plateforme"""
        if fee_percentage is None:
            fee_percentage = float(os.getenv('PLATFORM_FEE_PERCENTAGE', 10))
        
        return float(amount) * (fee_percentage / 100)
    
    def get_currency_info(self, currency_code):
        """Obtenir infos devise"""
        return {
            'code': currency_code,
            **self.currencies.get(currency_code, {}),
            'exchangeRate': self.exchange_rates.get(currency_code)
        }
    
    def get_supported_currencies(self):
        """Obtenir toutes les devises supportées"""
        return [
            {
                'code': code,
                **info,
                'exchangeRate': self.exchange_rates[code]
            }
            for code, info in self.currencies.items()
        ]