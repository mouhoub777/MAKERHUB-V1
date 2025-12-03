const express = require('express');
const router = express.Router();
const { stripe } = require('../../config/stripe'); // ✅ Chemin corrigé
const admin = require('firebase-admin');
const db = admin.firestore();

// Créer une session de checkout pour une landing page
router.post('/create-landing-checkout-session', async (req, res) => {
  try {
    const {
      pageId,
      priceId,
      customerEmail,
      successUrl,
      cancelUrl
    } = req.body;

    // Validation des paramètres
    if (!pageId || !priceId) {
      return res.status(400).json({
        success: false,
        message: 'Page ID et Price ID sont requis'
      });
    }

    // Récupérer les informations de la page
    const pageDoc = await db.collection('landing_pages').doc(pageId).get();
    if (!pageDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Page non trouvée'
      });
    }

    const pageData = pageDoc.data();
    const creatorId = pageData.creatorId;

    // Récupérer les informations du créateur
    const creatorDoc = await db.collection('creators').doc(creatorId).get();
    if (!creatorDoc.exists) {
      return res.status(404).json({
        success: false,
        message: 'Créateur non trouvé'
      });
    }

    const creatorData = creatorDoc.data();
    
    // Vérifier que le créateur a un compte Stripe actif
    if (!creatorData.stripe_account_id || !creatorData.payments_enabled) {
      return res.status(400).json({
        success: false,
        message: 'Le créateur n\'a pas encore configuré son compte de paiement'
      });
    }

    // Récupérer les détails du prix sélectionné
    const selectedPrice = pageData.prices?.find(p => p.id === priceId);
    if (!selectedPrice) {
      return res.status(404).json({
        success: false,
        message: 'Prix non trouvé'
      });
    }

    // Calculer la commission (10% par défaut)
    const commissionPercent = creatorData.commission_percent || 10;
    const amount = parseFloat(selectedPrice.discountPrice || selectedPrice.price) * 100; // Convertir en centimes
    const commissionAmount = Math.round(amount * (commissionPercent / 100));

    // Créer les line items
    const lineItems = [{
      price_data: {
        currency: 'eur',
        product_data: {
          name: pageData.brand || 'Accès Premium',
          description: `${selectedPrice.period === 'month' ? 'Mensuel' : 
                       selectedPrice.period === 'year' ? 'Annuel' : 
                       selectedPrice.period === 'week' ? 'Hebdomadaire' : 
                       'Accès ' + selectedPrice.period}`,
          images: pageData.logoUrl ? [pageData.logoUrl] : [],
        },
        unit_amount: amount,
        recurring: selectedPrice.period !== 'once' ? {
          interval: selectedPrice.period === 'year' ? 'year' : 
                   selectedPrice.period === 'month' ? 'month' : 
                   selectedPrice.period === 'week' ? 'week' : 
                   'day'
        } : undefined
      },
      quantity: 1
    }];

    // Créer la session Stripe Checkout
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: lineItems,
      mode: selectedPrice.period === 'once' ? 'payment' : 'subscription',
      success_url: successUrl || `${process.env.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancelUrl || `${process.env.BASE_URL}/cancel`,
      customer_email: customerEmail,
      metadata: {
        pageId: pageId,
        creatorId: creatorId,
        priceId: priceId,
        pageType: 'landing',
        commission_percent: commissionPercent
      },
      payment_intent_data: selectedPrice.period === 'once' ? {
        application_fee_amount: commissionAmount,
        transfer_data: {
          destination: creatorData.stripe_account_id,
        },
      } : undefined,
      subscription_data: selectedPrice.period !== 'once' ? {
        application_fee_percent: commissionPercent,
        transfer_data: {
          destination: creatorData.stripe_account_id,
        },
      } : undefined,
    }, {
      stripeAccount: creatorData.stripe_account_id
    });

    // Enregistrer la session dans la base de données
    await db.collection('checkout_sessions').doc(session.id).set({
      sessionId: session.id,
      pageId: pageId,
      creatorId: creatorId,
      priceId: priceId,
      amount: amount / 100,
      currency: 'EUR',
      status: 'pending',
      customerEmail: customerEmail,
      createdAt: new Date(),
      metadata: {
        pageType: 'landing',
        pageName: pageData.brand,
        priceDetails: selectedPrice
      }
    });

    res.json({
      success: true,
      sessionId: session.id,
      checkoutUrl: session.url
    });

  } catch (error) {
    console.error('Erreur lors de la création de la session de checkout:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la session de paiement',
      error: error.message
    });
  }
});

// Webhook pour traiter les paiements réussis des landing pages
router.post('/stripe-webhook-landing', async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET_LANDING || process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error('Erreur webhook:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // Traiter l'événement
  switch (event.type) {
    case 'checkout.session.completed':
      const session = event.data.object;
      
      // Mettre à jour le statut de la session
      await db.collection('checkout_sessions').doc(session.id).update({
        status: 'completed',
        completedAt: new Date(),
        paymentIntent: session.payment_intent,
        subscription: session.subscription
      });

      // Enregistrer la vente
      await db.collection('sales_events').add({
        sessionId: session.id,
        pageId: session.metadata.pageId,
        creatorId: session.metadata.creatorId,
        amount: session.amount_total / 100,
        currency: session.currency.toUpperCase(),
        customerEmail: session.customer_email,
        paymentStatus: 'completed',
        pageType: 'landing',
        createdAt: new Date()
      });

      // Mettre à jour les métriques
      const metricsRef = db.collection('metrics').doc(session.metadata.creatorId);
      await metricsRef.update({
        totalSales: admin.firestore.FieldValue.increment(1),
        totalRevenue: admin.firestore.FieldValue.increment(session.amount_total / 100),
        lastSaleAt: new Date()
      });

      // TODO: Envoyer un email de confirmation si configuré
      // TODO: Donner accès au canal Telegram si configuré

      break;

    case 'payment_intent.payment_failed':
      const paymentIntent = event.data.object;
      console.error('Paiement échoué:', paymentIntent.id);
      
      // Mettre à jour le statut si une session existe
      const sessions = await db.collection('checkout_sessions')
        .where('paymentIntent', '==', paymentIntent.id)
        .get();
      
      if (!sessions.empty) {
        const sessionDoc = sessions.docs[0];
        await sessionDoc.ref.update({
          status: 'failed',
          failedAt: new Date(),
          failureReason: paymentIntent.last_payment_error?.message
        });
      }
      break;

    default:
      console.log(`Type d'événement non géré: ${event.type}`);
  }

  res.json({ received: true });
});

module.exports = router;