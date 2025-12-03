const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const currencyService = require('../services/currencyService');
const { toStripeAmount, calculatePlatformFee } = require('../utils/currencyUtils');
const admin = require('firebase-admin');
const db = admin.firestore();

exports.createCheckoutSession = async (req, res) => {
  try {
    const { 
      pageId, 
      priceId, 
      currency, 
      successUrl, 
      cancelUrl,
      customerEmail,
      metadata 
    } = req.body;
    
    // Récupérer les informations de la page
    const pageDoc = await db.collection('pages').doc(pageId).get();
    if (!pageDoc.exists) {
      return res.status(404).json({ error: 'Page not found' });
    }
    
    const pageData = pageDoc.data();
    
    // Configuration de la session Checkout
    const sessionConfig = {
      payment_method_types: ['card'],
      line_items: [{
        price: priceId,
        quantity: 1
      }],
      mode: 'subscription',
      success_url: successUrl || `${process.env.DOMAIN}/public/success.html?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.DOMAIN}/public/cancel.html`,
      customer_email: customerEmail,
      metadata: {
        pageId,
        currency,
        ...metadata
      },
      subscription_data: {
        metadata: {
          pageId,
          currency
        }
      }
    };
    
    // Si Stripe Connect est configuré pour cette page
    if (pageData.stripeAccountId) {
      const amount = await this.getPriceAmount(priceId);
      const platformFee = calculatePlatformFee(amount);
      
      sessionConfig.payment_intent_data = {
        application_fee_amount: toStripeAmount(platformFee, currency),
        transfer_data: {
          destination: pageData.stripeAccountId
        }
      };
    }
    
    // Créer la session
    const session = await stripe.checkout.sessions.create(sessionConfig);
    
    // Enregistrer la tentative de checkout
    await db.collection('checkout_attempts').add({
      sessionId: session.id,
      pageId,
      currency,
      status: 'pending',
      createdAt: new Date(),
      metadata
    });
    
    res.json({
      id: session.id,
      url: session.url
    });
    
  } catch (error) {
    console.error('Checkout session error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createPricesForAllCurrencies = async (req, res) => {
  try {
    const { productName, basePriceUSD, interval = 'month' } = req.body;
    
    // Créer le produit Stripe
    const product = await stripe.products.create({
      name: productName,
      metadata: {
        createdAt: new Date().toISOString()
      }
    });
    
    // Créer les prix pour toutes les devises
    const prices = await currencyService.createMultiCurrencyPrices(
      product.id,
      basePriceUSD,
      interval
    );
    
    // Sauvegarder dans Firebase
    await db.collection('products').doc(product.id).set({
      productId: product.id,
      name: productName,
      basePriceUSD,
      interval,
      prices,
      createdAt: new Date()
    });
    
    res.json({
      productId: product.id,
      prices
    });
    
  } catch (error) {
    console.error('Create prices error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getPrices = async (req, res) => {
  try {
    const { productId } = req.params;
    const { currency } = req.query;
    
    // Récupérer depuis Firebase
    const productDoc = await db.collection('products').doc(productId).get();
    
    if (!productDoc.exists) {
      return res.status(404).json({ error: 'Product not found' });
    }
    
    const productData = productDoc.data();
    
    if (currency) {
      // Retourner le prix pour une devise spécifique
      const price = productData.prices[currency];
      if (!price) {
        return res.status(404).json({ error: 'Price not found for this currency' });
      }
      res.json(price);
    } else {
      // Retourner tous les prix
      res.json(productData.prices);
    }
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.createPortalSession = async (req, res) => {
  try {
    const { customerId } = req.body;
    
    const session = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${process.env.DOMAIN}/public/dashboard.html`
    });
    
    res.json({ url: session.url });
    
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Webhook signature verification failed:', err);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }
  
  // Gérer les différents types d'événements
  switch (event.type) {
    case 'checkout.session.completed':
      await this.handleCheckoutComplete(event.data.object);
      break;
      
    case 'customer.subscription.created':
      await this.handleSubscriptionCreated(event.data.object);
      break;
      
    case 'customer.subscription.updated':
      await this.handleSubscriptionUpdated(event.data.object);
      break;
      
    case 'customer.subscription.deleted':
      await this.handleSubscriptionDeleted(event.data.object);
      break;
      
    case 'invoice.payment_succeeded':
      await this.handlePaymentSucceeded(event.data.object);
      break;
      
    case 'invoice.payment_failed':
      await this.handlePaymentFailed(event.data.object);
      break;
      
    default:
      console.log(`Unhandled event type ${event.type}`);
  }
  
  res.json({ received: true });
};

// Méthodes privées pour gérer les événements
exports.handleCheckoutComplete = async (session) => {
  try {
    const { pageId, currency } = session.metadata;
    
    // Mettre à jour le statut du checkout
    const checkoutQuery = await db.collection('checkout_attempts')
      .where('sessionId', '==', session.id)
      .limit(1)
      .get();
    
    if (!checkoutQuery.empty) {
      const checkoutDoc = checkoutQuery.docs[0];
      await checkoutDoc.ref.update({
        status: 'completed',
        completedAt: new Date(),
        customerId: session.customer,
        subscriptionId: session.subscription
      });
    }
    
    // Créer l'enregistrement de l'abonnement
    await db.collection('subscriptions').add({
      userId: session.client_reference_id,
      pageId,
      stripeCustomerId: session.customer,
      stripeSubscriptionId: session.subscription,
      currency,
      status: 'active',
      createdAt: new Date()
    });
    
    console.log('✅ Checkout completed:', session.id);
    
  } catch (error) {
    console.error('Error handling checkout complete:', error);
  }
};

exports.handleSubscriptionCreated = async (subscription) => {
  try {
    const { pageId, currency } = subscription.metadata;
    
    // Mettre à jour ou créer l'enregistrement
    await db.collection('subscriptions').doc(subscription.id).set({
      stripeSubscriptionId: subscription.id,
      stripeCustomerId: subscription.customer,
      pageId,
      currency,
      status: subscription.status,
      currentPeriodStart: new Date(subscription.current_period_start * 1000),
      currentPeriodEnd: new Date(subscription.current_period_end * 1000),
      cancelAtPeriodEnd: subscription.cancel_at_period_end,
      createdAt: new Date()
    }, { merge: true });
    
    console.log('✅ Subscription created:', subscription.id);
    
  } catch (error) {
    console.error('Error handling subscription created:', error);
  }
};

// Helper pour obtenir le montant d'un prix
exports.getPriceAmount = async (priceId) => {
  try {
    const price = await stripe.prices.retrieve(priceId);
    return price.unit_amount / 100; // Convertir depuis les centimes
  } catch (error) {
    console.error('Error retrieving price:', error);
    return 0;
  }
};