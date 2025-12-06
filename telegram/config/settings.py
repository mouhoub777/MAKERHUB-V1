# telegram/config/settings.py
"""
Configuration centralisée pour le service Python MAKERHUB
"""

import os
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()


class Config:
    """Configuration principale"""
    
    # Environment
    ENV = os.getenv('NODE_ENV', 'development')
    DEBUG = ENV == 'development'
    
    # Server
    PORT = int(os.getenv('PYTHON_PORT', 5001))
    HOST = os.getenv('PYTHON_HOST', '0.0.0.0')
    
    # Domain
    DOMAIN = os.getenv('DOMAIN', 'http://localhost:3000')
    BASE_URL = os.getenv('BASE_URL', DOMAIN)
    
    # Firebase
    FIREBASE_PROJECT_ID = os.getenv('FIREBASE_PROJECT_ID', 'autosub-ab7b1')
    FIREBASE_STORAGE_BUCKET = os.getenv('FIREBASE_STORAGE_BUCKET', 'autosub-ab7b1.firebasestorage.app')
    
    # Stripe
    STRIPE_SECRET_KEY = os.getenv('STRIPE_SECRET_KEY', '')
    STRIPE_WEBHOOK_SECRET = os.getenv('STRIPE_WEBHOOK_SECRET', '')
    STRIPE_CONNECT_WEBHOOK_SECRET = os.getenv('STRIPE_CONNECT_WEBHOOK_SECRET', '')
    PLATFORM_FEE_PERCENTAGE = float(os.getenv('PLATFORM_FEE_PERCENTAGE', 5))
    
    # Telegram
    TELEGRAM_TOKEN = os.getenv('TELEGRAM_TOKEN', '')
    TELEGRAM_API_ID = os.getenv('TELEGRAM_API_ID', '')
    TELEGRAM_API_HASH = os.getenv('TELEGRAM_API_HASH', '')
    BOT_USERNAME = os.getenv('BOT_USERNAME', '@Makerhubsub_bot')
    
    # CORS Origins
    CORS_ORIGINS = [
        'http://localhost:3000',
        'http://localhost:5001',
        'http://127.0.0.1:3000',
        'http://127.0.0.1:5001',
        'https://makerhub.pro',
        'https://www.makerhub.pro',
        'https://api.makerhub.pro'
    ]
    
    # Paths
    SERVICE_ACCOUNT_PATHS = [
        'firebase-service-account.json',
        '../firebase-service-account.json',
        'serviceAccountKey.json',
        '../serviceAccountKey.json',
    ]
    
    @classmethod
    def get_service_account_path(cls):
        """Trouve le fichier de compte de service Firebase"""
        for path in cls.SERVICE_ACCOUNT_PATHS:
            if os.path.exists(path):
                return path
        return None
    
    @classmethod
    def validate(cls):
        """Valide que les configurations essentielles sont présentes"""
        errors = []
        
        if not cls.STRIPE_SECRET_KEY:
            errors.append('STRIPE_SECRET_KEY manquant')
        
        if not cls.get_service_account_path():
            errors.append('Fichier Firebase service account introuvable')
        
        return errors
    
    @classmethod
    def print_config(cls):
        """Affiche la configuration au démarrage"""
        print("=" * 50)
        print("🚀 MAKERHUB Python Service")
        print("=" * 50)
        print(f"   ENV: {cls.ENV}")
        print(f"   PORT: {cls.PORT}")
        print(f"   DOMAIN: {cls.DOMAIN}")
        print(f"   DEBUG: {cls.DEBUG}")
        print("-" * 50)
        
        # Vérifier les services
        if cls.STRIPE_SECRET_KEY:
            print("   ✅ Stripe configuré")
        else:
            print("   ❌ Stripe non configuré")
        
        if cls.TELEGRAM_TOKEN:
            print("   ✅ Telegram Bot configuré")
        else:
            print("   ❌ Telegram Bot non configuré")
        
        if cls.get_service_account_path():
            print(f"   ✅ Firebase: {cls.get_service_account_path()}")
        else:
            print("   ❌ Firebase service account introuvable")
        
        print("=" * 50)


# Instance globale de configuration
config = Config()