import os
import stripe
from flask import Flask, request
from telegram import Bot
from dotenv import load_dotenv
import datetime
import firebase_admin
from firebase_admin import credentials, firestore
from telethon.sync import TelegramClient

# Charger les variables d'environnement
load_dotenv()

# --- Configuration ---
app = Flask(__name__)
TELEGRAM_TOKEN = os.getenv("TELEGRAM_TOKEN")
STRIPE_SECRET_KEY = os.getenv("STRIPE_SECRET_KEY")
STRIPE_WEBHOOK_SECRET = os.getenv("STRIPE_WEBHOOK_SECRET")
TELETHON_API_ID = int(os.getenv("TELEGRAM_API_ID"))
TELETHON_API_HASH = os.getenv("TELEGRAM_API_HASH")
PHONE_NUMBER = os.getenv("PHONE_NUMBER")
bot = Bot(token=TELEGRAM_TOKEN)
stripe.api_key = STRIPE_SECRET_KEY

# --- Initialiser Firebase ---
if not firebase_admin._apps:
    cred = credentials.Certificate("firebase-service-account.json")
    firebase_admin.initialize_app(cred)
db = firestore.client()

@app.route("/webhook", methods=["POST"])
def webhook_received():
    payload = request.data
    sig_header = request.headers.get("stripe-signature", None)

    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, STRIPE_WEBHOOK_SECRET
        )
    except stripe.error.SignatureVerificationError as e:
        print("❌ Signature Stripe invalide :", e)
        return "Signature Stripe invalide", 400
    except Exception as e:
        print("❌ Erreur lors du traitement du webhook :", e)
        return "Erreur webhook", 400

    print(f"✅ Event type: {event['type']} reçu et validé")

    if event["type"] == "checkout.session.completed":
        session = event["data"]["object"]
        telegram_user_id = session["metadata"].get("telegram_user_id")
        creator_id = session["metadata"].get("creator_id")

        print(f"✅ Paiement reçu - Telegram ID: {telegram_user_id} | Creator ID: {creator_id}")

        if not telegram_user_id or not creator_id:
            print("❌ Metadata manquante.")
            return "", 400

        # 1. Récupérer le canal du créateur
        doc = db.collection("creators").document(creator_id).get()
        if not doc.exists:
            print("❌ Creator introuvable en BDD.")
            return "", 400

        channel_id = doc.to_dict().get("channel_id")
        if not channel_id:
            print("❌ Creator sans channel_id.")
            return "", 400

        # 2. Générer le lien d'invitation unique (valable 24h, 1 usage)
        try:
            invite_link = bot.create_chat_invite_link(
                chat_id=channel_id,
                expire_date=datetime.datetime.now() + datetime.timedelta(hours=24),
                member_limit=1
            )
            # 3. Envoyer le lien d'accès
            try:
                bot.send_message(
                    chat_id=int(telegram_user_id),
                    text=(
                        "✅ Merci pour ton paiement !\n"
                        f"Voici ton lien d'accès (valable 24h, usage unique) :\n\n{invite_link.invite_link}\n\n"
                        "👉 Si tu ne reçois pas le lien, clique sur [ce lien](https://t.me/AccesvipFP_bot) puis appuie sur Démarrer dans Telegram, et contacte le support."
                    ),
                    parse_mode="Markdown"
                )
                print("🔗 Lien envoyé :", invite_link.invite_link)
            except Exception as err:
                print("❌ Erreur lors de l’envoi du lien :", err)
                # Ici tu peux prévoir d'afficher l'info sur ta page de succès (voir plus bas)
                # Par exemple : sauvegarde invite_link pour lui redonner sur la page ou sur demande

        except Exception as err:
            print("❌ Erreur lors de la génération du lien :", err)
            return "", 200

    elif event["type"] in ("customer.subscription.deleted", "invoice.payment_failed"):
        data = event["data"]["object"]
        telegram_user_id = None
        creator_id = None

        if "metadata" in data:
            telegram_user_id = data["metadata"].get("telegram_user_id")
            creator_id = data["metadata"].get("creator_id")

        print(f"⛔ Désabonnement détecté - Telegram ID: {telegram_user_id} | Creator ID: {creator_id}")

        if not telegram_user_id or not creator_id:
            print("❌ Metadata manquante pour désabonnement.")
            return "", 200

        doc = db.collection("creators").document(creator_id).get()
        if not doc.exists:
            print("❌ Creator introuvable en BDD pour désabonnement.")
            return "", 200

        channel_id = doc.to_dict().get("channel_id")
        if not channel_id:
            print("❌ Creator sans channel_id pour désabonnement.")
            return "", 200

        # Retirer le membre avec userbot Telethon (admin obligatoire)
        try:
            with TelegramClient("userbot_session", TELETHON_API_ID, TELETHON_API_HASH) as client:
                client.start(phone=PHONE_NUMBER)
                client.kick_participant(channel_id, int(telegram_user_id))
                print(f"✅ Utilisateur {telegram_user_id} retiré du canal {channel_id}")
        except Exception as err:
            print(f"❌ Erreur lors du retrait du membre : {err}")

    return "", 200

if __name__ == "__main__":
    app.run(port=4242)
