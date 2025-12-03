# telegram/bots/main_bot.py - Bot Telegram Principal MAKERHUB V1
import os
import logging
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import (
    Application,
    CommandHandler,
    MessageHandler,
    CallbackQueryHandler,
    filters,
    ContextTypes
)
from services.FirebaseService import firebase_service

# Configuration du logging
logging.basicConfig(
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    level=logging.INFO
)
logger = logging.getLogger(__name__)

# ==================== HANDLERS ====================

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler pour la commande /start"""
    user = update.effective_user
    
    # Message de bienvenue
    welcome_text = f"""
👋 Hello {user.first_name}!

Welcome to *MAKERHUB Bot*! 🚀

I help creators monetize their Telegram channels with:
• 💳 Secure payments via Stripe
• 🔗 Automatic access after payment
• 📊 Sales tracking

*For Creators:*
Visit [makerhub.pro](https://makerhub.pro) to create your landing page.

*For Buyers:*
If you made a purchase, your access link will be sent here automatically.

Need help? Use /help
"""
    
    keyboard = [
        [InlineKeyboardButton("🌐 Visit MAKERHUB", url="https://makerhub.pro")],
        [InlineKeyboardButton("📚 Help", callback_data="help")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        welcome_text,
        parse_mode='Markdown',
        reply_markup=reply_markup,
        disable_web_page_preview=True
    )
    
    logger.info(f"User {user.id} started the bot")

async def help_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler pour la commande /help"""
    help_text = """
📚 *MAKERHUB Bot Help*

*Commands:*
/start - Start the bot
/help - Show this help message
/status - Check your subscription status
/support - Contact support

*How it works:*
1. A creator sets up a landing page on MAKERHUB
2. You make a payment on their page
3. You receive an invite link here automatically
4. Click the link to join the channel!

*Issues with access?*
Contact the channel creator directly or use /support.

_Powered by MAKERHUB_
"""
    
    await update.message.reply_text(help_text, parse_mode='Markdown')

async def status_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler pour la commande /status"""
    user = update.effective_user
    
    # Rechercher les abonnements actifs
    # Note: Implémentation simplifiée, à améliorer selon les besoins
    
    status_text = f"""
📊 *Your Status*

Telegram ID: `{user.id}`
Username: @{user.username or 'Not set'}

To check your subscriptions, visit the channel you subscribed to.

_If you have issues accessing a channel after payment, contact the creator._
"""
    
    await update.message.reply_text(status_text, parse_mode='Markdown')

async def support_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler pour la commande /support"""
    support_text = """
🆘 *Support*

For issues with:

*Payment problems:*
Contact the channel creator directly.

*Technical issues:*
Email: support@makerhub.pro

*Report abuse:*
Email: abuse@makerhub.pro

Please include your Telegram ID and details about the issue.
"""
    
    keyboard = [
        [InlineKeyboardButton("📧 Email Support", url="mailto:support@makerhub.pro")]
    ]
    reply_markup = InlineKeyboardMarkup(keyboard)
    
    await update.message.reply_text(
        support_text,
        parse_mode='Markdown',
        reply_markup=reply_markup
    )

async def callback_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler pour les callbacks des boutons"""
    query = update.callback_query
    await query.answer()
    
    if query.data == "help":
        help_text = """
📚 *MAKERHUB Bot Help*

*Commands:*
/start - Start the bot
/help - Show this help
/status - Check status
/support - Get support

_Powered by MAKERHUB_
"""
        await query.edit_message_text(help_text, parse_mode='Markdown')

async def unknown_command(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler pour les commandes inconnues"""
    await update.message.reply_text(
        "❓ Unknown command. Use /help to see available commands."
    )

async def message_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler pour les messages texte"""
    # Par défaut, rediriger vers /help
    await update.message.reply_text(
        "👋 Hi! I'm the MAKERHUB bot.\n\nUse /start to begin or /help for assistance."
    )

# ==================== ERROR HANDLER ====================

async def error_handler(update: Update, context: ContextTypes.DEFAULT_TYPE):
    """Handler pour les erreurs"""
    logger.error(f"Update {update} caused error {context.error}")
    
    if update and update.effective_message:
        await update.effective_message.reply_text(
            "❌ An error occurred. Please try again later."
        )

# ==================== MAIN ====================

def create_application():
    """Créer l'application bot"""
    token = os.getenv('TELEGRAM_TOKEN')
    
    if not token:
        raise ValueError("TELEGRAM_TOKEN environment variable is required")
    
    # Créer l'application
    application = Application.builder().token(token).build()
    
    # Ajouter les handlers
    application.add_handler(CommandHandler("start", start))
    application.add_handler(CommandHandler("help", help_command))
    application.add_handler(CommandHandler("status", status_command))
    application.add_handler(CommandHandler("support", support_command))
    
    # Callback handler
    application.add_handler(CallbackQueryHandler(callback_handler))
    
    # Message handler
    application.add_handler(MessageHandler(filters.TEXT & ~filters.COMMAND, message_handler))
    
    # Unknown command handler
    application.add_handler(MessageHandler(filters.COMMAND, unknown_command))
    
    # Error handler
    application.add_error_handler(error_handler)
    
    return application

def run_bot():
    """Démarrer le bot en mode polling"""
    print("🤖 Starting MAKERHUB Bot...")
    
    application = create_application()
    
    # Démarrer le polling
    application.run_polling(allowed_updates=Update.ALL_TYPES)

if __name__ == '__main__':
    run_bot()
