# telegram_bot_worker.py - Bot Python pour écouter et traiter les messages
import asyncio
import logging
import os
import json
import aiohttp
from datetime import datetime
from typing import Dict, List, Optional
from telethon import TelegramClient, events
from telethon.tl.types import Channel, Chat
from firebase_admin import firestore
from config.database import db, COLLECTIONS

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class TelegramTranslatorBot:
    def __init__(self):
        """Initialise le bot traducteur Telegram"""
        self.api_id = os.getenv('TELEGRAM_API_ID')
        self.api_hash = os.getenv('TELEGRAM_API_HASH')
        self.phone = os.getenv('TELEGRAM_PHONE')
        self.session_name = os.getenv('TELEGRAM_SESSION', 'translator_bot')
        
        # Configuration API backend
        self.backend_url = os.getenv('BACKEND_URL', 'http://localhost:3000')
        self.api_key = os.getenv('API_KEY', '')
        
        # Configuration Firebase
        # Firebase est initialisé via config.database
        
        # Clients
        self.client = None
        self.db = None
        self.active_configs = {}
        self.monitored_channels = set()
        
        # Statistiques
        self.stats = {
            'messages_processed': 0,
            'translations_sent': 0,
            'errors': 0,
            'start_time': datetime.now()
        }
    
    async def initialize(self):
        """Initialise toutes les connexions"""
        try:
            # Connexion Firebase
            self.db = db()
            logger.info("✅ Firebase connecté")
            
            # Connexion Telegram
            self.client = TelegramClient(
                self.session_name,
                self.api_id,
                self.api_hash
            )
            
            await self.client.start(phone=self.phone)
            logger.info("✅ Client Telegram connecté")
            
            # Charger les configurations actives
            await self.load_active_configurations()
            
            # Configurer les handlers d'événements
            self.setup_event_handlers()
            
            logger.info(f"🤖 Bot initialisé avec {len(self.active_configs)} configurations")
            
        except Exception as e:
            logger.error(f"❌ Erreur initialisation: {e}")
            raise
    
    async def load_active_configurations(self):
        """Charge toutes les configurations actives depuis Firebase"""
        try:
            configs_ref = self.db.collection(COLLECTIONS['TRANSLATION_CONFIGS'])
            query = configs_ref.where('status', '==', 'active')
            configs = query.stream()
            
            for doc in configs:
                config = doc.to_dict()
                config_id = doc.id
                
                # Extraire les informations nécessaires
                source_username = config['sourceChannelUsername']
                target_languages = config['targetLanguages']
                settings = config.get('settings', {})
                
                self.active_configs[config_id] = {
                    'source_username': source_username,
                    'target_languages': target_languages,
                    'settings': settings,
                    'user_id': config['userId'],
                    'config': config
                }
                
                # Ajouter à la liste des canaux surveillés
                self.monitored_channels.add(source_username)
            
            logger.info(f"📋 {len(self.active_configs)} configurations chargées")
            
        except Exception as e:
            logger.error(f"❌ Erreur chargement configurations: {e}")
    
    def setup_event_handlers(self):
        """Configure les handlers pour les événements Telegram"""
        
        @self.client.on(events.NewMessage())
        async def handle_new_message(event):
            await self.process_new_message(event)
        
        @self.client.on(events.MessageEdited())
        async def handle_edited_message(event):
            # Optionnel: traiter les messages édités
            logger.debug(f"Message édité dans {event.chat_id}")
    
    async def process_new_message(self, event):
        """Traite un nouveau message reçu"""
        try:
            # Vérifier si le message vient d'un canal surveillé
            chat = await event.get_chat()
            
            if not isinstance(chat, Channel):
                return  # Ignorer les messages non-canal
            
            username = getattr(chat, 'username', None)
            if not username or username not in self.monitored_channels:
                return  # Canal non surveillé
            
            logger.info(f"📨 Nouveau message dans @{username}")
            
            # Trouver la configuration correspondante
            config_data = None
            for config_id, config in self.active_configs.items():
                if config['source_username'] == username:
                    config_data = config
                    break
            
            if not config_data:
                logger.warning(f"⚠️ Aucune configuration trouvée pour @{username}")
                return
            
            # Traiter et traduire le message
            await self.translate_and_forward_message(event, config_data)
            
            # Mettre à jour les statistiques
            self.stats['messages_processed'] += 1
            await self.update_config_statistics(config_id)
            
        except Exception as e:
            logger.error(f"❌ Erreur traitement message: {e}")
            self.stats['errors'] += 1
    
    async def translate_and_forward_message(self, event, config_data):
        """Traduit et transmet un message vers les canaux cibles"""
        try:
            message = event.message
            settings = config_data['settings']
            
            # Préparer les données du message
            message_data = {
                'text': message.text,
                'media': None,
                'caption': None,
                'message_id': message.id,
                'date': message.date.isoformat(),
                'chat_id': message.chat_id
            }
            
            # Gérer les médias
            if message.media:
                if message.photo:
                    message_data['media'] = {
                        'type': 'photo',
                        'file_id': message.photo.id
                    }
                elif message.video:
                    message_data['media'] = {
                        'type': 'video',
                        'file_id': message.video.id
                    }
                elif message.document:
                    message_data['media'] = {
                        'type': 'document',
                        'file_id': message.document.id
                    }
                
                # Légende du média
                if message.text:
                    message_data['caption'] = message.text
            
            # Traduire pour chaque langue cible
            for target_lang in config_data['target_languages']:
                if not target_lang.get('isActive', True):
                    continue
                
                try:
                    await self.send_translated_message(
                        message_data,
                        target_lang,
                        settings
                    )
                    
                    # Délai entre les envois
                    delay = settings.get('delayBetweenMessages', 2000) / 1000
                    await asyncio.sleep(delay)
                    
                    self.stats['translations_sent'] += 1
                    
                except Exception as e:
                    logger.error(f"❌ Erreur envoi vers {target_lang['code']}: {e}")
                    self.stats['errors'] += 1
        
        except Exception as e:
            logger.error(f"❌ Erreur traduction/transmission: {e}")
            self.stats['errors'] += 1
    
    async def send_translated_message(self, message_data, target_lang, settings):
        """Envoie un message traduit vers un canal cible"""
        try:
            # Appeler l'API backend pour la traduction et l'envoi
            async with aiohttp.ClientSession() as session:
                payload = {
                    'message_data': message_data,
                    'target_language': target_lang,
                    'settings': settings
                }
                
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {self.api_key}' if self.api_key else ''
                }
                
                async with session.post(
                    f'{self.backend_url}/api/webhook/translate-and-send',
                    json=payload,
                    headers=headers
                ) as response:
                    
                    if response.status == 200:
                        result = await response.json()
                        logger.info(f"✅ Message envoyé vers {target_lang['code']}")
                        return result
                    else:
                        error_text = await response.text()
                        logger.error(f"❌ Erreur API: {response.status} - {error_text}")
                        raise Exception(f"Erreur API: {response.status}")
        
        except Exception as e:
            logger.error(f"❌ Erreur envoi message traduit: {e}")
            raise
    
    async def update_config_statistics(self, config_id):
        """Met à jour les statistiques d'une configuration"""
        try:
            config_ref = self.db.collection(COLLECTIONS['TRANSLATION_CONFIGS']).document(config_id)
            config_doc = config_ref.get()
            if config_doc.exists:
                stats = config_doc.to_dict().get('statistics', {})
                stats['totalMessages'] = stats.get('totalMessages', 0) + 1
                stats['translatedToday'] = stats.get('translatedToday', 0) + 1
                stats['lastActivity'] = datetime.now()
                config_ref.update({'statistics': stats})
        except Exception as e:
            logger.error(f"❌ Erreur mise à jour statistiques: {e}")
    
    async def reload_configurations(self):
        """Recharge les configurations depuis la base de données"""
        try:
            logger.info("🔄 Rechargement des configurations...")
            
            self.active_configs.clear()
            self.monitored_channels.clear()
            
            await self.load_active_configurations()
            
            logger.info(f"✅ Configurations rechargées: {len(self.active_configs)} actives")
            
        except Exception as e:
            logger.error(f"❌ Erreur rechargement configurations: {e}")
    
    async def monitor_channel_access(self):
        """Vérifie périodiquement l'accès aux canaux surveillés"""
        while True:
            try:
                logger.info("🔍 Vérification accès aux canaux...")
                
                for username in list(self.monitored_channels):
                    try:
                        entity = await self.client.get_entity(f"@{username}")
                        if isinstance(entity, Channel):
                            logger.debug(f"✅ Accès OK pour @{username}")
                        else:
                            logger.warning(f"⚠️ @{username} n'est pas un canal")
                    
                    except Exception as e:
                        logger.error(f"❌ Accès perdu pour @{username}: {e}")
                        await self.handle_channel_access_error(username, str(e))
                
                # Attendre 1 heure avant la prochaine vérification
                await asyncio.sleep(3600)
                
            except Exception as e:
                logger.error(f"❌ Erreur monitoring canaux: {e}")
                await asyncio.sleep(300)  # Réessayer dans 5 minutes
    
    async def handle_channel_access_error(self, username, error_message):
        """Gère les erreurs d'accès aux canaux"""
        try:
            # Marquer les configurations concernées comme en erreur
            configs_ref = self.db.collection(COLLECTIONS['TRANSLATION_CONFIGS'])
            query = configs_ref.where('sourceChannelUsername', '==', username).where('status', '==', 'active')
            docs = query.stream()
            
            for doc in docs:
                stats = doc.to_dict().get('statistics', {})
                stats['lastError'] = {
                    'message': f"Accès perdu: {error_message}",
                    'timestamp': datetime.now()
                }
                stats['errorCount'] = stats.get('errorCount', 0) + 1
                doc.reference.update({
                    'status': 'error',
                    'statistics': stats
                }
            )
            
            logger.warning(f"⚠️ Configurations @{username} marquées en erreur")
            
        except Exception as e:
            logger.error(f"❌ Erreur gestion erreur canal: {e}")
    
    async def send_health_report(self):
        """Envoie un rapport de santé périodique"""
        while True:
            try:
                await asyncio.sleep(3600)  # Toutes les heures
                
                uptime = datetime.now() - self.stats['start_time']
                
                report = {
                    'timestamp': datetime.now().isoformat(),
                    'uptime_hours': uptime.total_seconds() / 3600,
                    'active_configs': len(self.active_configs),
                    'monitored_channels': len(self.monitored_channels),
                    'messages_processed': self.stats['messages_processed'],
                    'translations_sent': self.stats['translations_sent'],
                    'errors': self.stats['errors'],
                    'success_rate': (
                        (self.stats['translations_sent'] / max(self.stats['messages_processed'], 1)) * 100
                        if self.stats['messages_processed'] > 0 else 0
                    )
                }
                
                logger.info(f"📊 Rapport: {report['messages_processed']} messages, "
                           f"{report['translations_sent']} traductions, "
                           f"{report['success_rate']:.1f}% succès")
                
                # Envoyer le rapport au backend si configuré
                if self.backend_url:
                    await self.send_health_to_backend(report)
                
            except Exception as e:
                logger.error(f"❌ Erreur rapport santé: {e}")
    
    async def send_health_to_backend(self, report):
        """Envoie le rapport de santé au backend"""
        try:
            async with aiohttp.ClientSession() as session:
                headers = {
                    'Content-Type': 'application/json',
                    'Authorization': f'Bearer {self.api_key}' if self.api_key else ''
                }
                
                async with session.post(
                    f'{self.backend_url}/api/webhook/health-report',
                    json=report,
                    headers=headers
                ) as response:
                    
                    if response.status == 200:
                        logger.debug("✅ Rapport santé envoyé")
                    else:
                        logger.warning(f"⚠️ Erreur envoi rapport: {response.status}")
        
        except Exception as e:
            logger.debug(f"Erreur envoi rapport santé: {e}")
    
    async def graceful_shutdown(self):
        """Arrêt gracieux du bot"""
        logger.info("🛑 Arrêt gracieux en cours...")
        
        try:
            if self.client:
                await self.client.disconnect()
                logger.info("✅ Client Telegram déconnecté")
        
        except Exception as e:
            logger.error(f"❌ Erreur déconnexion: {e}")
    
    async def run(self):
        """Lance le bot en mode surveillance continue"""
        try:
            await self.initialize()
            
            # Lancer les tâches de fond
            tasks = [
                asyncio.create_task(self.client.run_until_disconnected()),
                asyncio.create_task(self.monitor_channel_access()),
                asyncio.create_task(self.send_health_report()),
                asyncio.create_task(self.periodic_config_reload())
            ]
            
            logger.info("🚀 Bot démarré et en écoute...")
            
            # Attendre que toutes les tâches se terminent
            await asyncio.gather(*tasks)
            
        except KeyboardInterrupt:
            logger.info("🛑 Interruption clavier reçue")
        except Exception as e:
            logger.error(f"❌ Erreur fatale: {e}")
        finally:
            await self.graceful_shutdown()
    
    async def periodic_config_reload(self):
        """Recharge périodiquement les configurations"""
        while True:
            try:
                await asyncio.sleep(300)  # Toutes les 5 minutes
                await self.reload_configurations()
            except Exception as e:
                logger.error(f"❌ Erreur rechargement périodique: {e}")


# Classe pour la gestion des commandes
class BotCommandHandler:
    def __init__(self, bot_instance):
        self.bot = bot_instance
    
    async def handle_status_command(self):
        """Retourne le statut du bot"""
        uptime = datetime.now() - self.bot.stats['start_time']
        
        status = {
            'status': 'running',
            'uptime': str(uptime),
            'active_configs': len(self.bot.active_configs),
            'monitored_channels': list(self.bot.monitored_channels),
            'statistics': self.bot.stats
        }
        
        return status
    
    async def handle_reload_command(self):
        """Recharge les configurations"""
        await self.bot.reload_configurations()
        return {'message': 'Configurations rechargées avec succès'}
    
    async def handle_stop_command(self):
        """Arrête le bot proprement"""
        await self.bot.graceful_shutdown()
        return {'message': 'Bot arrêté'}


# Point d'entrée principal
async def main():
    """Point d'entrée principal du bot"""
    
    # Vérifier les variables d'environnement requises
    required_env_vars = [
        'TELEGRAM_API_ID',
        'TELEGRAM_API_HASH',
        'TELEGRAM_PHONE'
    ]
    
    missing_vars = [var for var in required_env_vars if not os.getenv(var)]
    if missing_vars:
        logger.error(f"❌ Variables d'environnement manquantes: {missing_vars}")
        return
    
    # Créer et lancer le bot
    bot = TelegramTranslatorBot()
    
    try:
        await bot.run()
    except KeyboardInterrupt:
        logger.info("🛑 Arrêt demandé par l'utilisateur")
    except Exception as e:
        logger.error(f"❌ Erreur fatale: {e}")
    finally:
        await bot.graceful_shutdown()


if __name__ == "__main__":
    # Configuration pour Windows
    if os.name == 'nt':
        asyncio.set_event_loop_policy(asyncio.WindowsProactorEventLoopPolicy())
    
    # Lancer le bot
    asyncio.run(main())