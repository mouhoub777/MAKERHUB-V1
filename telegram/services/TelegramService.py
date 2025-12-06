# telegram/services/TelegramService.py
"""
Service Telegram pour MAKERHUB V1
Gestion des canaux, membres et invitations
"""

import os
import logging
from datetime import datetime, timedelta

logger = logging.getLogger(__name__)


class TelegramService:
    """Service pour gérer les interactions Telegram"""
    
    def __init__(self):
        self.bot_token = os.getenv('TELEGRAM_TOKEN')
        self.bot_username = os.getenv('BOT_USERNAME', '@Makerhubsub_bot')
        self.api_id = os.getenv('TELEGRAM_API_ID')
        self.api_hash = os.getenv('TELEGRAM_API_HASH')
        self._bot = None
    
    def _get_bot(self):
        """Lazy loading du bot Telegram"""
        if not self._bot and self.bot_token:
            try:
                from telegram import Bot
                self._bot = Bot(token=self.bot_token)
            except Exception as e:
                logger.error(f"Failed to initialize bot: {e}")
        return self._bot
    
    # ==================== HEALTH CHECK ====================
    
    def check_bot_sync(self):
        """Vérifie la connexion au bot (synchrone)"""
        try:
            if not self.bot_token:
                return {'status': 'error', 'message': 'No bot token configured'}
            
            return {
                'status': 'ok',
                'service': 'telegram',
                'bot_username': self.bot_username,
                'configured': True
            }
        except Exception as e:
            logger.error(f"Bot check error: {e}")
            return {'status': 'error', 'message': str(e)}
    
    # ==================== INVITE LINKS ====================
    
    def create_invite_link_sync(self, channel_id, expire_hours=24, member_limit=1):
        """Crée un lien d'invitation (synchrone)"""
        try:
            import asyncio
            return asyncio.run(self._create_invite_link_async(channel_id, expire_hours, member_limit))
        except Exception as e:
            logger.error(f"Create invite link error: {e}")
            return {'error': str(e)}
    
    async def _create_invite_link_async(self, channel_id, expire_hours=24, member_limit=1):
        """Crée un lien d'invitation (async)"""
        try:
            from telegram import Bot
            
            bot = Bot(token=self.bot_token)
            expire_date = datetime.now() + timedelta(hours=expire_hours)
            
            invite_link = await bot.create_chat_invite_link(
                chat_id=channel_id,
                expire_date=expire_date,
                member_limit=member_limit
            )
            
            logger.info(f"✅ Invite link created for channel {channel_id}")
            
            return {
                'success': True,
                'invite_link': invite_link.invite_link,
                'expire_date': expire_date.isoformat()
            }
            
        except Exception as e:
            logger.error(f"Create invite link async error: {e}")
            return {'error': str(e)}
    
    # ==================== MEMBER MANAGEMENT ====================
    
    def add_member_to_channel_sync(self, page_id, telegram_user_id, email=''):
        """Ajoute un membre au canal après paiement (synchrone)"""
        try:
            import asyncio
            return asyncio.run(self._add_member_async(page_id, telegram_user_id, email))
        except Exception as e:
            logger.error(f"Add member sync error: {e}")
            return {'error': str(e)}
    
    async def _add_member_async(self, page_id, telegram_user_id, email=''):
        """Ajoute un membre au canal (async)"""
        try:
            from telegram import Bot
            from services.FirebaseService import firebase_service
            
            # Récupérer la page pour avoir le channel_id
            page = firebase_service.get_landing_page(page_id)
            if not page:
                raise ValueError(f"Page not found: {page_id}")
            
            channel_id = page.get('telegramChannelId') or page.get('telegram', {}).get('channelId')
            if not channel_id:
                raise ValueError("No Telegram channel connected to this page")
            
            bot = Bot(token=self.bot_token)
            
            # Créer lien d'invitation
            expire_date = datetime.now() + timedelta(hours=24)
            invite_link = await bot.create_chat_invite_link(
                chat_id=channel_id,
                expire_date=expire_date,
                member_limit=1
            )
            
            # Envoyer le lien à l'utilisateur
            try:
                await bot.send_message(
                    chat_id=int(telegram_user_id),
                    text=(
                        "🎉 **Paiement confirmé !**\n\n"
                        f"Voici votre lien d'accès au canal (valable 24h):\n"
                        f"{invite_link.invite_link}\n\n"
                        "⚠️ Ce lien est à usage unique."
                    ),
                    parse_mode='Markdown'
                )
                logger.info(f"✅ Invite link sent to user {telegram_user_id}")
            except Exception as send_error:
                logger.error(f"Failed to send message to user: {send_error}")
            
            return {
                'success': True,
                'invite_link': invite_link.invite_link,
                'telegram_user_id': telegram_user_id,
                'channel_id': channel_id
            }
            
        except Exception as e:
            logger.error(f"Add member async error: {e}")
            return {'error': str(e)}
    
    def remove_member_from_channel_sync(self, page_id, telegram_user_id):
        """Retire un membre du canal (synchrone)"""
        try:
            import asyncio
            return asyncio.run(self._remove_member_async(page_id, telegram_user_id))
        except Exception as e:
            logger.error(f"Remove member sync error: {e}")
            return {'error': str(e)}
    
    async def _remove_member_async(self, page_id, telegram_user_id):
        """Retire un membre du canal via Telethon (async)"""
        try:
            from services.FirebaseService import firebase_service
            from telethon import TelegramClient
            
            # Récupérer la page
            page = firebase_service.get_landing_page(page_id)
            if not page:
                raise ValueError(f"Page not found: {page_id}")
            
            channel_id = page.get('telegramChannelId') or page.get('telegram', {}).get('channelId')
            if not channel_id:
                raise ValueError("No Telegram channel connected")
            
            # Utiliser Telethon pour exclure (nécessite userbot)
            if not self.api_id or not self.api_hash:
                raise ValueError("Telethon credentials not configured")
            
            async with TelegramClient('userbot_session', int(self.api_id), self.api_hash) as client:
                await client.start(phone=os.getenv('PHONE_NUMBER'))
                await client.kick_participant(channel_id, int(telegram_user_id))
                
            logger.info(f"✅ User {telegram_user_id} removed from channel {channel_id}")
            
            return {
                'success': True,
                'telegram_user_id': telegram_user_id,
                'channel_id': channel_id
            }
            
        except Exception as e:
            logger.error(f"Remove member async error: {e}")
            return {'error': str(e)}
    
    # ==================== CHANNEL INFO ====================
    
    def get_channel_info_sync(self, channel_id):
        """Récupère les infos d'un canal (synchrone)"""
        try:
            import asyncio
            return asyncio.run(self._get_channel_info_async(channel_id))
        except Exception as e:
            logger.error(f"Get channel info error: {e}")
            return None
    
    async def _get_channel_info_async(self, channel_id):
        """Récupère les infos d'un canal (async)"""
        try:
            from telegram import Bot
            
            bot = Bot(token=self.bot_token)
            chat = await bot.get_chat(chat_id=channel_id)
            
            return {
                'id': chat.id,
                'title': chat.title,
                'username': chat.username,
                'type': chat.type,
                'member_count': getattr(chat, 'member_count', None)
            }
            
        except Exception as e:
            logger.error(f"Get channel info async error: {e}")
            return None


# Instance globale du service
telegram_service = TelegramService()