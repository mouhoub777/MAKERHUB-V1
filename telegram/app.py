import os
import logging
import asyncio
import re

from flask import Flask, request, redirect, jsonify, Response
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

load_dotenv()

app = Flask(__name__)
CORS(app, origins=['http://localhost:3000', 'http://localhost:5001', 'https://makerhub.pro', 'https://api.makerhub.pro'])

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

# Configuration Telegram
api_id = int(os.getenv("TELEGRAM_API_ID"))
api_hash = os.getenv("TELEGRAM_API_HASH")
bot_username = os.getenv("BOT_USERNAME", "@Makerhubsub_bot")
bot_token = os.getenv("TELEGRAM_TOKEN")

# ========================================
# ROUTES SANTÉ
# ========================================

@app.route("/health", methods=["GET"])
def health_check_simple():
    return jsonify({
        "status": "healthy",
        "service": "MAKERHUB Python Service",
        "port": 5001,
        "timestamp": datetime.now().isoformat()
    }), 200

@app.route("/")
def home():
    return jsonify({
        "service": "MAKERHUB Python Service",
        "version": "3.3.0",
        "port": 5001,
        "status": "operational"
    })

# ========================================
# FONCTIONS TELEGRAM
# ========================================

async def get_telegram_channel_id(link):
    async with TelegramClient("userbot_session", api_id, api_hash) as client:
        try:
            entity = await client.get_entity(link)
            return entity.id
        except Exception as e:
            logger.error(f"Error retrieving channel ID: {e}")
            return None

def fetch_telegram_channel_id(link):
    return asyncio.run(get_telegram_channel_id(link))

def check_bot_is_admin(channel_link):
    async def check_admin():
        async with TelegramClient("userbot_session", api_id, api_hash) as client:
            try:
                await client.start()
                entity = await client.get_entity(channel_link)
                admins = await client(GetParticipantsRequest(
                    channel=entity,
                    filter=ChannelParticipantsAdmins(),
                    offset=0,
                    limit=100,
                    hash=0
                ))
                bot_username_clean = bot_username.lower().replace('@', '')
                for user in admins.users:
                    if hasattr(user, 'username') and user.username:
                        if user.username.lower() == bot_username_clean:
                            return True
                return False
            except Exception as e:
                logger.error(f"Admin verification error: {e}")
                return False
    return asyncio.run(check_admin())

# ========================================
# ROUTES TELEGRAM
# ========================================

@app.route("/api/telegram/get-channel-id", methods=["POST"])
def api_get_channel_id():
    try:
        data = request.json
        channel_link = data.get("channel_link")
        
        if not channel_link:
            return jsonify({"error": "Channel link required"}), 400
        
        logger.info(f"Retrieving ID for: {channel_link}")
        channel_id = fetch_telegram_channel_id(channel_link)
        
        if not channel_id:
            return jsonify({"error": "Unable to retrieve channel ID."}), 400
        
        if channel_id > 0:
            channel_id = f"-100{channel_id}"
        
        return jsonify({
            "success": True,
            "channel_id": str(channel_id),
            "channel_link": channel_link
        }), 200
        
    except Exception as e:
        logger.error(f"get_channel_id error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/telegram/check-bot-admin", methods=["POST"])
def api_check_bot_admin():
    try:
        data = request.json
        channel_link = data.get("channel_link")
        
        if not channel_link:
            return jsonify({"error": "Channel link required"}), 400
        
        is_admin = check_bot_is_admin(channel_link)
        
        return jsonify({
            "success": True,
            "is_admin": is_admin,
            "bot_username": bot_username
        }), 200
        
    except Exception as e:
        logger.error(f"check_bot_admin error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/telegram/save-connection", methods=["POST"])
def api_save_telegram_connection():
    try:
        data = request.json
        page_id = data.get("page_id")
        channel_id = data.get("channel_id")
        channel_link = data.get("channel_link")
        channel_name = data.get("channel_name")
        bot_verified = data.get("bot_verified", False)
        
        if not all([page_id, channel_id, channel_link]):
            return jsonify({"error": "Missing data"}), 400
        
        doc_ref = db.collection("telegram_connections").document(page_id)
        doc_ref.set({
            "pageId": page_id,
            "channelId": channel_id,
            "channelLink": channel_link,
            "channelName": channel_name,
            "botVerified": bot_verified,
            "connectedAt": firestore.SERVER_TIMESTAMP,
            "status": "active",
            "botUsername": bot_username
        })
        
        logger.info(f"✅ Telegram connection saved for page {page_id}")
        
        return jsonify({
            "success": True,
            "message": "Connection saved"
        }), 200
        
    except Exception as e:
        logger.error(f"save_telegram_connection error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/telegram/create-invite-link", methods=["POST"])
def api_create_invite_link():
    try:
        data = request.json
        channel_id = data.get("channel_id")
        user_telegram_id = data.get("user_telegram_id")
        expire_hours = data.get("expire_hours", 24)
        member_limit = data.get("member_limit", 1)
        
        if not channel_id:
            return jsonify({"error": "channel_id required"}), 400
        
        async def create_link():
            bot = Bot(token=bot_token)
            expire_date = datetime.now() + timedelta(hours=expire_hours)
            
            invite_link = await bot.create_chat_invite_link(
                chat_id=channel_id,
                expire_date=expire_date,
                member_limit=member_limit
            )
            
            if user_telegram_id:
                await bot.send_message(
                    chat_id=int(user_telegram_id),
                    text=(
                        "🎉 **Channel access approved\!**\n\n"
                        f"Here is your access link (valid for {expire_hours}h):\n"
                        f"{invite_link.invite_link}\n\n"
                        "⚠️ This link is for single use only."
                    ),
                    parse_mode="Markdown"
                )
                
            return invite_link
        
        invite_link = asyncio.run(create_link())
        
        return jsonify({
            "success": True,
            "invite_link": invite_link.invite_link,
            "expire_date": invite_link.expire_date.isoformat() if invite_link.expire_date else None
        }), 200
        
    except Exception as e:
        logger.error(f"create_invite_link error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/telegram/add-member", methods=["POST"])
def api_add_member():
    try:
        data = request.json
        page_id = data.get("page_id")
        telegram_user_id = data.get("telegram_user_id")
        email = data.get("email")
        
        if not page_id or not telegram_user_id:
            return jsonify({"error": "page_id and telegram_user_id required"}), 400
        
        conn_doc = db.collection("telegram_connections").document(page_id).get()
        if not conn_doc.exists:
            return jsonify({"error": "Telegram connection not found"}), 404
        
        conn_data = conn_doc.to_dict()
        channel_id = conn_data.get("channelId") or conn_data.get("channel_id")
        
        async def send_invite():
            bot = Bot(token=bot_token)
            expire_date = datetime.now() + timedelta(hours=24)
            
            invite_link = await bot.create_chat_invite_link(
                chat_id=channel_id,
                expire_date=expire_date,
                member_limit=1
            )
            
            await bot.send_message(
                chat_id=int(telegram_user_id),
                text=(
                    "🎉 **Payment confirmed\!**\n\n"
                    f"Here is your access link (valid for 24h):\n"
                    f"{invite_link.invite_link}\n\n"
                    "⚠️ This link is for single use only."
                ),
                parse_mode="Markdown"
            )
            return invite_link
        
        invite_link = asyncio.run(send_invite())
        
        db.collection("telegram_members").add({
            "pageId": page_id,
            "channelId": channel_id,
            "telegramUserId": telegram_user_id,
            "email": email,
            "status": "invited",
            "inviteLink": invite_link.invite_link,
            "invitedAt": firestore.SERVER_TIMESTAMP
        })
        
        return jsonify({
            "success": True,
            "invite_link": invite_link.invite_link
        }), 200
        
    except Exception as e:
        logger.error(f"add_member error: {e}")
        return jsonify({"error": str(e)}), 500

@app.route("/api/telegram/remove-member", methods=["POST"])
def api_remove_member():
    try:
        data = request.json
        page_id = data.get("page_id")
        telegram_user_id = data.get("telegram_user_id")
        
        if not page_id or not telegram_user_id:
            return jsonify({"error": "page_id and telegram_user_id required"}), 400
        
        conn_doc = db.collection("telegram_connections").document(page_id).get()
        if not conn_doc.exists:
            return jsonify({"error": "Telegram connection not found"}), 404
        
        conn_data = conn_doc.to_dict()
        channel_id = conn_data.get("channelId") or conn_data.get("channel_id")
        
        async def kick_member():
            async with TelegramClient("userbot_session", api_id, api_hash) as client:
                await client.start()
                entity = await client.get_entity(int(channel_id))
                await client.kick_participant(entity, int(telegram_user_id))
        
        asyncio.run(kick_member())
        
        members_query = db.collection("telegram_members").where("pageId", "==", page_id).where("telegramUserId", "==", telegram_user_id).get()
        for doc in members_query:
            doc.reference.update({"status": "removed", "removedAt": firestore.SERVER_TIMESTAMP})
        
        return jsonify({"success": True, "message": "Member removed"}), 200
        
    except Exception as e:
        logger.error(f"remove_member error: {e}")
        return jsonify({"error": str(e)}), 500

# ========================================
# ROUTE CHECKOUT LANDING PAGES V1
# ========================================

@app.route("/checkout/<page_id>")
def checkout_landing_page(page_id):
    """Checkout pour les landing pages MAKERHUB V1"""
    try:
        plan_id = request.args.get('plan')
        telegram_user_id = request.args.get('telegram_user_id', '')
        
        logger.info(f"🛒 Checkout pour page: {page_id}, plan: {plan_id}")
        
        # Chercher la page par slug OU par ID document
        page_doc = None
        page_doc_id = None
        
        # D'abord chercher par slug
        pages_query = db.collection('landingPages').where('slug', '==', page_id).limit(1).get()
        
        if pages_query:
            page_doc = pages_query[0]
            page_doc_id = page_doc.id
            logger.info(f"✅ Page trouvée par slug: {page_id}")
        else:
            # Sinon chercher par ID document
            doc_ref = db.collection('landingPages').document(page_id).get()
            if doc_ref.exists:
                page_doc = doc_ref
                page_doc_id = page_id
                logger.info(f"✅ Page trouvée par ID: {page_id}")
        
        if not page_doc:
            logger.error(f"❌ Page not found: {page_id}")
            return jsonify({"error": "Page not found"}), 404
        
        page_data = page_doc.to_dict()
        logger.info(f"✅ Page chargée: {page_data.get('brand', page_id)}")
        
        # Récupérer le prix
        prices = page_data.get('prices', [])
        selected_price = None
        
        if plan_id:
            for price in prices:
                if price.get('id') == plan_id:
                    selected_price = price
                    break
        
        if not selected_price and prices:
            selected_price = prices[0]
        
        if not selected_price:
            logger.error(f"❌ No price found for page {page_id}")
            return jsonify({"error": "No price configured"}), 400
        
        # Récupérer le montant
        price_value = selected_price.get('price') or selected_price.get('amount', 0)
        amount = int(float(price_value) * 100)
        
        # Récupérer la devise
        currency = selected_price.get('currencyCode', selected_price.get('currency', 'eur')).lower()
        if currency == '€' or currency == 'eur':
            currency = 'eur'
        elif currency == '$' or currency == 'usd':
            currency = 'usd'
        
        logger.info(f"💰 Prix: {amount/100} {currency}")
        
        if amount <= 0:
            return jsonify({"error": "Invalid amount"}), 400
        
        # Récupérer le Stripe Account ID du créateur
        creator_id = page_data.get('creatorId') or page_data.get('userId')
        stripe_account_id = None
        user_plan = 'freemium'
        
        if creator_id:
            user_doc = db.collection('users').document(creator_id).get()
            if user_doc.exists:
                user_data = user_doc.to_dict()  # ✅ CORRIGÉ: to_dict() au lieu de data()
                stripe_account_id = user_data.get('stripeAccountId')
                user_plan = user_data.get('plan', 'freemium').lower()
                logger.info(f"💳 Stripe Account: {stripe_account_id}, Plan: {user_plan}")
        
        # URLs de Back
        base_url = os.getenv('DOMAIN', 'http://localhost:3000')
        profile_name = page_data.get('profileName', '')
        slug = page_data.get('slug', page_id)
        
        # Récupérer la langue de la page
        page_lang = page_data.get('language', page_data.get('sourceLanguage', 'en'))
        
        success_url = f"{base_url}/success?session_id={{CHECKOUT_SESSION_ID}}&page_id={page_doc_id}&lang={page_lang}"
        cancel_url = f"{base_url}/{profile_name}/{slug}" if profile_name else base_url
        
        # Description du produit
        product_description = selected_price.get('label') or selected_price.get('description', 'Accès premium')
        
        # Déterminer l'intervalle de récurrence
        period = selected_price.get('period', 'mois').lower()
        interval = 'month'
        interval_count = 1
        
        if 'jour' in period or 'day' in period:
            interval = 'day'
        elif 'semaine' in period or 'week' in period:
            interval = 'week'
        elif 'an' in period or 'year' in period:
            interval = 'year'
        elif 'mois' in period or 'month' in period:
            interval = 'month'
        
        logger.info(f"📅 Récurrence: {interval} (période: {period})")
        
        # Session Stripe Checkout - MODE Subscription
        session_params = {
            'payment_method_types': ['card'],
            'line_items': [{
                'price_data': {
                    'currency': currency,
                    'unit_amount': amount,
                    'product_data': {
                        'name': page_data.get('brand', 'Subscription'),
                        'description': product_description
                    },
                    'recurring': {
                        'interval': interval,
                        'interval_count': interval_count
                    }
                },
                'quantity': 1,
            }],
            'mode': 'subscription',
            'success_url': success_url,
            'cancel_url': cancel_url,
            'billing_address_collection': 'auto',
            'metadata': {
                'page_id': page_doc_id,
                'creator_id': creator_id or '',
                'telegram_user_id': telegram_user_id,
                'plan_id': plan_id or '',
                'language': page_lang
            },
            'subscription_data': {
                'metadata': {
                    'page_id': page_doc_id,
                    'creator_id': creator_id or '',
                    'plan_id': plan_id or ''
                }
            }
        }
        
        # Stripe Connect si disponible
        if stripe_account_id:
            plan_fees = {
                'freemium': 10,
                'pro': 4,
                'business': 2
            }
            fee_percent = plan_fees.get(user_plan, 10)
            
            session_params['subscription_data']['application_fee_percent'] = fee_percent
            session_params['subscription_data']['transfer_data'] = {
                'destination': stripe_account_id
            }
            logger.info(f"💳 Stripe Connect activé, Commission: {fee_percent}%")
        
        session = stripe.checkout.Session.create(**session_params)
        
        logger.info(f"✅ Session Stripe créée: {session.id}")
        return redirect(session.url)
        
    except stripe.error.StripeError as e:
        logger.error(f"❌ Stripe error: {e}")
        return jsonify({"error": f"Stripe error: {str(e)}"}), 500
    except Exception as e:
        logger.error(f"❌ Checkout error: {e}")
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)}), 500

# ========================================
# WEBHOOK STRIPE
# ========================================

@app.route('/webhook', methods=['POST'])
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get('stripe-signature')
    endpoint_secret = os.getenv("STRIPE_WEBHOOK_SECRET")
    
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, endpoint_secret)
    except Exception as e:
        logger.error(f"❌ Webhook error: {e}")
        return Response(status=400)
    
    logger.info(f"📥 Webhook received: {event['type']}")
    
    # ========================================
    # NOUVEAU Subscription / PAIEMENT RÉUSSI
    # ========================================
    if event['type'] == 'checkout.session.completed':
        session = event['data']['object']
        customer_email = session.get('customer_email')
        customer_id = session.get('customer')
        subscription_id = session.get('subscription')
        amount_total = session.get('amount_total', 0) / 100
        metadata = session.get('metadata', {})
        page_id = metadata.get('page_id')
        creator_id = metadata.get('creator_id')
        telegram_user_id = metadata.get('telegram_user_id')
        
        logger.info(f"💰 Subscription: {amount_total}€, Email: {customer_email}, Sub: {subscription_id}")
        
        # Sauvegarder avec camelCase
        db.collection('sales').add({
            'createdAt': firestore.SERVER_TIMESTAMP,
            'email': customer_email,
            'amount': amount_total,
            'pageId': page_id,
            'creatorId': creator_id,
            'stripeSessionId': session.get('id'),
            'stripeCustomerId': customer_id,
            'stripeSubscriptionId': subscription_id,
            'telegramUserId': telegram_user_id,
            'status': 'active',
            'type': 'subscription'
        })
        
        logger.info(f"✅ Sale recorded in Firebase (sales)")
        
        # Collecter l'email
        if customer_email:
            customer_details = session.get('customer_details', {})
            db.collection('collected_emails').add({
                'email': customer_email,
                'customerName': customer_details.get('name', ''),
                'creatorId': creator_id,
                'landingPageId': page_id,
                'source': 'Stripe Checkout',
                'createdAt': firestore.SERVER_TIMESTAMP
            })
            logger.info(f"✅ Email collected: {customer_email}")
    
    # ========================================
    # Subscription ANNULÉ → KICK MEMBRE
    # ========================================
    elif event['type'] == 'customer.subscription.deleted':
        subscription = event['data']['object']
        customer_id = subscription.get('customer')
        subscription_id = subscription.get('id')
        metadata = subscription.get('metadata', {})
        page_id = metadata.get('page_id')
        
        cancellation_details = subscription.get('cancellation_details', {})
        cancellation_reason = cancellation_details.get('reason', 'unknown') if cancellation_details else 'unknown'
        
        logger.info(f"❌ Subscription cancelled: {subscription_id}, Raison: {cancellation_reason}")
        
        # Trouver le membre
        members = db.collection('telegram_members').where('stripeSubscriptionId', '==', subscription_id).get()
        
        if not members:
            members = db.collection('telegram_members').where('stripeCustomerId', '==', customer_id).get()
        
        for member_doc in members:
            member_data = member_doc.to_dict()  # ✅ CORRIGÉ
            channel_id = member_data.get('channelId')
            telegram_user_id = member_data.get('telegramUserId')
            email = member_data.get('email')
            
            logger.info(f"🔴 Kick member: {email} du canal {channel_id}")
            
            if channel_id and telegram_user_id:
                try:
                    async def kick_member():
                        async with TelegramClient("userbot_session", api_id, api_hash) as client:
                            await client.kick_participant(int(channel_id), int(telegram_user_id))
                    
                    asyncio.run(kick_member())
                    logger.info(f"✅ Member kicked: {telegram_user_id}")
                except Exception as e:
                    logger.error(f"❌ Kick error: {e}")
            
            member_doc.reference.update({
                'status': 'removed',
                'removedAt': firestore.SERVER_TIMESTAMP,
                'removalReason': cancellation_reason
            })
        
        # Mettre à jour la vente
        sales = db.collection('sales').where('stripeSubscriptionId', '==', subscription_id).get()
        for sale_doc in sales:
            sale_doc.reference.update({'status': 'cancelled'})
    
    # ========================================
    # PAIEMENT ÉCHOUÉ
    # ========================================
    elif event['type'] == 'invoice.payment_failed':
        invoice = event['data']['object']
        customer_id = invoice.get('customer')
        subscription_id = invoice.get('subscription')
        customer_email = invoice.get('customer_email')
        attempt_count = invoice.get('attempt_count', 1)
        
        logger.warning(f"⚠️ Payment failed (attempt {attempt_count}): {customer_email}, Sub: {subscription_id}")
        
        members = db.collection('telegram_members').where('stripeSubscriptionId', '==', subscription_id).get()
        
        for member_doc in members:
            update_data = {
                'status': 'payment_failed',
                'paymentFailedAt': firestore.SERVER_TIMESTAMP,
                'failedAttemptCount': attempt_count
            }
            
            if attempt_count == 1:
                update_data['gracePeriodStart'] = firestore.SERVER_TIMESTAMP
            
            member_doc.reference.update(update_data)
        
        logger.info(f"⏳ Client in grace period")
    
    # ========================================
    # RENOUVELLEMENT RÉUSSI
    # ========================================
    elif event['type'] == 'invoice.payment_succeeded':
        invoice = event['data']['object']
        subscription_id = invoice.get('subscription')
        amount = invoice.get('amount_paid', 0) / 100
        customer_email = invoice.get('customer_email')
        
        if subscription_id:
            logger.info(f"✅ Renewal successful: {customer_email}, {amount}€")
            
            members = db.collection('telegram_members').where('stripeSubscriptionId', '==', subscription_id).get()
            for member_doc in members:
                member_doc.reference.update({
                    'status': 'active',
                    'lastPaymentAt': firestore.SERVER_TIMESTAMP,
                    'failedAttemptCount': 0,
                    'gracePeriodStart': None
                })
    
    return Response(status=200)

# ========================================
# PAGES SUCCESS/CANCEL
# ========================================

@app.route("/success")
def success_page():
    """Page de succès après paiement - Génère et affiche le lien Telegram"""
    session_id = request.args.get('session_id')
    page_id = request.args.get('page_id')
    lang = request.args.get('lang', 'en')
    
    invite_link = None
    error_message = None
    
    # Traductions
    translations = {
        'en': {
            'title': 'Payment successful!',
            'subtitle': 'Click the button below to join the channel.',
            'button': 'Join the channel',
            'warning': 'This link is for single use only.',
            'error_title': 'Oops!',
            'error_back': 'Back',
            'error_support': 'If you have paid, contact support with your email.'
        },
        'fr': {
            'title': 'Payment Successful\!',
            'subtitle': 'Cliquez sur le bouton ci-dessous pour rejoindre le canal.',
            'button': 'Rejoindre le canal',
            'warning': 'This link is for single use only.',
            'error_title': 'Oups !',
            'error_back': 'Back',
            'error_support': 'If you have paid, contact support with your email.'
        },
        'es': {
            'title': '¡Pago exitoso!',
            'subtitle': 'Haz clic en el botón de abajo para unirte al canal.',
            'button': 'Unirse al canal',
            'warning': 'Este enlace es de un solo uso.',
            'error_title': '¡Ups!',
            'error_back': 'Volver',
            'error_support': 'Si has pagado, contacta con soporte con tu email.'
        },
        'de': {
            'title': 'Zahlung erfolgreich!',
            'subtitle': 'Klicken Sie auf die Schaltfläche unten, um dem Kanal beizutreten.',
            'button': 'Kanal beitreten',
            'warning': 'Dieser Link ist nur einmal verwendbar.',
            'error_title': 'Hoppla!',
            'error_back': 'Zurück',
            'error_support': 'Wenn Sie bezahlt haben, kontaktieren Sie den Support mit Ihrer E-Mail.'
        },
        'pt': {
            'title': 'Pagamento bem-sucedido!',
            'subtitle': 'Clique no botão abaixo para entrar no canal.',
            'button': 'Entrar no canal',
            'warning': 'Este link é de uso único.',
            'error_title': 'Ops!',
            'error_back': 'Voltar',
            'error_support': 'Se você pagou, entre em contato com o suporte com seu email.'
        },
        'it': {
            'title': 'Pagamento riuscito!',
            'subtitle': 'Clicca il pulsante qui sotto per unirti al canale.',
            'button': 'Unisciti al canale',
            'warning': 'Questo link è monouso.',
            'error_title': 'Ops!',
            'error_back': 'Indietro',
            'error_support': 'Se hai pagato, contatta il supporto con la tua email.'
        },
        'ru': {
            'title': 'Оплата прошла успешно!',
            'subtitle': 'Нажмите на кнопку ниже, чтобы присоединиться к каналу.',
            'button': 'Присоединиться к каналу',
            'warning': 'Эта ссылка одноразовая.',
            'error_title': 'Упс!',
            'error_back': 'Назад',
            'error_support': 'Если вы заплатили, свяжитесь с поддержкой, указав свой email.'
        },
        'zh': {
            'title': '付款成功！',
            'subtitle': '点击下面的按钮加入频道。',
            'button': '加入频道',
            'warning': '此链接仅限一次使用。',
            'error_title': '哎呀！',
            'error_back': '返回',
            'error_support': '如果您已付款，请联系支持并提供您的电子邮件。'
        },
        'ja': {
            'title': 'お支払いが完了しました！',
            'subtitle': '下のボタンをクリックしてチャンネルに参加してください。',
            'button': 'チャンネルに参加',
            'warning': 'このリンクは1回限り有効です。',
            'error_title': 'おっと！',
            'error_back': '戻る',
            'error_support': 'お支払い済みの場合は、メールでサポートにご連絡ください。'
        },
        'ko': {
            'title': '결제가 완료되었습니다!',
            'subtitle': '아래 버튼을 클릭하여 채널에 가입하세요.',
            'button': '채널 가입',
            'warning': '이 링크는 일회용입니다.',
            'error_title': '이런!',
            'error_back': '뒤로',
            'error_support': '결제하셨다면 이메일로 지원팀에 연락해 주세요.'
        },
        'tr': {
            'title': 'Ödeme başarılı!',
            'subtitle': 'Kanala katılmak için aşağıdaki düğmeye tıklayın.',
            'button': 'Kanala katıl',
            'warning': 'Bu bağlantı tek kullanımlıktır.',
            'error_title': 'Hata!',
            'error_back': 'Geri',
            'error_support': 'Ödeme yaptıysanız, e-postanızla destek ekibiyle iletişime geçin.'
        },
        'ar': {
            'title': 'تم الدفع بنجاح!',
            'subtitle': 'انقر على الزر أدناه للانضمام إلى القناة.',
            'button': 'انضم إلى القناة',
            'warning': 'هذا الرابط للاستخدام مرة واحدة فقط.',
            'error_title': 'عذراً!',
            'error_back': 'رجوع',
            'error_support': 'إذا دفعت، اتصل بالدعم مع بريدك الإلكتروني.'
        },
        'pl': {
            'title': 'Płatność zakończona sukcesem!',
            'subtitle': 'Kliknij przycisk poniżej, aby dołączyć do kanału.',
            'button': 'Dołącz do kanału',
            'warning': 'Ten link jest jednorazowy.',
            'error_title': 'Ups!',
            'error_back': 'Wstecz',
            'error_support': 'Jeśli zapłaciłeś, skontaktuj się z pomocą techniczną, podając swój email.'
        }
    }
    
    t = translations.get(lang, translations['en'])
    
    try:
        if session_id:
            session = stripe.checkout.Session.retrieve(
                session_id,
                expand=['customer_details', 'customer']
            )
            
            if session.payment_status == 'paid':
                page_id = session.metadata.get('page_id') or page_id
                
                if session.metadata.get('language'):
                    lang = session.metadata.get('language')
                    t = translations.get(lang, translations['en'])
                
                customer_email = session.customer_email
                if not customer_email and hasattr(session, 'customer_details') and session.customer_details:
                    customer_email = getattr(session.customer_details, 'email', None)
                
                logger.info(f"✅ Payment verified for session {session_id}, page_id: {page_id}, email: {customer_email}, lang: {lang}")
                
                # Vérifier si un lien existe déjà
                existing = db.collection("telegram_members").where("stripeSessionId", "==", session_id).limit(1).get()
                
                if existing:
                    member_data = existing[0].to_dict()  # ✅ CORRIGÉ
                    invite_link = member_data.get("inviteLink")
                    logger.info(f"🔗 Existing link retrieved: {invite_link}")
                    
                elif page_id:
                    channel_id = None
                    creator_id = None
                    
                    # Chercher la landing page
                    page_doc = db.collection("landingPages").document(page_id).get()
                    
                    if not page_doc.exists:
                        pages_query = db.collection('landingPages').where('slug', '==', page_id).limit(1).get()
                        if pages_query:
                            page_doc = pages_query[0]
                    
                    if page_doc.exists:
                        page_data = page_doc.to_dict()  # ✅ CORRIGÉ
                        creator_id = page_data.get('creatorId')
                        telegram_data = page_data.get('telegram', {})
                        
                        if not session.metadata.get('language'):
                            page_lang = page_data.get('language', 'en')
                            t = translations.get(page_lang, translations['en'])
                        
                        logger.info(f"📄 Page found, telegram data: {telegram_data}")
                        
                        # Récupérer le channel_id
                        conn_doc = db.collection("telegram_connections").document(page_id).get()
                        if conn_doc.exists:
                            conn_data = conn_doc.to_dict()  # ✅ CORRIGÉ
                            channel_id = conn_data.get("channelId") or conn_data.get("channel_id")
                            logger.info(f"📱 Channel ID from telegram_connections: {channel_id}")
                        
                        if not channel_id and telegram_data.get('isConnected'):
                            channel_id = telegram_data.get('channelId')
                            logger.info(f"📱 Channel ID from landing page: {channel_id}")
                        
                        if not channel_id and telegram_data.get('isConnected'):
                            channel_link = telegram_data.get('channelLink', '')
                            
                            if channel_link:
                                try:
                                    async def get_channel():
                                        async with TelegramClient("userbot_session", api_id, api_hash) as client:
                                            entity = await client.get_entity(channel_link)
                                            return entity.id
                                    
                                    raw_channel_id = asyncio.run(get_channel())
                                    if raw_channel_id > 0:
                                        channel_id = f"-100{raw_channel_id}"
                                    else:
                                        channel_id = str(raw_channel_id)
                                    logger.info(f"📱 Channel ID via Telethon: {channel_id}")
                                except Exception as e:
                                    logger.error(f"❌ Telethon error: {e}")
                        
                        logger.info(f"🔍 Final state - channel_id: {channel_id}")
                    
                    # Créer le lien d'invitation
                    if channel_id:
                        try:
                            async def create_link():
                                bot = Bot(token=bot_token)
                                link = await bot.create_chat_invite_link(
                                    chat_id=channel_id,
                                    member_limit=1
                                )
                                return link
                            
                            link_obj = asyncio.run(create_link())
                            invite_link = link_obj.invite_link
                            logger.info(f"✅ Link created: {invite_link}")
                            
                            subscription_id = session.subscription if hasattr(session, 'subscription') else None
                            customer_id = session.customer if hasattr(session, 'customer') else None
                            
                            db.collection("telegram_members").add({
                                "pageId": page_id,
                                "channelId": channel_id,
                                "email": customer_email,
                                "creatorId": creator_id,
                                "status": "active",
                                "inviteLink": invite_link,
                                "stripeSessionId": session_id,
                                "stripeSubscriptionId": subscription_id,
                                "stripeCustomerId": customer_id,
                                "invitedAt": firestore.SERVER_TIMESTAMP
                            })
                            
                            if customer_email:
                                db.collection("collected_emails").add({
                                    "email": customer_email,
                                    "creatorId": creator_id,
                                    "landingPageId": page_id,
                                    "source": "Stripe Checkout",
                                    "createdAt": firestore.SERVER_TIMESTAMP
                                })
                                logger.info(f"📧 Email collected: {customer_email}")
                                
                        except Exception as e:
                            logger.error(f"❌ Link creation error: {e}")
                            import traceback
                            traceback.print_exc()
                            error_message = t.get('error_support', "Error creating link. Contact support.")
                    else:
                        logger.error(f"❌ No channel_id found for page {page_id}")
                        error_message = "Telegram channel not configured for this page."
                else:
                    error_message = "Page not found."
            else:
                error_message = "Payment not confirmed."
        else:
            error_message = "Session not found."
            
    except Exception as e:
        logger.error(f"❌ Success page error: {e}")
        import traceback
        traceback.print_exc()
        error_message = t.get('error_support', "Error. Contact support.")
    
    # Générer le HTML
    if invite_link:
        return f"""
        <!DOCTYPE html>
        <html lang="{lang}">
        <head>
            <title>{t['title']} - MAKERHUB</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                * {{ margin: 0; padding: 0; box-sizing: border-box; }}
                body {{ 
                    font-family: 'Segoe UI', Arial, sans-serif; 
                    background: linear-gradient(135deg, #667eea, #764ba2); 
                    min-height: 100vh; 
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 20px;
                }}
                .container {{ 
                    background: white; 
                    padding: 50px 40px; 
                    border-radius: 24px; 
                    max-width: 500px; 
                    width: 100%;
                    text-align: center;
                    box-shadow: 0 25px 80px rgba(0,0,0,0.3);
                }}
                .emoji {{ font-size: 80px; margin-bottom: 20px; }}
                h1 {{ color: #10B981; font-size: 28px; margin-bottom: 15px; }}
                p {{ color: #666; margin-bottom: 25px; line-height: 1.6; }}
                .telegram-btn {{
                    display: inline-flex;
                    align-items: center;
                    gap: 12px;
                    background: linear-gradient(135deg, #0088cc, #00a0dc);
                    color: white;
                    padding: 18px 40px;
                    border-radius: 50px;
                    text-decoration: none;
                    font-size: 18px;
                    font-weight: 600;
                    transition: all 0.3s ease;
                    box-shadow: 0 8px 25px rgba(0, 136, 204, 0.4);
                }}
                .telegram-btn:hover {{
                    transform: translateY(-3px);
                    box-shadow: 0 12px 35px rgba(0, 136, 204, 0.5);
                }}
                .telegram-btn svg {{ width: 24px; height: 24px; }}
                .warning {{
                    background: #FFF3CD;
                    border: 1px solid #FFECB5;
                    padding: 15px 20px;
                    border-radius: 12px;
                    margin-top: 25px;
                    color: #856404;
                    font-size: 14px;
                }}
            </style>
        </head>
        <body>
            <div class="container">
                <div class="emoji">🎉</div>
                <h1>{t['title']}</h1>
                <p>{t['subtitle']}</p>
                
                <a href="{invite_link}" target="_blank" class="telegram-btn">
                    <svg viewBox="0 0 24 24" fill="currentColor">
                        <path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm5.562 8.161c-.18 1.897-.962 6.502-1.359 8.627-.168.9-.5 1.201-.82 1.23-.697.064-1.226-.461-1.901-.903-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.139-5.062 3.345-.479.329-.913.489-1.302.481-.428-.009-1.252-.242-1.865-.442-.751-.244-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.831-2.529 6.998-3.015 3.333-1.386 4.025-1.627 4.477-1.635.099-.002.321.023.465.141.121.099.154.232.17.325.015.093.034.305.019.471z"/>
                    </svg>
                    {t['button']}
                </a>
                
                <div class="warning">
                    ⚠️ {t['warning']}
                </div>
            </div>
        </body>
        </html>
        """
    else:
        return f"""
        <!DOCTYPE html>
        <html lang="{lang}">
        <head>
            <title>{t['error_title']} - MAKERHUB</title>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
                body {{ font-family: 'Segoe UI', Arial, sans-serif; text-align: center; padding: 50px; background: linear-gradient(135deg, #f5f5f5, #e0e0e0); min-height: 100vh; }}
                .container {{ background: white; padding: 40px; border-radius: 16px; max-width: 500px; margin: 0 auto; box-shadow: 0 10px 40px rgba(0,0,0,0.1); }}
                h1 {{ color: #E74C3C; margin-bottom: 20px; }}
                .error {{ background: #FFEBEE; padding: 20px; border-radius: 12px; color: #C62828; margin: 20px 0; font-size: 16px; }}
                p {{ color: #666; margin: 15px 0; }}
                a {{ color: #667eea; text-decoration: none; font-weight: 600; }}
                a:hover {{ text-decoration: underline; }}
            </style>
        </head>
        <body>
            <div class="container">
                <h1>⚠️ {t['error_title']}</h1>
                <div class="error">{error_message or "An error occurred."}</div>
                <p>{t['error_support']}</p>
                <p style="margin-top: 30px;"><a href="javascript:history.back()">← {t['error_back']}</a></p>
            </div>
        </body>
        </html>
        """

@app.route("/cancel")
def cancel_page():
    return """
    <!DOCTYPE html>
    <html>
    <head><title>Cancelled - MAKERHUB</title>
    <style>
        body { font-family: 'Segoe UI', Arial; text-align: center; padding: 50px; background: #f5f5f5; }
        .container { background: white; padding: 40px; border-radius: 16px; max-width: 400px; margin: 0 auto; }
        h1 { color: #E74C3C; }
        a { color: #667eea; }
    </style>
    </head>
    <body>
        <div class="container">
            <h1>❌ Payment cancelled</h1>
            <p>Your payment has been cancelled.</p>
            <p><a href="javascript:history.back()">← Back</a></p>
        </div>
    </body>
    </html>
    """

# ========================================
# DÉMARRAGE
# ========================================

if __name__ == "__main__":
    PORT = int(os.getenv('PYTHON_PORT', 5001))
    
    print("=" * 60)
    print("🚀 MAKERHUB Python Service - Telegram Members Management")
    print("=" * 60)
    print(f"   PORT: {PORT}")
    print(f"   DOMAIN: {os.getenv('DOMAIN', 'http://localhost:3000')}")
    print("-" * 60)
    print(f"   ✅ Stripe")
    print(f"   ✅ Telegram Bot")
    print(f"   ✅ Telethon (Userbot)")
    print(f"   ✅ Firebase")
    print("=" * 60)
    print("📌 Routes Telegram:")
    print("   POST /api/telegram/get-channel-id")
    print("   POST /api/telegram/check-bot-admin")
    print("   POST /api/telegram/save-connection")
    print("   POST /api/telegram/create-invite-link")
    print("   POST /api/telegram/add-member")
    print("   POST /api/telegram/remove-member")
    print("=" * 60)
    print("💳 Routes Checkout:")
    print("   GET /checkout/<page_id>")
    print("   POST /webhook")
    print("   GET /success (affiche lien Telegram)")
    print("   GET /cancel")
    print("=" * 60)
    
    app.run(host='0.0.0.0', port=PORT, debug=True)





