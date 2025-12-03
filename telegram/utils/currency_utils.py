"""Utilitaires pour les devises"""
import os
from config.currencies import SUPPORTED_CURRENCIES

def get_country_from_currency(currency):
    """Obtenir pays depuis devise"""
    currency_info = SUPPORTED_CURRENCIES.get(currency)
    return currency_info['country'] if currency_info else 'US'

def requires_decimals(currency):
    """Vérifier si devise nécessite décimales"""
    no_decimal_currencies = ['JPY', 'KRW']
    return currency not in no_decimal_currencies

def to_stripe_amount(amount, currency):
    """Convertir pour Stripe (centimes)"""
    if requires_decimals(currency):
        return int(amount * 100)
    return int(amount)

def from_stripe_amount(stripe_amount, currency):
    """Convertir depuis Stripe"""
    if requires_decimals(currency):
        return stripe_amount / 100
    return stripe_amount

def get_currency_symbol(currency):
    """Obtenir symbole devise"""
    currency_info = SUPPORTED_CURRENCIES.get(currency)
    return currency_info['symbol'] if currency_info else currency

def is_valid_currency(currency):
    """Valider code devise"""
    return currency in SUPPORTED_CURRENCIES

def calculate_platform_fee(amount, fee_percentage=None):
    """Calculer frais plateforme"""
    if fee_percentage is None:
        fee_percentage = float(os.getenv('PLATFORM_FEE_PERCENTAGE', 10))
    return amount * (fee_percentage / 100)