# telegram/services/FirebaseService.py
"""
Service Firebase pour le service Python MAKERHUB V1
"""

import os
import logging
from datetime import datetime
from config.database import db, get_db, initialize_firebase, COLLECTIONS
from firebase_admin import firestore

logger = logging.getLogger(__name__)


class FirebaseService:
    """Service Firebase pour les opérations de base de données"""
    
    def __init__(self):
        self._db = None
        self._initialized = False
    
    def _get_db(self):
        """Lazy initialization de la connexion Firebase"""
        if not self._initialized:
            initialize_firebase()
            self._initialized = True
        if not self._db:
            self._db = get_db()
        return self._db
    
    @property
    def db(self):
        return self._get_db()
    
    # ==================== HEALTH CHECK ====================
    
    def check_connection(self):
        """Vérifie la connexion à Firebase"""
        try:
            self.db.collection('_health').document('test').get()
            return {'status': 'ok', 'service': 'firebase'}
        except Exception as e:
            logger.error(f"Firebase connection error: {e}")
            return {'status': 'error', 'service': 'firebase', 'error': str(e)}
    
    # ==================== LANDING PAGES ====================
    
    def get_landing_page(self, page_id):
        """Récupère une landing page par ID"""
        try:
            doc = self.db.collection('landingPages').document(page_id).get()
            if doc.exists:
                data = doc.to_dict()
                data['id'] = doc.id
                return data
            return None
        except Exception as e:
            logger.error(f"Error getting landing page {page_id}: {e}")
            return None
    
    def update_landing_page(self, page_id, data):
        """Met à jour une landing page"""
        try:
            data['updatedAt'] = firestore.SERVER_TIMESTAMP
            self.db.collection('landingPages').document(page_id).update(data)
            return True
        except Exception as e:
            logger.error(f"Error updating landing page {page_id}: {e}")
            return False
    
    # ==================== USERS / CREATORS ====================
    
    def get_user(self, user_id):
        """Récupère un utilisateur par ID"""
        try:
            doc = self.db.collection('users').document(user_id).get()
            if doc.exists:
                data = doc.to_dict()
                data['id'] = doc.id
                return data
            return None
        except Exception as e:
            logger.error(f"Error getting user {user_id}: {e}")
            return None
    
    def get_creator(self, creator_id):
        """Récupère un créateur par ID"""
        try:
            doc = self.db.collection('creators').document(creator_id).get()
            if doc.exists:
                data = doc.to_dict()
                data['id'] = doc.id
                return data
            return None
        except Exception as e:
            logger.error(f"Error getting creator {creator_id}: {e}")
            return None
    
    def update_user(self, user_id, data):
        """Met à jour un utilisateur"""
        try:
            data['updatedAt'] = firestore.SERVER_TIMESTAMP
            self.db.collection('users').document(user_id).update(data)
            return True
        except Exception as e:
            logger.error(f"Error updating user {user_id}: {e}")
            return False
    
    # ==================== EMAILS ====================
    
    def save_collected_email(self, email_data):
        """Sauvegarde un email collecté"""
        try:
            email_data['createdAt'] = firestore.SERVER_TIMESTAMP
            email_data['status'] = email_data.get('status', 'active')
            email_data['opens'] = 0
            email_data['clicks'] = 0
            
            doc_ref = self.db.collection('collected_emails').add(email_data)
            logger.info(f"✅ Email saved: {email_data.get('email')}")
            return doc_ref[1].id
        except Exception as e:
            logger.error(f"Error saving email: {e}")
            return None
    
    def get_emails_by_creator(self, creator_id, limit=100):
        """Récupère les emails d'un créateur"""
        try:
            docs = self.db.collection('collected_emails').where(
                'creatorId', '==', creator_id
            ).order_by('createdAt', direction=firestore.Query.DESCENDING).limit(limit).get()
            
            emails = []
            for doc in docs:
                data = doc.to_dict()
                data['id'] = doc.id
                if 'createdAt' in data and data['createdAt']:
                    data['createdAt'] = data['createdAt'].isoformat() if hasattr(data['createdAt'], 'isoformat') else str(data['createdAt'])
                emails.append(data)
            
            return emails
        except Exception as e:
            logger.error(f"Error getting emails for creator {creator_id}: {e}")
            return []
    
    def email_exists(self, email, creator_id):
        """Vérifie si un email existe déjà pour ce créateur"""
        try:
            docs = self.db.collection('collected_emails').where(
                'email', '==', email
            ).where('creatorId', '==', creator_id).limit(1).get()
            return len(list(docs)) > 0
        except Exception as e:
            logger.error(f"Error checking email existence: {e}")
            return False
    
    # ==================== SALES ====================
    
    def save_sale(self, sale_data):
        """Sauvegarde une vente"""
        try:
            sale_data['createdAt'] = firestore.SERVER_TIMESTAMP
            doc_ref = self.db.collection('sales').add(sale_data)
            logger.info(f"✅ Sale saved: {doc_ref[1].id}")
            return doc_ref[1].id
        except Exception as e:
            logger.error(f"Error saving sale: {e}")
            return None
    
    # ==================== TELEGRAM ====================
    
    def get_telegram_connection(self, page_id):
        """Récupère la connexion Telegram d'une page"""
        try:
            doc = self.db.collection('telegram_connections').document(page_id).get()
            if doc.exists:
                return doc.to_dict()
            return None
        except Exception as e:
            logger.error(f"Error getting telegram connection: {e}")
            return None
    
    def save_telegram_connection(self, page_id, connection_data):
        """Sauvegarde une connexion Telegram"""
        try:
            connection_data['updatedAt'] = firestore.SERVER_TIMESTAMP
            self.db.collection('telegram_connections').document(page_id).set(connection_data, merge=True)
            return True
        except Exception as e:
            logger.error(f"Error saving telegram connection: {e}")
            return False


# Instance globale du service
firebase_service = FirebaseService()
