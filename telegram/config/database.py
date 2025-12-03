# telegram/config/database.py
"""
Configuration centralisée Firebase pour tous les services Telegram
PRODUCTION READY - 100% FIREBASE
"""

import os
import logging
import firebase_admin
from firebase_admin import credentials, firestore
from typing import Optional

logger = logging.getLogger(__name__)

# Instance globale de la base de données
_db = None
_initialized = False

def initialize_firebase():
    """
    Initialise Firebase Admin SDK une seule fois
    Utilise les variables d'environnement ou le fichier de clés
    """
    global _initialized
    
    if _initialized:
        logger.info("✅ Firebase déjà initialisé")
        return True
    
    try:
        # Vérifier si déjà initialisé par une autre partie de l'app
        if firebase_admin._apps:
            logger.info("✅ Firebase app existante détectée")
            _initialized = True
            return True
        
        # Essayer plusieurs méthodes d'initialisation
        
        # Méthode 1: Fichier de clés de service
        possible_paths = [
            "firebase-service-account.json",
            "../firebase-service-account.json",
            "serviceAccountKey.json",
            "../serviceAccountKey.json",
            os.getenv('FIREBASE_SERVICE_ACCOUNT_PATH', '')
        ]
        
        service_account_path = None
        for path in possible_paths:
            if path and os.path.exists(path):
                service_account_path = path
                break
        
        if service_account_path:
            cred = credentials.Certificate(service_account_path)
            firebase_admin.initialize_app(cred)
            logger.info(f"✅ Firebase initialisé avec {service_account_path}")
            _initialized = True
            return True
        
        # Méthode 2: Variables d'environnement
        if all([
            os.getenv('FIREBASE_PROJECT_ID'),
            os.getenv('FIREBASE_PRIVATE_KEY'),
            os.getenv('FIREBASE_CLIENT_EMAIL')
        ]):
            cred_dict = {
                "type": "service_account",
                "project_id": os.getenv('FIREBASE_PROJECT_ID'),
                "private_key": os.getenv('FIREBASE_PRIVATE_KEY').replace('\\n', '\n'),
                "client_email": os.getenv('FIREBASE_CLIENT_EMAIL'),
            }
            cred = credentials.Certificate(cred_dict)
            firebase_admin.initialize_app(cred)
            logger.info("✅ Firebase initialisé avec variables d'environnement")
            _initialized = True
            return True
        
        # Méthode 3: Credentials par défaut (Cloud Run, etc.)
        firebase_admin.initialize_app()
        logger.info("✅ Firebase initialisé avec credentials par défaut")
        _initialized = True
        return True
        
    except Exception as e:
        logger.error(f"❌ Erreur initialisation Firebase: {e}")
        return False

def get_db() -> Optional[firestore.Client]:
    """
    Retourne l'instance Firestore
    Initialise Firebase si nécessaire
    """
    global _db
    
    if not _initialized:
        if not initialize_firebase():
            raise Exception("Impossible d'initialiser Firebase")
    
    if not _db:
        _db = firestore.client()
        logger.info("✅ Client Firestore créé")
    
    return _db

# Alias pour compatibilité
db = get_db

# Collections Telegram officielles
COLLECTIONS = {
    # Collections principales
    'CREATORS': 'creators',
    'PROFILES': 'profiles',
    'LANDINGS': 'landings',
    'LINKS': 'links',
    
    # Collections Telegram
    'TELEGRAM_BOTS': 'telegram-bots',
    'TELEGRAM_USERS': 'telegram-users',
    'TELEGRAM_REMINDERS': 'telegram-reminders',
    'TELEGRAM_LISTS': 'telegram-lists',
    'TELEGRAM_FUNNELS': 'telegram-funnels',
    'TELEGRAM_MESSAGES': 'telegram-messages',
    
    # Collections Bot Créateur
    'CREATOR_BOTS': 'creator-bots',
    'CREATOR_BOT_USERS': 'creator-bot-users',
    'CREATOR_LISTS': 'creator-lists',
    
    # Collections Analytics
    'BOT_MESSAGES': 'bot-messages',
    'BUTTON_CLICKS': 'button-clicks',
    'BROADCASTS': 'broadcasts',
    
    # Collections Traduction
    'TRANSLATION_CONFIGS': 'translation-configs',
    'TRANSLATION_HISTORY': 'translation-history',
    
    # Collections Système
    'REGISTRATIONS': 'registrations',  # Pour les relances
    'SALES': 'sales',
    'HEALTH_CHECK': '_health_check'
}

def test_connection() -> bool:
    """
    Teste la connexion à Firebase
    """
    try:
        db = get_db()
        # Test simple d'écriture/lecture
        test_ref = db.collection(COLLECTIONS['HEALTH_CHECK']).document('test')
        test_ref.set({'test': True, 'timestamp': firestore.SERVER_TIMESTAMP})
        doc = test_ref.get()
        if doc.exists:
            test_ref.delete()  # Nettoyer
            logger.info("✅ Test connexion Firebase réussi")
            return True
        return False
    except Exception as e:
        logger.error(f"❌ Test connexion Firebase échoué: {e}")
        return False

# Export principal
__all__ = [
    'db',
    'get_db', 
    'initialize_firebase',
    'test_connection',
    'COLLECTIONS'
]