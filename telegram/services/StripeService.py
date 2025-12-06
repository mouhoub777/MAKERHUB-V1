# telegram/services/StripeService.py
"""
Service Stripe pour le service Python MAKERHUB V1
"""

import os
import stripe
import logging
from datetime import datetime

logger = logging.getLogger(__name__)

stripe.api_key = os.getenv('STRIPE_SECRET_KEY')


class StripeService:
    """Service Stripe pour les paiements et checkout"""
    
    def __init__(self):
        self.api_key = os.getenv('STRIPE_SECRET_KEY')
        self.webhook_secret = os.getenv('STRIPE_WEBHOOK_SECRET')
        self.connect_webhook_secret = os.getenv('STRIPE_CONNECT_WEBHOOK_SECRET')
        self.platform_fee = float(os.getenv('PLATFORM_FEE_PERCENTAGE', 5))
        self.base_url = os.getenv('BASE_URL', 'http://localhost:3000')
        
        stripe.api_key = self.api_key
    
    def check_connection(self):
        """Vérifie la connexion à Stripe"""
        try:
            stripe.Account.retrieve()
            return {'status': 'ok', 'service': 'stripe'}
        except Exception as e:
            logger.error(f"Stripe connection error: {e}")
            return {'status': 'error', 'service': 'stripe', 'error': str(e)}
    
    def create_checkout_session(self, page_id, price_index=0, customer_email=None, telegram_user_id=None):
        """Crée une session Stripe Checkout"""
        from services.FirebaseService import firebase_service
        
        try:
            page = firebase_service.get_landing_page(page_id)
            if not page:
                raise ValueError(f"Landing page not found: {page_id}")
            
            creator_id = page.get('userId') or page.get('creatorId')
            creator = firebase_service.get_user(creator_id) or firebase_service.get_creator(creator_id)
            
            if not creator:
                raise ValueError(f"Creator not found: {creator_id}")
            
            stripe_account_id = creator.get('stripeAccountId')
            if not stripe_account_id:
                raise ValueError("Creator has no Stripe account connected")
            
            prices = page.get('prices', [])
            if not prices:
                raise ValueError("No prices configured for this page")
            
            selected_price = prices[price_index] if price_index < len(prices) else prices[0]
            amount = int(float(selected_price.get('amount', 0)) * 100)
            currency = selected_price.get('currency', 'eur').lower()
            
            if amount <= 0:
                raise ValueError("Invalid price amount")
            
            application_fee = int(amount * (self.platform_fee / 100))
            
            metadata = {
                'page_id': page_id,
                'creator_id': creator_id,
                'price_index': str(price_index),
            }
            
            if telegram_user_id:
                metadata['telegram_user_id'] = str(telegram_user_id)
            
            session_params = {
                'payment_method_types': ['card'],
                'line_items': [{
                    'price_data': {
                        'currency': currency,
                        'unit_amount': amount,
                        'product_data': {
                            'name': page.get('title') or page.get('channelName') or 'Premium Access',
                            'description': selected_price.get('description', 'Access to premium content'),
                        },
                    },
                    'quantity': 1,
                }],
                'mode': 'payment',
                'success_url': f"{self.base_url}/success?session_id={{CHECKOUT_SESSION_ID}}&page_id={page_id}",
                'cancel_url': f"{self.base_url}/cancel?page_id={page_id}",
                'metadata': metadata,
                'payment_intent_data': {
                    'application_fee_amount': application_fee,
                    'transfer_data': {
                        'destination': stripe_account_id,
                    },
                    'metadata': metadata,
                },
            }
            
            if customer_email:
                session_params['customer_email'] = customer_email
            
            session = stripe.checkout.Session.create(**session_params)
            
            logger.info(f"✅ Checkout session created: {session.id}")
            
            return {
                'success': True,
                'session_id': session.id,
                'url': session.url
            }
            
        except ValueError as e:
            logger.error(f"Validation error: {e}")
            raise
        except Exception as e:
            logger.error(f"Error creating checkout session: {e}")
            raise
    
    def verify_webhook_signature(self, payload, signature):
        """Vérifie la signature d'un webhook Stripe"""
        try:
            event = stripe.Webhook.construct_event(
                payload, signature, self.webhook_secret
            )
            return event
        except stripe.error.SignatureVerificationError as e:
            logger.error(f"Webhook signature verification failed: {e}")
            raise
        except Exception as e:
            logger.error(f"Webhook error: {e}")
            raise
    
    def handle_checkout_completed(self, session):
        """Traite une session de checkout complétée"""
        from services.FirebaseService import firebase_service
        
        try:
            customer_email = session.get('customer_email')
            customer_details = session.get('customer_details', {})
            metadata = session.get('metadata', {})
            amount_total = session.get('amount_total', 0) / 100
            currency = session.get('currency', 'eur')
            
            page_id = metadata.get('page_id')
            creator_id = metadata.get('creator_id')
            telegram_user_id = metadata.get('telegram_user_id')
            
            sale_data = {
                'email': customer_email,
                'customerName': customer_details.get('name', ''),
                'amount': amount_total,
                'currency': currency,
                'creatorId': creator_id,
                'pageId': page_id,
                'stripeSessionId': session.get('id'),
                'stripePaymentIntentId': session.get('payment_intent'),
                'telegramUserId': telegram_user_id,
                'status': 'completed',
                'source': 'Stripe Checkout'
            }
            
            sale_id = firebase_service.save_sale(sale_data)
            
            if customer_email and creator_id:
                if not firebase_service.email_exists(customer_email, creator_id):
                    email_data = {
                        'email': customer_email,
                        'customerName': customer_details.get('name', ''),
                        'creatorId': creator_id,
                        'landingPageId': page_id,
                        'source': 'Stripe Checkout',
                        'stripeCustomerId': session.get('customer'),
                        'amount': amount_total,
                        'currency': currency,
                    }
                    firebase_service.save_collected_email(email_data)
            
            logger.info(f"✅ Checkout completed: {session.get('id')}")
            
            return {
                'success': True,
                'sale_id': sale_id,
                'customer_email': customer_email,
                'amount': amount_total,
                'page_id': page_id,
                'telegram_user_id': telegram_user_id
            }
            
        except Exception as e:
            logger.error(f"Error handling checkout completed: {e}")
            return {'success': False, 'error': str(e)}
    
    def handle_payment_failed(self, payment_intent):
        """Traite un paiement échoué"""
        try:
            metadata = payment_intent.get('metadata', {})
            logger.warning(f"⚠️ Payment failed: {payment_intent.get('id')}")
            return {'success': True, 'status': 'payment_failed'}
        except Exception as e:
            logger.error(f"Error handling payment failed: {e}")
            return {'success': False, 'error': str(e)}


stripe_service = StripeService()