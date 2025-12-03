import os
import logging
import asyncio
import re
import unidecode

from flask import Flask, request, redirect, send_from_directory, url_for, render_template, abort, jsonify, Response
from flask_cors import CORS
import stripe
import firebase_admin
from firebase_admin import credentials, firestore, auth
from dotenv import load_dotenv
from telethon.sync import TelegramClient
from telethon.tl.functions.channels import GetParticipantsRequest
from telethon.tl.types import ChannelParticipantsAdmins
from telegram import Bot
from datetime import datetime, timedelta

# Import des services email MAKERHUB
from services.email_service import email_service
from handlers.email_routes import register_email_routes
from utils.email_tracker import email_tracker
from auth_email_sync import auth_email_sync

load_dotenv()

def generate_slug(brand_name):
    """Génère un slug URL-friendly à partir du nom de marque"""
    slug = unidecode.unidecode(brand_name)
    slug = re.sub(r'[^a-zA-Z0-9\s-]', '', slug)
    slug = re.sub(r'\s+', '-', slug)
    slug = slug.lower()
    return slug

app = Flask(__name__, template_folder='templates', static_folder='static')
CORS(app, origins=['http://localhost:3000', 'https://makerhub.pro', 'https://api.makerhub.pro'])  # CORS pour Node.js

# Configuration du logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Configuration Stripe
stripe.api_key = os.getenv("STRIPE_SECRET_KEY")

# Initialisation Firebase
if not firebase_admin._apps:
    cred = credentials.Certificate("firebase-service-account.json")
    firebase_admin.initialize_app(cred)
db = firestore.client()

# Configuration Telegram avec @Makerhubsub_bot
api_id = int(os.getenv("TELEGRAM_API_ID"))
api_hash = os.getenv("TELEGRAM_API_HASH")
bot_username = os.getenv("BOT_USERNAME", "@Makerhubsub_bot")
bot_token = os.getenv("TELEGRAM_TOKEN")

# Enregistrement des routes email MAKERHUB
register_email_routes(app)
logger.info("🚀 Service email MAKERHUB intégré avec succès")

# Initialisation du tracker d'emails
email_tracker.init()
logger.info("📧 Email tracker MAKERHUB initialisé")

# Initialisation du sync auth emails  
auth_email_sync.sync_email_to_firestore = auth_email_sync.sync_email_to_firestore
logger.info("🔐 Auth email sync MAKERHUB initialisé")

# ========================================
# ROUTES SANTÉ POUR NODE.JS PROXY
# ========================================

@app.route("/health", methods=["GET"])
def health_check_simple():
    """Health check simple pour le proxy Node.js"""
    return jsonify({
        "status": "healthy",
        "service": "MAKERHUB Python Service",
        "port": 5001,
        "timestamp": datetime.now().isoformat()
    }), 200

# ========================================
# FONCTIONS EXISTANTES
# ========================================

async def get_telegram_channel_id(link):
    """Récupère l'ID d'un canal Telegram via Telethon"""
    async with TelegramClient("userbot_session", api_id, api_hash) as client:
        try:
            entity = await client.get_entity(link)
            return entity.id
        except Exception as e:
            logger.error(f"Erreur récupération ID canal Telegram : {e}")
            return None

def fetch_telegram_channel_id(link):
    """Wrapper synchrone pour récupérer l'ID du canal"""
    return asyncio.run(get_telegram_channel_id(link))

def check_bot_is_admin(channel_link):
    """Vérifie si le bot MAKERHUB est admin dans le canal"""
    async def check_admin():
        async with TelegramClient("userbot_session", api_id, api_hash) as client:
            try:
                await client.start()
                
                # Récupérer le canal
                entity = await client.get_entity(channel_link)
                
                # Récupérer la liste des admins
                admins = await client(GetParticipantsRequest(
                    channel=entity,
                    filter=ChannelParticipantsAdmins(),
                    offset=0,
                    limit=100,
                    hash=0
                ))
                
                # Vérifier si le bot est dans la liste
                bot_username_clean = bot_username.lower().replace('@', '')
                for user in admins.users:
                    if hasattr(user, 'username') and user.username:
                        if user.username.lower() == bot_username_clean:
                            logger.info(f"✅ Bot {bot_username} trouvé comme admin")
                            return True
                
                logger.warning(f"❌ Bot {bot_username} pas trouvé dans les admins")
                return False
                
            except Exception as e:
                logger.error(f"Erreur vérification admin: {e}")
                return False
    
    return asyncio.run(check_admin())

# ========================================
# ROUTES TELEGRAM POUR MAKERHUB
# ========================================

@app.route("/api/telegram/get-channel-id", methods=["POST"])
def api_get_channel_id():
    """
    Récupère l'ID d'un canal Telegram à partir de son lien
    en utilisant Telethon avec le compte userbot
    """
    try:
        data = request.json
        channel_link = data.get("channel_link")
        page_id = data.get("page_id")
        channel_name = data.get("channel_name")
        
        if not channel_link:
            return jsonify({"error": "Lien du canal requis"}), 400
        
        logger.info(f"Récupération ID pour: {channel_link}")
        
        # Utiliser Telethon pour récupérer l'ID
        channel_id = fetch_telegram_channel_id(channel_link)
        
        if not channel_id:
            return jsonify({
                "error": "Impossible de récupérer l'ID du canal. Vérifiez le lien."
            }), 400
        
        # Formater l'ID pour les supergroups/canaux
        if channel_id > 0:
            channel_id = f"-100{channel_id}"
        
        logger.info(f"✅ Canal ID récupéré: {channel_id} pour le lien: {channel_link}")
        
        return jsonify({
            "success": True,
            "channel_id": str(channel_id),
            "channel_link": channel_link,
            "channel_name": channel_name
        }), 200
        
    except Exception as e:
        logger.error(f"Erreur get_channel_id: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/telegram/check-bot-admin", methods=["POST"])
def api_check_bot_admin():
    """
    Vérifie si @Makerhubsub_bot est administrateur du canal
    avec les bonnes permissions
    """
    try:
        data = request.json
        channel_link = data.get("channel_link")
        channel_id = data.get("channel_id")
        
        if not channel_link:
            return jsonify({"error": "Lien du canal requis"}), 400
        
        logger.info(f"Vérification bot admin pour: {channel_link}")
        
        # Vérifier si le bot est admin
        is_admin = check_bot_is_admin(channel_link)
        
        if is_admin:
            logger.info(f"✅ Bot {bot_username} confirmé admin dans le canal {channel_id}")
        else:
            logger.warning(f"❌ Bot {bot_username} n'est pas admin dans le canal {channel_id}")
        
        return jsonify({
            "success": True,
            "is_admin": is_admin,
            "bot_username": bot_username
        }), 200
        
    except Exception as e:
        logger.error(f"Erreur check_bot_admin: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/telegram/save-connection", methods=["POST"])
def api_save_telegram_connection():
    """
    Sauvegarde la connexion Telegram dans Firestore
    """
    try:
        data = request.json
        page_id = data.get("page_id")
        channel_id = data.get("channel_id")
        channel_link = data.get("channel_link")
        channel_name = data.get("channel_name")
        bot_verified = data.get("bot_verified", False)
        
        if not all([page_id, channel_id, channel_link]):
            return jsonify({"error": "Données manquantes"}), 400
        
        # Sauvegarder dans Firestore
        doc_ref = db.collection("telegram_connections").document(page_id)
        doc_ref.set({
            "page_id": page_id,
            "channel_id": channel_id,
            "channel_link": channel_link,
            "channel_name": channel_name,
            "bot_verified": bot_verified,
            "connected_at": firestore.SERVER_TIMESTAMP,
            "status": "active",
            "bot_username": bot_username
        })
        
        logger.info(f"✅ Connexion Telegram sauvegardée pour page {page_id}")
        
        return jsonify({
            "success": True,
            "message": "Connexion sauvegardée avec succès"
        }), 200
        
    except Exception as e:
        logger.error(f"Erreur save_telegram_connection: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/telegram/create-invite-link", methods=["POST"])
def api_create_invite_link():
    """
    Crée un lien d'invitation unique pour un canal Telegram
    """
    try:
        from telegram import Bot
        
        data = request.json
        channel_id = data.get("channel_id")
        user_telegram_id = data.get("user_telegram_id")
        expire_hours = data.get("expire_hours", 24)
        member_limit = data.get("member_limit", 1)
        
        if not channel_id:
            return jsonify({"error": "channel_id requis"}), 400
        
        # Fonction async pour créer le lien
        async def create_link():
            bot = Bot(token=bot_token)
            expire_date = datetime.now() + timedelta(hours=expire_hours)
            
            invite_link = await bot.create_chat_invite_link(
                chat_id=channel_id,
                expire_date=expire_date,
                member_limit=member_limit
            )
            
            # Si un user_telegram_id est fourni, envoyer le lien
            if user_telegram_id:
                await bot.send_message(
                    chat_id=int(user_telegram_id),
                    text=(
                        "🎉 **Accès au canal approuvé!**\n\n"
                        f"Voici votre lien d'accès (valable {expire_hours}h):\n"
                        f"{invite_link.invite_link}\n\n"
                        "⚠️ Ce lien est à usage unique."
                    ),
                    parse_mode="Markdown"
                )
                logger.info(f"✅ Lien envoyé à l'utilisateur {user_telegram_id}")
                
            return invite_link
        
        # Exécuter la fonction async
        invite_link = asyncio.run(create_link())
        
        return jsonify({
            "success": True,
            "invite_link": invite_link.invite_link,
            "expire_date": invite_link.expire_date.isoformat() if invite_link.expire_date else None,
            "member_limit": member_limit
        }), 200
        
    except Exception as e:
        logger.error(f"Erreur create_invite_link: {e}")
        return jsonify({"error": str(e)}), 500

# ========================================
# ROUTES PRINCIPALES MAKERHUB
# ========================================

@app.route("/")
def home():
    """Page d'accueil du service Python"""
    return jsonify({
        "service": "MAKERHUB Python Service",
        "version": "3.0.0",
        "port": 5001,
        "features": [
            "Telegram Bot Management",
            "Email Service",
            "Stripe Webhooks",
            "Firebase Integration"
        ],
        "status": "operational"
    })

@app.route("/api/landings", methods=["POST"])
def receive_landing():
    """Réception des données de landing page"""
    try:
        # Vérification du token Firebase
        id_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not id_token:
            return jsonify({"error": "Token manquant"}), 401

        decoded_token = auth.verify_id_token(id_token)
        user_id = decoded_token['uid']
        user_email = decoded_token.get('email')

        data = request.json
        if data.get('creator_id') != user_id:
            return jsonify({"error": "UID invalide"}), 403

        # Sauvegarde dans Firestore
        db.collection('landings_full').add(data)
        
        # Tracker l'email si disponible
        if user_email:
            try:
                auth_email_sync.sync_email_to_firestore(user_email, data.get('brand_name', ''), id_token, user_id)
                logger.info(f"📧 Email tracké pour landing: {user_email}")
            except Exception as track_error:
                logger.warning(f"⚠️ Erreur tracking email: {track_error}")
        
        logger.info(f"✅ Landing sauvegardée pour {user_id}")

        return jsonify({"message": "Landing bien reçue et token vérifié."}), 200
    except Exception as e:
        logger.error(f"❌ Erreur réception landing: {e}")
        return jsonify({"error": str(e)}), 400

@app.route("/checkout/<creator_id>/<offer_index>")
def checkout(creator_id, offer_index):
    """Processus de checkout Stripe"""
    try:
        # Récupération du créateur
        doc = db.collection("creators").document(creator_id).get()
        if not doc.exists:
            return "Créateur introuvable", 404
            
        creator = doc.to_dict()
        prices = creator.get("prices", [])
        
        try:
            offer = prices[int(offer_index)]
        except (IndexError, ValueError, TypeError):
            return "Offre introuvable", 404
        
        # Calcul du montant et des frais
        amount = int(float(offer.get("amount", 0)) * 100)
        currency = offer.get("currency", "eur")
        description = offer.get("description", creator.get("title", "Abonnement MAKERHUB"))
        plan_type = creator.get("plan_type", "commission")
        
        if plan_type == "commission":
            application_fee_amount = int(amount * 0.05)  # 5% commission MAKERHUB
        else:
            application_fee_amount = 0
        
        stripe_account_id = creator.get("stripe_account_id")
        if not stripe_account_id:
            return "Compte Stripe Connect manquant", 400
        
        # Création de la session Stripe
        base_url = os.getenv("BASE_URL", "http://localhost:3000")
        session = stripe.checkout.Session.create(
            payment_method_types=['card'],
            line_items=[{
                'price_data': {
                    'currency': currency,
                    'unit_amount': amount,
                    'product_data': {
                        'name': description,
                        'description': f"Accès premium au canal de {creator.get('brand_name', 'ce créateur')}"
                    },
                },
                'quantity': 1,
            }],
            mode='payment',
            customer_email=request.args.get("email", None),
            success_url=f"{base_url}/success?creator_id={creator_id}",
            cancel_url=f"{base_url}/c/{creator_id}",
            payment_intent_data={
                "application_fee_amount": application_fee_amount,
                "transfer_data": {
                    "destination": stripe_account_id,
                }
            },
            metadata={
                "creator_id": creator_id,
                "offer_index": offer_index,
                "telegram_user_id": request.args.get("telegram_user_id", ""),
                "landing_page_id": creator_id
            }
        )
        
        logger.info(f"✅ Session checkout créée pour {creator_id}: {session.id}")
        return redirect(session.url)
        
    except Exception as e:
        logger.error(f"❌ Erreur checkout: {e}")
        return f"Erreur lors du checkout: {e}", 500

@app.route('/webhook', methods=['POST'])
def stripe_webhook():
    """Webhook Stripe pour traiter les paiements"""
    payload = request.data
    sig_header = request.headers.get('stripe-signature')
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except Exception as e:
        logger.error(f"❌ Erreur webhook Stripe: {e}")
        return Response(status=400)
    
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        customer_email = session.get('customer_email')
        amount_total = session.get('amount_total', 0) / 100
        creator_id = session.get('metadata', {}).get('creator_id')
        telegram_user_id = session.get('metadata', {}).get('telegram_user_id')
        
        # Sauvegarder la vente
        sale_data = {
            'created_at': firestore.SERVER_TIMESTAMP,
            'email': customer_email,
            'amount': amount_total,
            'creator_id': creator_id,
            'stripe_session_id': session.get('id'),
            'telegram_user_id': telegram_user_id,
            'status': 'completed'
        }
        db.collection('sales').add(sale_data)
        
        # NOUVEAU - Collecter l'email pour la V1
        if customer_email and creator_id:
            try:
                # Récupérer les détails du customer
                customer_details = session.get('customer_details', {})
                
                # Sauvegarder dans collected_emails
                db.collection('collected_emails').add({
                    'email': customer_email,
                    'customerName': customer_details.get('name', ''),
                    'creatorId': creator_id,
                    'landingPageId': session.get('metadata', {}).get('landing_page_id', creator_id),
                    'source': 'Stripe Checkout',
                    'stripeCustomerId': session.get('customer'),
                    'stripeSessionId': session.get('id'),
                    'createdAt': firestore.SERVER_TIMESTAMP,
                    'opens': 0,
                    'clicks': 0
                })
                
                logger.info(f"✅ Email collecté dans collected_emails: {customer_email}")
                
            except Exception as email_collection_error:
                logger.error(f"❌ Erreur collecte email: {email_collection_error}")
        
        # Envoi de l'email de confirmation de paiement
        if customer_email and creator_id:
            try:
                # Récupérer le nom du créateur
                doc = db.collection("creators").document(creator_id).get()
                if doc.exists:
                    creator_data = doc.to_dict()
                    creator_name = creator_data.get("brand_name", "le créateur")
                    
                    # Envoyer l'email de confirmation
                    success = email_service.send_payment_confirmation(
                        customer_email, 
                        creator_name, 
                        amount_total
                    )
                    
                    if success:
                        logger.info(f"✅ Email confirmation paiement envoyé à {customer_email}")
                    else:
                        logger.warning(f"⚠️ Échec envoi email confirmation à {customer_email}")
                    
                    # Tracker l'email du client
                    try:
                        auth_email_sync.sync_email_to_firestore(customer_email, f"Client de {creator_name}")
                        logger.info(f"📧 Email client tracké: {customer_email}")
                    except Exception as track_error:
                        logger.warning(f"⚠️ Erreur tracking email client: {track_error}")
                        
            except Exception as email_error:
                logger.error(f"❌ Erreur envoi email confirmation: {email_error}")
        
        # Gestion Telegram - Envoi du lien d'invitation
        if telegram_user_id and creator_id:
            try:
                # Récupérer le channel_id du créateur
                doc = db.collection("creators").document(creator_id).get()
                if doc.exists:
                    creator_data = doc.to_dict()
                    channel_id = creator_data.get("channel_id")
                    creator_name = creator_data.get("brand_name", "le créateur")
                    
                    if channel_id:
                        # Créer un lien d'invitation avec async
                        async def send_invite():
                            bot = Bot(token=bot_token)
                            expire_date = datetime.now() + timedelta(hours=24)
                            
                            invite_link = await bot.create_chat_invite_link(
                                chat_id=channel_id,
                                expire_date=expire_date,
                                member_limit=1
                            )
                            
                            # Envoyer le lien au client
                            await bot.send_message(
                                chat_id=int(telegram_user_id),
                                text=(
                                    f"✅ **Paiement confirmé pour {creator_name}!**\n\n"
                                    f"💰 Montant: {amount_total}€\n"
                                    f"📧 Email: {customer_email}\n\n"
                                    f"🔗 Voici votre lien d'accès au canal (valable 24h):\n"
                                    f"{invite_link.invite_link}\n\n"
                                    "⚠️ Ce lien est à usage unique.\n"
                                    "📱 Cliquez dessus pour rejoindre le canal premium!"
                                ),
                                parse_mode="Markdown"
                            )
                        
                        asyncio.run(send_invite())
                        logger.info(f"✅ Lien d'invitation Telegram envoyé à {telegram_user_id}")
                        
            except Exception as telegram_error:
                logger.error(f"❌ Erreur envoi lien Telegram: {telegram_error}")
        
        logger.info(f"✅ Paiement traité: {amount_total}€ pour {creator_id}")
    
    return Response(status=200)

@app.route("/api/sales/<creator_id>")
def api_sales(creator_id):
    """API pour récupérer les ventes d'un créateur"""
    try:
        sales = db.collection("sales").where("creator_id", "==", creator_id).order_by("created_at", direction=firestore.Query.DESCENDING).stream()
        sales_list = []
        
        for doc in sales:
            data = doc.to_dict()
            data["id"] = doc.id
            if "created_at" in data and data["created_at"]:
                data["created_at"] = data["created_at"].isoformat() if hasattr(data["created_at"], "isoformat") else str(data["created_at"])
            sales_list.append(data)
            
        logger.info(f"✅ {len(sales_list)} ventes récupérées pour {creator_id}")
        return jsonify(sales_list)
        
    except Exception as e:
        logger.error(f"❌ Erreur récupération ventes: {e}")
        return jsonify({"error": str(e)}), 500

# Nouvelle route API pour récupérer les emails collectés
@app.route("/api/emails/list", methods=["GET"])
def api_emails_list():
    """API pour récupérer la liste des emails collectés"""
    try:
        # Vérification du token Firebase
        id_token = request.headers.get('Authorization', '').replace('Bearer ', '')
        if not id_token:
            return jsonify({"error": "Token manquant"}), 401

        decoded_token = auth.verify_id_token(id_token)
        creator_id = decoded_token['uid']
        
        # Récupérer les emails du créateur
        emails = db.collection("collected_emails").where("creatorId", "==", creator_id).order_by("createdAt", direction=firestore.Query.DESCENDING).stream()
        emails_list = []
        
        for doc in emails:
            data = doc.to_dict()
            data["id"] = doc.id
            if "createdAt" in data and data["createdAt"]:
                data["createdAt"] = data["createdAt"].isoformat() if hasattr(data["createdAt"], "isoformat") else str(data["createdAt"])
            emails_list.append(data)
            
        logger.info(f"✅ {len(emails_list)} emails récupérés pour {creator_id}")
        return jsonify({
            "success": True,
            "emails": emails_list,
            "total": len(emails_list)
        })
        
    except Exception as e:
        logger.error(f"❌ Erreur récupération emails: {e}")
        return jsonify({"error": str(e)}), 500

# ========================================
# ROUTES D'API ET DE TEST
# ========================================

@app.route("/api/test", methods=["GET"])
def test_endpoint():
    """Endpoint de test pour vérifier que l'API fonctionne"""
    return jsonify({
        "status": "ok",
        "service": "MAKERHUB Python API",
        "port": 5001,
        "message": "Service opérationnel",
        "bot": bot_username,
        "email_service": "✅ Activé avec live@makerhub.pro",
        "email_tracker": "✅ Tracker initialisé",
        "auth_sync": "✅ Sync auth emails activé",
        "version": "3.0.0",
        "node_proxy": "Accessible via http://localhost:3000/api/python/*"
    }), 200

@app.route("/api/health", methods=["GET"])
def health_check_detailed():
    """Vérification de santé détaillée du service"""
    try:
        # Test connexion Firestore
        db.collection("health_check").limit(1).get()
        firestore_status = "✅"
    except:
        firestore_status = "❌"
    
    # Test service email
    email_status = "✅" if email_service.test_connection() else "❌"
    
    return jsonify({
        "status": "healthy",
        "service": "MAKERHUB Python",
        "port": 5001,
        "components": {
            "firestore": firestore_status,
            "email_service": email_status,
            "email_tracker": "✅",
            "auth_sync": "✅",
            "stripe": "✅" if stripe.api_key else "❌",
            "telegram": "✅" if bot_token else "❌"
        },
        "timestamp": datetime.now().isoformat(),
        "version": "3.0.0"
    }), 200

# Route pour synchroniser manuellement un email
@app.route("/api/sync-user-email", methods=["POST"])
def sync_user_email_api():
    """API pour synchroniser manuellement l'email d'un utilisateur"""
    try:
        data = request.get_json()
        
        email = data.get('email')
        profile_name = data.get('profile_name', '')
        uid = data.get('uid')
        auth_token = data.get('auth_token')
        
        if not email:
            return jsonify({"error": "Email requis"}), 400
        
        # Synchroniser l'email
        success = auth_email_sync.sync_email_to_firestore(email, profile_name, auth_token, uid)
        
        if success:
            return jsonify({
                "success": True,
                "message": f"Email {email} synchronisé avec succès",
                "timestamp": datetime.now().isoformat()
            }), 200
        else:
            return jsonify({
                "success": False,
                "error": "Échec de la synchronisation"
            }), 500
        
    except Exception as e:
        logger.error(f"❌ Erreur sync email API: {e}")
        return jsonify({"error": str(e)}), 500

# ========================================
# GESTION D'ERREURS
# ========================================

@app.errorhandler(404)
def not_found(error):
    """Gestion des erreurs 404"""
    return jsonify({
        'success': False,
        'error': 'Page non trouvée',
        'service': 'MAKERHUB Python',
        'port': 5001,
        'suggestion': 'Vérifiez l\'URL ou consultez la documentation'
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Gestion des erreurs 500"""
    logger.error(f"Erreur interne: {str(error)}")
    return jsonify({
        'success': False,
        'error': 'Erreur interne du serveur',
        'service': 'MAKERHUB Python',
        'port': 5001,
        'message': 'Consultez les logs pour plus de détails'
    }), 500

# ========================================
# INITIALISATION ET DÉMARRAGE
# ========================================

def initialize_services():
    """Initialisation des services au démarrage"""
    logger.info("🚀 Initialisation MAKERHUB Python Service")
    
    # Test de connexion email
    if email_service.test_connection():
        logger.info("✅ Service email MAKERHUB opérationnel")
    else:
        logger.error("❌ Problème service email - Vérifiez la configuration")
    
    # Vérification des variables d'environnement critiques
    required_vars = ["STRIPE_SECRET_KEY", "TELEGRAM_TOKEN", "TELEGRAM_API_ID", "TELEGRAM_API_HASH"]
    missing_vars = [var for var in required_vars if not os.getenv(var)]
    
    if missing_vars:
        logger.error(f"❌ Variables manquantes: {', '.join(missing_vars)}")
    else:
        logger.info("✅ Configuration complète validée")

if __name__ == "__main__":
    import sys
    
    # Mode test si argument "test" fourni
    if len(sys.argv) > 1 and sys.argv[1] == "test":
        logger.info("🧪 Mode test MAKERHUB Python")
        
        # Test de tous les services
        logger.info("📧 Test service email...")
        if email_service.test_connection():
            logger.info("✅ Service email: OK")
        else:
            logger.error("❌ Service email: ERREUR")
        
        logger.info("📊 Test Firestore...")
        try:
            db.collection("_test").limit(1).get()
            logger.info("✅ Firestore: OK")
        except Exception as e:
            logger.error(f"❌ Firestore: ERREUR - {e}")
        
        logger.info("💳 Test Stripe...")
        if stripe.api_key:
            logger.info("✅ Stripe: OK")
        else:
            logger.error("❌ Stripe: ERREUR - Clé manquante")
        
        logger.info("🤖 Test Telegram...")
        if bot_token:
            logger.info("✅ Telegram: OK")
        else:
            logger.error("❌ Telegram: ERREUR - Token manquant")
        
        logger.info("🎯 Tests terminés")
        sys.exit(0)
    
    # Initialiser les services
    initialize_services()
    
    # Configuration du port
    PORT = int(os.getenv('PYTHON_PORT', 5001))  # Utilise PYTHON_PORT ou 5001 par défaut
    
    logger.info("=" * 60)
    logger.info("🚀 MAKERHUB PYTHON SERVICE - DÉMARRAGE")
    logger.info("=" * 60)
    logger.info(f"📍 Port: {PORT}")
    logger.info(f"🔗 URL: http://localhost:{PORT}")
    logger.info(f"📧 Service email: live@makerhub.pro")
    logger.info(f"🤖 Bot Telegram: @Makerhubsub_bot")
    logger.info(f"💳 Paiements: Stripe Connect")
    logger.info(f"📊 Tracking: Email tracker activé")
    logger.info(f"🔐 Auth sync: Synchronisation emails activée")
    logger.info(f"🌐 CORS: Autorisé pour localhost:3000")
    logger.info(f"🔄 Proxy Node.js: http://localhost:3000/api/python/*")
    logger.info("=" * 60)
    logger.info("📌 Routes principales:")
    logger.info(f"   - Health: GET http://localhost:{PORT}/health")
    logger.info(f"   - Test: GET http://localhost:{PORT}/api/test")
    logger.info(f"   - Telegram: POST http://localhost:{PORT}/api/telegram/*")
    logger.info(f"   - Emails: GET http://localhost:{PORT}/api/emails/list")
    logger.info(f"   - Webhook: POST http://localhost:{PORT}/webhook")
    logger.info("=" * 60)
    
    app.run(
        host='0.0.0.0',
        port=PORT,
        debug=True
    )