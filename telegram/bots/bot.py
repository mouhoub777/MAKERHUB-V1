import os
import logging
from dotenv import load_dotenv
from telegram import Update, InlineKeyboardButton, InlineKeyboardMarkup
from telegram.ext import ApplicationBuilder, CommandHandler, CallbackQueryHandler, ContextTypes
import stripe

# Firestore
import firebase_admin
from firebase_admin import credentials, firestore

# Chargement .env
load_dotenv()
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
DOMAIN = os.getenv("DOMAIN")

stripe.api_key = STRIPE_SECRET_KEY

logging.basicConfig(level=logging.INFO)

# Init Firebase Admin
if not firebase_admin._apps:
    cred = credentials.Certificate("firebase-service-account.json")
    firebase_admin.initialize_app(cred)
db = firestore.client()

async def start(update: Update, context: ContextTypes.DEFAULT_TYPE):
    creators = db.collection("creators").stream()
    keyboard = []
    for creator in creators:
        data = creator.to_dict()
        brand = data.get("creator_name", "Sans nom")  # Correction ici
        creator_id = data.get("stripe_account_id")
        price_id = data.get("price_id")
        if creator_id and price_id:
            # Le callback_data encode les deux infos
            keyboard.append([InlineKeyboardButton(
                f"💳 S’abonner à {brand}",
                callback_data=f"buy|{creator_id}|{price_id}"
            )])
    if not keyboard:
        await update.message.reply_text("Aucun créateur disponible pour le moment.")
        return
    reply_markup = InlineKeyboardMarkup(keyboard)
    await update.message.reply_text("Choisis un créateur :", reply_markup=reply_markup)

async def handle_button(update: Update, context: ContextTypes.DEFAULT_TYPE):
    query = update.callback_query
    await query.answer()
    user = query.from_user

    if query.data.startswith("buy|"):
        _, creator_id, price_id = query.data.split("|")
        abonnement_type = "custom"
        mode = "subscription"

        try:
            checkout_session = stripe.checkout.Session.create(
                success_url=DOMAIN + "/success?session_id={CHECKOUT_SESSION_ID}",
                cancel_url=DOMAIN + "/cancel",
                payment_method_types=["card"],
                mode=mode,
                line_items=[{"price": price_id, "quantity": 1}],
                metadata={
                    "telegram_user_id": str(user.id),
                    "abonnement_type": abonnement_type,
                    "creator_id": creator_id,
                },
            )
            await query.edit_message_text(f"✅ Clique ici pour payer : {checkout_session.url}")
        except Exception as e:
            await query.edit_message_text(f"❌ Erreur Stripe : {e}")
            print("Stripe ERROR:", e)
    else:
        await query.edit_message_text("❌ Option invalide.")

if __name__ == "__main__":
    print("=== BOT EN LIGNE SUBLAUNCH LIKE ===")
    app = ApplicationBuilder().token(TELEGRAM_TOKEN).build()
    app.add_handler(CommandHandler("start", start))
    app.add_handler(CallbackQueryHandler(handle_button))
    app.run_polling()
