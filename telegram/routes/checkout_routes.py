from flask import Blueprint, request, jsonify
from controllers.CheckoutController import CheckoutController
import stripe
import os

checkout_bp = Blueprint('checkout', __name__)
checkout_controller = CheckoutController()

# Configuration Stripe raw body pour webhooks
stripe.api_key = os.getenv('STRIPE_SECRET_KEY')

@checkout_bp.route('/create-session', methods=['POST'])
def create_checkout_session():
    """Créer une session Stripe Checkout"""
    return checkout_controller.create_checkout_session(request)

@checkout_bp.route('/prices/<product_id>', methods=['GET'])
def get_prices(product_id):
    """Obtenir les prix multi-devises"""
    return checkout_controller.get_prices(product_id, request)

@checkout_bp.route('/customer-portal', methods=['POST'])
def create_portal_session():
    """Créer une session portail client"""
    return checkout_controller.create_portal_session(request)

@checkout_bp.route('/webhook', methods=['POST'])
def stripe_webhook():
    """Webhook Stripe avec body RAW"""
    payload = request.data  # RAW body
    sig_header = request.headers.get('Stripe-Signature')
    
    try:
        event = stripe.Webhook.construct_event(
            payload, sig_header, os.getenv('STRIPE_WEBHOOK_SECRET')
        )
        return checkout_controller.handle_webhook(event)
    except ValueError:
        return jsonify({'error': 'Invalid payload'}), 400
    except stripe.error.SignatureVerificationError:
        return jsonify({'error': 'Invalid signature'}), 400