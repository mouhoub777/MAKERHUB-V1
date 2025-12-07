// backend/routes/subscriptionRoutes.js - Abonnements Plans MAKERHUB
const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Middleware auth
const requireAuth = require('../middleware/auth');

// Prix des plans (depuis Stripe Dashboard)
const PLAN_PRICES = {
  pro: process.env.STRIPE_PRICE_PRO || 'price_1Sbf2506TGk6bCT5OKG5DrIY',
  business: process.env.STRIPE_PRICE_BUSINESS || 'price_1Sbf3N06TGk6bCT5SoImx3oG'
};

// Commissions par plan
const PLAN_COMMISSIONS = {
  freemium: 10,  // 10%
  pro: 4,        // 4%
  business: 2    // 2%
};

// POST /api/subscription/create-checkout - Créer session Stripe Checkout pour abonnement
router.post('/create-checkout', requireAuth, async (req, res) => {
  try {
    const { plan } = req.body;
    const userId = req.user.uid;
    const userEmail = req.user.email;

    console.log('💳 Création abonnement pour:', { userId, userEmail, plan });

    // Valider le plan
    if (!plan || !['pro', 'business'].includes(plan.toLowerCase())) {
      return res.status(400).json({
        success: false,
        error: 'Plan invalide. Choisissez "pro" ou "business"'
      });
    }

    const priceId = PLAN_PRICES[plan.toLowerCase()];

    if (!priceId) {
      return res.status(400).json({
        success: false,
        error: 'Price ID non configuré pour ce plan'
      });
    }

    // Vérifier si l'utilisateur a déjà un abonnement actif
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();

    const userData = userDoc.data() || {};

    if (userData.subscriptionStatus === 'active' && userData.plan === plan.toLowerCase()) {
      return res.status(400).json({
        success: false,
        error: 'Vous avez déjà un abonnement actif à ce plan'
      });
    }

    // Créer ou récupérer le customer Stripe
    let customerId = userData.stripeCustomerId;

    if (!customerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: {
          firebaseUserId: userId
        }
      });
      customerId = customer.id;

      // Sauvegarder le customer ID
      await admin.firestore()
        .collection('users')
        .doc(userId)
        .set({ stripeCustomerId: customerId }, { merge: true });
    }

    // URL de base
    const baseUrl = process.env.BASE_URL || `https://${req.get('host')}`;

    // Créer la session Checkout
    const session = await stripe.checkout.sessions.create({
      customer: customerId,
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [
        {
          price: priceId,
          quantity: 1
        }
      ],
      metadata: {
        userId: userId,
        plan: plan.toLowerCase(),
        type: 'makerhub_subscription'
      },
      subscription_data: {
        metadata: {
          userId: userId,
          plan: plan.toLowerCase()
        }
      },
      success_url: `${baseUrl}/plans.html?success=true&plan=${plan}`,
      cancel_url: `${baseUrl}/plans.html?canceled=true`,
      allow_promotion_codes: true
    });

    console.log('✅ Session Checkout créée:', session.id);

    res.json({
      success: true,
      sessionId: session.id,
      url: session.url
    });

  } catch (error) {
    console.error('❌ Erreur création abonnement:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/subscription/webhook - Webhook pour les événements subscription
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const webhookSecret = process.env.STRIPE_SUBSCRIPTION_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
  } catch (error) {
    console.error('❌ Erreur signature webhook:', error.message);
    return res.status(400).json({ error: 'Signature invalide' });
  }

  console.log('🔔 Webhook subscription reçu:', event.type);

  try {
    switch (event.type) {
      case 'checkout.session.completed':
        await handleCheckoutCompleted(event.data.object);
        break;

      case 'customer.subscription.created':
        await handleSubscriptionCreated(event.data.object);
        break;

      case 'customer.subscription.updated':
        await handleSubscriptionUpdated(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await handleSubscriptionDeleted(event.data.object);
        break;

      case 'invoice.payment_succeeded':
        await handleInvoicePaymentSucceeded(event.data.object);
        break;

      case 'invoice.payment_failed':
        await handleInvoicePaymentFailed(event.data.object);
        break;

      default:
        console.log('⚠️ Événement non géré:', event.type);
    }

    res.json({ received: true });

  } catch (error) {
    console.error('❌ Erreur traitement webhook:', error);
    res.status(500).json({ error: 'Erreur traitement webhook' });
  }
});

// GET /api/subscription/status - Statut de l'abonnement
router.get('/status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;

    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();

    const userData = userDoc.data() || {};

    res.json({
      success: true,
      plan: userData.plan || 'freemium',
      status: userData.subscriptionStatus || 'inactive',
      commission: PLAN_COMMISSIONS[userData.plan || 'freemium'],
      subscriptionId: userData.stripeSubscriptionId || null,
      currentPeriodEnd: userData.subscriptionPeriodEnd || null
    });

  } catch (error) {
    console.error('❌ Erreur récupération statut:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/subscription/cancel - Annuler l'abonnement
router.post('/cancel', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;

    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();

    const userData = userDoc.data() || {};
    const subscriptionId = userData.stripeSubscriptionId;

    if (!subscriptionId) {
      return res.status(400).json({
        success: false,
        error: 'Aucun abonnement actif'
      });
    }

    // Annuler à la fin de la période
    const subscription = await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true
    });

    await admin.firestore()
      .collection('users')
      .doc(userId)
      .update({
        subscriptionCancelAtPeriodEnd: true,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

    console.log('✅ Abonnement annulé:', subscriptionId);

    res.json({
      success: true,
      message: 'Abonnement annulé. Actif jusqu\'à la fin de la période.',
      cancelAt: subscription.cancel_at
    });

  } catch (error) {
    console.error('❌ Erreur annulation:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/subscription/portal - Accès au portail client Stripe
router.post('/portal', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;

    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();

    const userData = userDoc.data() || {};
    const customerId = userData.stripeCustomerId;

    if (!customerId) {
      return res.status(400).json({
        success: false,
        error: 'Aucun compte client Stripe'
      });
    }

    const baseUrl = process.env.BASE_URL || `https://${req.get('host')}`;

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: `${baseUrl}/plans.html`
    });

    res.json({
      success: true,
      url: portalSession.url
    });

  } catch (error) {
    console.error('❌ Erreur portail:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// === HANDLERS WEBHOOK ===

async function handleCheckoutCompleted(session) {
  console.log('✅ Checkout completed:', session.id);

  const userId = session.metadata?.userId;
  const plan = session.metadata?.plan;

  if (!userId || !plan) {
    console.error('❌ Metadata manquante dans session');
    return;
  }

  // La subscription sera gérée par customer.subscription.created
  console.log(`📝 Checkout pour user ${userId}, plan ${plan}`);
}

async function handleSubscriptionCreated(subscription) {
  console.log('✅ Subscription created:', subscription.id);

  const userId = subscription.metadata?.userId;
  const plan = subscription.metadata?.plan;

  if (!userId) {
    console.error('❌ userId manquant dans metadata subscription');
    return;
  }

  await admin.firestore()
    .collection('users')
    .doc(userId)
    .update({
      plan: plan || 'pro',
      stripeSubscriptionId: subscription.id,
      subscriptionStatus: subscription.status,
      subscriptionPeriodEnd: new Date(subscription.current_period_end * 1000),
      commission: PLAN_COMMISSIONS[plan || 'pro'],
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

  console.log(`✅ User ${userId} upgraded to ${plan}`);
}

async function handleSubscriptionUpdated(subscription) {
  console.log('🔄 Subscription updated:', subscription.id);

  const userId = subscription.metadata?.userId;

  if (!userId) return;

  await admin.firestore()
    .collection('users')
    .doc(userId)
    .update({
      subscriptionStatus: subscription.status,
      subscriptionPeriodEnd: new Date(subscription.current_period_end * 1000),
      subscriptionCancelAtPeriodEnd: subscription.cancel_at_period_end,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
}

async function handleSubscriptionDeleted(subscription) {
  console.log('❌ Subscription deleted:', subscription.id);

  const userId = subscription.metadata?.userId;

  if (!userId) return;

  await admin.firestore()
    .collection('users')
    .doc(userId)
    .update({
      plan: 'freemium',
      stripeSubscriptionId: null,
      subscriptionStatus: 'canceled',
      subscriptionPeriodEnd: null,
      commission: PLAN_COMMISSIONS.freemium,
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });

  console.log(`✅ User ${userId} downgraded to freemium`);
}

async function handleInvoicePaymentSucceeded(invoice) {
  console.log('💰 Invoice payment succeeded:', invoice.id);

  // Log pour suivi des revenus
  if (invoice.subscription) {
    await admin.firestore()
      .collection('subscription_payments')
      .add({
        invoiceId: invoice.id,
        subscriptionId: invoice.subscription,
        customerId: invoice.customer,
        amount: invoice.amount_paid / 100,
        currency: invoice.currency,
        paidAt: new Date(),
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
  }
}

async function handleInvoicePaymentFailed(invoice) {
  console.log('❌ Invoice payment failed:', invoice.id);

  // TODO: Envoyer email de notification
  // TODO: Mettre à jour le statut utilisateur
}

// GET /api/subscription/health
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'MAKERHUB Subscription Routes',
    plans: Object.keys(PLAN_PRICES),
    timestamp: new Date().toISOString()
  });
});

console.log(`
💳 MAKERHUB Subscription Routes
================================
POST   /api/subscription/create-checkout  - Créer checkout abonnement
POST   /api/subscription/webhook          - Webhook Stripe
GET    /api/subscription/status           - Statut abonnement
POST   /api/subscription/cancel           - Annuler abonnement
POST   /api/subscription/portal           - Portail client Stripe
GET    /api/subscription/health           - Health check

Plans configurés:
- Pro: ${PLAN_PRICES.pro}
- Business: ${PLAN_PRICES.business}
`);

module.exports = router;