# telegram/app.py - Serveur Flask MAKERHUB V1
import os
import sys
from flask import Flask, request, jsonify, redirect
from flask_cors import CORS
from dotenv import load_dotenv

# Charger les variables d'environnement
load_dotenv()

# Ajouter le répertoire parent au path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Imports des services
from config.settings import config
from services.FirebaseService import firebase_service
from services.StripeService import stripe_service
from services.TelegramService import telegram_service
from templates import get_success_html, get_cancel_html, get_error_html

# ==================== APP SETUP ====================

app = Flask(__name__)

# CORS
CORS(app, origins=config.CORS_ORIGINS)

# ==================== HEALTH ROUTES ====================

@app.route('/health')
def health():
    """Simple health check"""
    return jsonify({'status': 'ok', 'service': 'makerhub-python'})

@app.route('/api/health')
def api_health():
    """Detailed health check"""
    return jsonify({
        'status': 'ok',
        'service': 'makerhub-python',
        'version': '1.0.0',
        'components': {
            'firebase': firebase_service.check_connection(),
            'stripe': stripe_service.check_connection(),
            'telegram': telegram_service.check_bot_sync()
        }
    })

@app.route('/api/test')
def api_test():
    """Test endpoint"""
    return jsonify({
        'message': 'MAKERHUB Python service is running',
        'env': config.ENV,
        'debug': config.DEBUG
    })

# ==================== CHECKOUT ROUTES ====================

@app.route('/checkout/<page_id>')
@app.route('/checkout/<page_id>/<int:price_index>')
def checkout(page_id, price_index=0):
    """Créer une session Stripe Checkout et rediriger"""
    try:
        # Récupérer les paramètres optionnels
        customer_email = request.args.get('email')
        telegram_user_id = request.args.get('telegram_user_id')
        
        # Créer la session
        result = stripe_service.create_checkout_session(
            page_id=page_id,
            price_index=price_index,
            customer_email=customer_email,
            telegram_user_id=telegram_user_id
        )
        
        # Rediriger vers Stripe Checkout
        return redirect(result['url'])
        
    except ValueError as e:
        return get_error_html(str(e), 'CHECKOUT_ERROR'), 400
    except Exception as e:
        print(f"❌ Checkout error: {e}")
        return get_error_html('Failed to create checkout session', 'CHECKOUT_FAILED'), 500

@app.route('/api/checkout/session', methods=['POST'])
def create_checkout_session_api():
    """API pour créer une session checkout"""
    try:
        data = request.json
        
        result = stripe_service.create_checkout_session(
            page_id=data.get('page_id'),
            price_index=data.get('price_index', 0),
            customer_email=data.get('email'),
            telegram_user_id=data.get('telegram_user_id')
        )
        
        return jsonify(result)
        
    except ValueError as e:
        return jsonify({'error': str(e)}), 400
    except Exception as e:
        print(f"❌ Create checkout session error: {e}")
        return jsonify({'error': 'Internal server error'}), 500

# ==================== WEBHOOK ROUTES ====================

@app.route('/webhook', methods=['POST'])
def stripe_webhook():
    """Webhook Stripe pour les événements de paiement"""
    payload = request.data
    signature = request.headers.get('Stripe-Signature')
    
    try:
        # Vérifier la signature
        event = stripe_service.verify_webhook_signature(payload, signature)
        
        print(f"📥 Webhook received: {event['type']}")
        
        # Traiter l'événement
        if event['type'] == 'checkout.session.completed':
            session = event['data']['object']
            result = stripe_service.handle_checkout_completed(session)
            
            # Ajouter le membre au canal Telegram
            if result.get('success') and result.get('telegram_user_id'):
                try:
                    telegram_service.add_member_to_channel_sync(
                        page_id=result['page_id'],
                        telegram_user_id=result['telegram_user_id'],
                        email=result.get('customer_email', '')
                    )
                except Exception as e:
                    print(f"⚠️ Failed to add member to channel: {e}")
            
        elif event['type'] == 'payment_intent.payment_failed':
            payment_intent = event['data']['object']
            stripe_service.handle_payment_failed(payment_intent)
        
        return jsonify({'received': True})
        
    except Exception as e:
        print(f"❌ Webhook error: {e}")
        return jsonify({'error': str(e)}), 400

@app.route('/webhook/connect', methods=['POST'])
def stripe_connect_webhook():
    """Webhook Stripe Connect pour les événements de compte"""
    payload = request.data
    signature = request.headers.get('Stripe-Signature')
    
    try:
        # Utiliser le secret webhook Connect
        import stripe as stripe_module
        event = stripe_module.Webhook.construct_event(
            payload,
            signature,
            os.getenv('STRIPE_CONNECT_WEBHOOK_SECRET')
        )
        
        print(f"📥 Connect webhook received: {event['type']}")
        
        if event['type'] == 'account.updated':
            account = event['data']['object']
            user_id = account.get('metadata', {}).get('userId')
            
            if user_id:
                firebase_service.update_user(user_id, {
                    'stripeConnected': account.get('charges_enabled', False)
                })
        
        return jsonify({'received': True})
        
    except Exception as e:
        print(f"❌ Connect webhook error: {e}")
        return jsonify({'error': str(e)}), 400

# ==================== TELEGRAM ROUTES ====================

@app.route('/api/telegram/create-invite', methods=['POST'])
def create_telegram_invite():
    """Créer un lien d'invitation Telegram"""
    try:
        data = request.json
        page_id = data.get('page_id')
        
        if not page_id:
            return jsonify({'error': 'page_id is required'}), 400
        
        # Récupérer la page
        page = firebase_service.get_landing_page(page_id)
        if not page:
            return jsonify({'error': 'Page not found'}), 404
        
        channel_id = page.get('telegramChannelId')
        if not channel_id:
            return jsonify({'error': 'No channel connected'}), 400
        
        # Créer le lien
        result = telegram_service.create_invite_link_sync(
            channel_id=channel_id,
            expire_hours=data.get('expire_hours', 24),
            member_limit=data.get('member_limit', 1)
        )
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Create invite link error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/telegram/add-member', methods=['POST'])
def add_telegram_member():
    """Ajouter un membre à un canal après paiement"""
    try:
        data = request.json
        
        result = telegram_service.add_member_to_channel_sync(
            page_id=data.get('page_id'),
            telegram_user_id=data.get('telegram_user_id'),
            email=data.get('email', '')
        )
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Add member error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/telegram/remove-member', methods=['POST'])
def remove_telegram_member():
    """Retirer un membre d'un canal"""
    try:
        data = request.json
        
        result = telegram_service.remove_member_from_channel_sync(
            page_id=data.get('page_id'),
            telegram_user_id=data.get('telegram_user_id')
        )
        
        return jsonify(result)
        
    except Exception as e:
        print(f"❌ Remove member error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/telegram/channel-info', methods=['GET'])
def get_channel_info():
    """Récupérer les informations d'un canal"""
    try:
        channel_id = request.args.get('channel_id')
        if not channel_id:
            return jsonify({'error': 'channel_id is required'}), 400
        
        info = telegram_service.get_channel_info_sync(channel_id)
        if not info:
            return jsonify({'error': 'Channel not found or bot not admin'}), 404
        
        return jsonify(info)
        
    except Exception as e:
        print(f"❌ Get channel info error: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== EMAIL ROUTES ====================

@app.route('/api/emails/list/<creator_id>')
def list_emails(creator_id):
    """Lister les emails d'un créateur"""
    try:
        limit = request.args.get('limit', 100, type=int)
        emails = firebase_service.get_emails_by_creator(creator_id, limit=limit)
        
        return jsonify({
            'emails': emails,
            'count': len(emails)
        })
        
    except Exception as e:
        print(f"❌ List emails error: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/emails/collect', methods=['POST'])
def collect_email():
    """Collecter un email"""
    try:
        data = request.json
        
        email_id = firebase_service.collect_email({
            'email': data.get('email'),
            'creatorId': data.get('creator_id'),
            'pageId': data.get('page_id'),
            'source': data.get('source', 'api'),
            'amount': data.get('amount', 0),
            'currency': data.get('currency', 'EUR')
        })
        
        return jsonify({
            'success': True,
            'email_id': email_id
        })
        
    except Exception as e:
        print(f"❌ Collect email error: {e}")
        return jsonify({'error': str(e)}), 500

# ==================== SUCCESS/CANCEL PAGES ====================

@app.route('/success')
def success_page():
    """Page de succès après paiement"""
    session_id = request.args.get('session_id')
    
    # Optionnel: récupérer les détails de la session
    # session = stripe_service.get_checkout_session(session_id)
    
    return get_success_html(config.BOT_USERNAME)

@app.route('/cancel')
def cancel_page():
    """Page d'annulation"""
    return get_cancel_html()

# ==================== ERROR HANDLERS ====================

@app.errorhandler(404)
def not_found(e):
    """Handler 404"""
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Not found'}), 404
    return get_error_html('Page not found', '404'), 404

@app.errorhandler(500)
def internal_error(e):
    """Handler 500"""
    print(f"❌ Internal error: {e}")
    if request.path.startswith('/api/'):
        return jsonify({'error': 'Internal server error'}), 500
    return get_error_html('Internal server error', '500'), 500

# ==================== MAIN ====================

if __name__ == '__main__':
    # Valider et afficher la configuration
    config.validate()
    config.print_config()
    
    print(f"\n🚀 Starting MAKERHUB Python service on port {config.PORT}...")
    
    # Démarrer le serveur
    app.run(
        host=config.HOST,
        port=config.PORT,
        debug=config.DEBUG
    )
