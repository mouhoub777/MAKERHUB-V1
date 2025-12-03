import stripe
import os
from datetime import datetime
from services.CheckoutService import CheckoutService
from services.CurrencyService import CurrencyService
from config.database import db
import json

class CheckoutController:
    def __init__(self):
        self.checkout_service = CheckoutService()
        self.currency_service = CurrencyService()
        stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
    
    def create_checkout_session(self, request):
        """Créer une session de paiement Stripe"""
        try:
            data = request.get_json()
            
            # Données requises
            page_id = data.get('pageId')
            price_id = data.get('priceId')
            currency = data.get('currency', 'USD')
            success_url = data.get('successUrl', os.getenv('SUCCESS_URL'))
            cancel_url = data.get('cancelUrl', os.getenv('CANCEL_URL'))
            customer_email = data.get('customerEmail')
            metadata = data.get('metadata', {})
            
            # Récupérer les infos de la page
            page_ref = db.collection('pages').document(page_id)
            page = page_ref.get()
            
            if not page.exists:
                return {'error': 'Page not found'}, 404
            
            page_data = page.to_dict()
            
            # Configuration session
            session_config = {
                'payment_method_types': ['card'],
                'line_items': [{
                    'price': price_id,
                    'quantity': 1
                }],
                'mode': 'subscription',
                'success_url': f"{success_url}?session_id={{CHECKOUT_SESSION_ID}}",
                'cancel_url': cancel_url,
                'customer_email': customer_email,
                'metadata': {
                    'pageId': page_id,
                    'currency': currency,
                    **metadata
                },
                'subscription_data': {
                    'metadata': {
                        'pageId': page_id,
                        'currency': currency
                    }
                }
            }
            
            # Si Stripe Connect configuré
            if page_data.get('stripeAccountId'):
                amount = self.checkout_service.get_price_amount(price_id)
                platform_fee = self.currency_service.calculate_platform_fee(amount)
                
                session_config['payment_intent_data'] = {
                    'application_fee_amount': int(platform_fee * 100),
                    'transfer_data': {
                        'destination': page_data['stripeAccountId']
                    }
                }
            
            # Créer la session
            session = stripe.checkout.Session.create(**session_config)
            
            # Enregistrer la tentative
            db.collection('checkout_attempts').add({
                'sessionId': session.id,
                'pageId': page_id,
                'currency': currency,
                'status': 'pending',
                'createdAt': datetime.now(),
                'metadata': metadata
            })
            
            return {
                'id': session.id,
                'url': session.url
            }, 200
            
        except Exception as e:
            print(f"Checkout error: {e}")
            return {'error': str(e)}, 500
    
    def get_prices(self, product_id, request):
        """Obtenir les prix dans toutes les devises"""
        try:
            currency = request.args.get('currency')
            
            # Récupérer depuis Firebase
            product_ref = db.collection('products').document(product_id)
            product = product_ref.get()
            
            if not product.exists:
                return {'error': 'Product not found'}, 404
            
            product_data = product.to_dict()
            
            if currency:
                # Prix pour une devise spécifique
                price = product_data.get('prices', {}).get(currency)
                if not price:
                    return {'error': f'Price not found for {currency}'}, 404
                return price, 200
            else:
                # Tous les prix
                return product_data.get('prices', {}), 200
                
        except Exception as e:
            return {'error': str(e)}, 500
    
    def create_portal_session(self, request):
        """Créer session portail client"""
        try:
            data = request.get_json()
            customer_id = data.get('customerId')
            
            session = stripe.billing_portal.Session.create(
                customer=customer_id,
                return_url=f"{os.getenv('DOMAIN')}/public/dashboard.html"
            )
            
            return {'url': session.url}, 200
            
        except Exception as e:
            return {'error': str(e)}, 500
    
    def handle_webhook(self, event):
        """Gérer les webhooks Stripe"""
        try:
            # Router selon le type d'événement
            handlers = {
                'checkout.session.completed': self._handle_checkout_complete,
                'customer.subscription.created': self._handle_subscription_created,
                'customer.subscription.updated': self._handle_subscription_updated,
                'customer.subscription.deleted': self._handle_subscription_deleted,
                'invoice.payment_succeeded': self._handle_payment_succeeded,
                'invoice.payment_failed': self._handle_payment_failed
            }
            
            handler = handlers.get(event['type'])
            if handler:
                handler(event['data']['object'])
            else:
                print(f"Unhandled event type: {event['type']}")
            
            return {'received': True}, 200
            
        except Exception as e:
            print(f"Webhook error: {e}")
            return {'error': str(e)}, 500
    
    def _handle_checkout_complete(self, session):
        """Gérer checkout complété"""
        page_id = session['metadata'].get('pageId')
        currency = session['metadata'].get('currency')
        
        # Mettre à jour le statut
        attempts = db.collection('checkout_attempts')\
            .where('sessionId', '==', session['id'])\
            .limit(1)\
            .get()
        
        for attempt in attempts:
            attempt.reference.update({
                'status': 'completed',
                'completedAt': datetime.now(),
                'customerId': session['customer'],
                'subscriptionId': session['subscription']
            })
        
        # Créer l'abonnement
        db.collection('subscriptions').add({
            'userId': session.get('client_reference_id'),
            'pageId': page_id,
            'stripeCustomerId': session['customer'],
            'stripeSubscriptionId': session['subscription'],
            'currency': currency,
            'status': 'active',
            'createdAt': datetime.now()
        })
        
        print(f"✅ Checkout completed: {session['id']}")
    
    def _handle_subscription_created(self, subscription):
        """Gérer création abonnement"""
        page_id = subscription['metadata'].get('pageId')
        currency = subscription['metadata'].get('currency')
        
        db.collection('subscriptions').document(subscription['id']).set({
            'stripeSubscriptionId': subscription['id'],
            'stripeCustomerId': subscription['customer'],
            'pageId': page_id,
            'currency': currency,
            'status': subscription['status'],
            'currentPeriodStart': datetime.fromtimestamp(subscription['current_period_start']),
            'currentPeriodEnd': datetime.fromtimestamp(subscription['current_period_end']),
            'cancelAtPeriodEnd': subscription['cancel_at_period_end'],
            'createdAt': datetime.now()
        }, merge=True)
        
        print(f"✅ Subscription created: {subscription['id']}")