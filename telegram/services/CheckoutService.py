import stripe
import os
from datetime import datetime
from config.database import db
import firebase_admin
from firebase_admin import firestore
import logging

logger = logging.getLogger(__name__)

class CheckoutService:
    def __init__(self):
        stripe.api_key = os.getenv('STRIPE_SECRET_KEY')
        self.db = db
        
    def create_multi_currency_prices(self, product_id, base_price_usd, interval='month'):
        """Créer des prix pour toutes les devises"""
        from services.CurrencyService import CurrencyService
        currency_service = CurrencyService()
        
        prices = {}
        supported_currencies = os.getenv('SUPPORTED_CURRENCIES', 'USD,EUR,GBP,JPY,AUD,CAD,CHF,CNY,SGD,SEK,NOK,KRW,BRL').split(',')
        
        for currency in supported_currencies:
            try:
                # Convertir le prix
                amount = currency_service.convert_from_usd(base_price_usd, currency)
                
                # Créer le prix dans Stripe
                price = stripe.Price.create(
                    product=product_id,
                    unit_amount=int(amount * 100),  # En centimes
                    currency=currency.lower(),
                    recurring={'interval': interval} if interval else None
                )
                
                prices[currency] = {
                    'priceId': price.id,
                    'amount': amount,
                    'formatted': currency_service.format_amount(amount, currency)
                }
                
            except Exception as e:
                logger.error(f"Error creating price for {currency}: {e}")
        
        return prices
    
    def get_price_amount(self, price_id):
        """Obtenir le montant d'un prix"""
        try:
            price = stripe.Price.retrieve(price_id)
            return price.unit_amount / 100
        except Exception as e:
            logger.error(f"Error retrieving price: {e}")
            return 0
    
    def create_product(self, name, description=None):
        """Créer un produit Stripe"""
        try:
            product = stripe.Product.create(
                name=name,
                description=description,
                metadata={
                    'createdAt': datetime.now().isoformat()
                }
            )
            return product
        except Exception as e:
            logger.error(f"Error creating product: {e}")
            return None
    
    def save_product_to_firebase(self, product_id, name, base_price_usd, prices, interval='month'):
        """Sauvegarder produit dans Firebase"""
        try:
            self.db.collection('products').document(product_id).set({
                'productId': product_id,
                'name': name,
                'basePriceUSD': base_price_usd,
                'interval': interval,
                'prices': prices,
                'createdAt': firestore.SERVER_TIMESTAMP,
                'updatedAt': firestore.SERVER_TIMESTAMP
            })
            logger.info(f"✅ Product saved to Firebase: {product_id}")
        except Exception as e:
            logger.error(f"Error saving product to Firebase: {e}")
    
    def create_checkout_session(self, creator_id, offer_data, customer_email=None, customer_telegram_id=None, landing_page_id=None):
        """Créer une session de checkout Stripe avec collecte d'email"""
        try:
            # Récupérer les informations du créateur
            creator_doc = self.db.collection("creators").document(creator_id).get()
            if not creator_doc.exists:
                raise Exception("Creator not found")
            
            creator_data = creator_doc.to_dict()
            stripe_account_id = creator_data.get("stripe_account_id")
            
            if not stripe_account_id:
                raise Exception("Stripe Connect account not configured")
            
            # Préparer les données de la session
            amount = int(float(offer_data.get("amount", 0)) * 100)  # En centimes
            currency = offer_data.get("currency", "eur")
            description = offer_data.get("description", f"Accès premium {creator_data.get('brand_name', '')}")
            
            # Calculer la commission (5%)
            application_fee_amount = int(amount * 0.05)
            
            # Configuration de la session
            session_params = {
                'payment_method_types': ['card'],
                'line_items': [{
                    'price_data': {
                        'currency': currency,
                        'unit_amount': amount,
                        'product_data': {
                            'name': description,
                            'description': f"Accès premium au canal de {creator_data.get('brand_name', 'ce créateur')}"
                        },
                    },
                    'quantity': 1,
                }],
                'mode': 'payment',
                'success_url': f"{os.getenv('BASE_URL')}/success?session_id={{CHECKOUT_SESSION_ID}}&creator_id={creator_id}",
                'cancel_url': f"{os.getenv('BASE_URL')}/c/{creator_id}",
                'payment_intent_data': {
                    "application_fee_amount": application_fee_amount,
                    "transfer_data": {
                        "destination": stripe_account_id,
                    }
                },
                'metadata': {
                    "creator_id": creator_id,
                    "creator_name": creator_data.get('brand_name', ''),
                    "channel_id": creator_data.get('channel_id', ''),
                    "landing_page_id": landing_page_id or creator_id,  # Pour tracker la source
                    "telegram_user_id": str(customer_telegram_id) if customer_telegram_id else ""
                }
            }
            
            # Ajouter l'email si fourni
            if customer_email:
                session_params['customer_email'] = customer_email
            
            # Créer la session Stripe
            session = stripe.checkout.Session.create(**session_params)
            
            logger.info(f"✅ Checkout session created: {session.id} for creator {creator_id}")
            
            return {
                'success': True,
                'session_id': session.id,
                'url': session.url
            }
            
        except Exception as e:
            logger.error(f"Error creating checkout session: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def handle_checkout_completed(self, session):
        """Traiter une session de checkout complétée - inclut la collecte d'email"""
        try:
            # Extraire les données de la session
            customer_email = session.get('customer_email')
            customer_details = session.get('customer_details', {})
            metadata = session.get('metadata', {})
            amount_total = session.get('amount_total', 0) / 100
            currency = session.get('currency', 'eur')
            
            creator_id = metadata.get('creator_id')
            landing_page_id = metadata.get('landing_page_id', creator_id)
            telegram_user_id = metadata.get('telegram_user_id')
            
            # Sauvegarder la vente
            sale_data = {
                'created_at': firestore.SERVER_TIMESTAMP,
                'email': customer_email,
                'amount': amount_total,
                'currency': currency,
                'creator_id': creator_id,
                'stripe_session_id': session.get('id'),
                'stripe_payment_intent_id': session.get('payment_intent'),
                'telegram_user_id': telegram_user_id,
                'status': 'completed'
            }
            
            sale_ref = self.db.collection('sales').add(sale_data)
            logger.info(f"✅ Sale recorded: {sale_ref[1].id}")
            
            # COLLECTE D'EMAIL POUR V1
            if customer_email and creator_id:
                try:
                    # Sauvegarder dans collected_emails
                    email_data = {
                        'email': customer_email,
                        'customerName': customer_details.get('name', ''),
                        'creatorId': creator_id,
                        'landingPageId': landing_page_id,
                        'source': 'Stripe Checkout',
                        'stripeCustomerId': session.get('customer'),
                        'stripeSessionId': session.get('id'),
                        'saleId': sale_ref[1].id,
                        'amount': amount_total,
                        'currency': currency,
                        'createdAt': firestore.SERVER_TIMESTAMP,
                        'opens': 0,
                        'clicks': 0,
                        'status': 'active'
                    }
                    
                    # Vérifier si l'email existe déjà pour ce créateur
                    existing_emails = self.db.collection('collected_emails').where(
                        'email', '==', customer_email
                    ).where('creatorId', '==', creator_id).limit(1).get()
                    
                    if not list(existing_emails):
                        # Nouvel email, l'ajouter
                        email_ref = self.db.collection('collected_emails').add(email_data)
                        logger.info(f"✅ Email collected: {customer_email} (ID: {email_ref[1].id})")
                    else:
                        # Email existe déjà, mettre à jour la dernière transaction
                        for doc in existing_emails:
                            doc.reference.update({
                                'lastPurchaseAt': firestore.SERVER_TIMESTAMP,
                                'totalPurchases': firestore.Increment(1),
                                'totalAmount': firestore.Increment(amount_total)
                            })
                        logger.info(f"✅ Email updated: {customer_email}")
                    
                except Exception as email_error:
                    logger.error(f"❌ Error collecting email: {email_error}")
            
            return {
                'success': True,
                'sale_id': sale_ref[1].id,
                'customer_email': customer_email,
                'amount': amount_total
            }
            
        except Exception as e:
            logger.error(f"Error handling checkout completion: {e}")
            return {
                'success': False,
                'error': str(e)
            }
    
    def create_payment_link(self, creator_id, amount, currency='eur', description=None):
        """Créer un lien de paiement Stripe"""
        try:
            # Récupérer les infos du créateur
            creator_doc = self.db.collection("creators").document(creator_id).get()
            if not creator_doc.exists:
                raise Exception("Creator not found")
            
            creator_data = creator_doc.to_dict()
            stripe_account_id = creator_data.get("stripe_account_id")
            
            if not stripe_account_id:
                raise Exception("Stripe Connect account not configured")
            
            # Créer le lien de paiement
            payment_link = stripe.PaymentLink.create(
                line_items=[{
                    'price_data': {
                        'currency': currency,
                        'unit_amount': int(amount * 100),
                        'product_data': {
                            'name': description or f"Paiement à {creator_data.get('brand_name', 'créateur')}",
                        },
                    },
                    'quantity': 1,
                }],
                metadata={
                    'creator_id': creator_id,
                    'creator_name': creator_data.get('brand_name', '')
                },
                after_completion={
                    'type': 'redirect',
                    'redirect': {
                        'url': f"{os.getenv('BASE_URL')}/success"
                    }
                },
                payment_intent_data={
                    'application_fee_amount': int(amount * 100 * 0.05),  # 5% commission
                    'transfer_data': {
                        'destination': stripe_account_id
                    }
                }
            )
            
            logger.info(f"✅ Payment link created: {payment_link.id}")
            return payment_link.url
            
        except Exception as e:
            logger.error(f"Error creating payment link: {e}")
            return None
    
    def get_checkout_session(self, session_id):
        """Récupérer une session de checkout"""
        try:
            session = stripe.checkout.Session.retrieve(session_id)
            return session
        except Exception as e:
            logger.error(f"Error retrieving checkout session: {e}")
            return None
    
    def list_creator_sales(self, creator_id, limit=100):
        """Lister les ventes d'un créateur"""
        try:
            sales = self.db.collection("sales").where(
                "creator_id", "==", creator_id
            ).order_by("created_at", direction=firestore.Query.DESCENDING).limit(limit).stream()
            
            sales_list = []
            for doc in sales:
                sale_data = doc.to_dict()
                sale_data['id'] = doc.id
                if 'created_at' in sale_data and sale_data['created_at']:
                    sale_data['created_at'] = sale_data['created_at'].isoformat() if hasattr(sale_data['created_at'], 'isoformat') else str(sale_data['created_at'])
                sales_list.append(sale_data)
            
            return sales_list
            
        except Exception as e:
            logger.error(f"Error listing creator sales: {e}")
            return []

# Instance globale du service
checkout_service = CheckoutService()