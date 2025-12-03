# Auth email sync simplifié pour MAKERHUB
import logging

logger = logging.getLogger(__name__)

class MakerHubAuthEmailSync:
    def __init__(self):
        self.db = None
        logger.info("Auth email sync initialisé (mode simplifié)")
    
    def sync_email_to_firestore(self, email, profile_name='', auth_token=None, uid=None):
        """Synchronise un email avec Firestore"""
        logger.info(f"[SYNC] Email: {email}, Profile: {profile_name}")
        return True
    
    def get_user_by_email(self, email):
        """Récupère un utilisateur par email"""
        return None

# Instance globale
auth_email_sync = MakerHubAuthEmailSync()