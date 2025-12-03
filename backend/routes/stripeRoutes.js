// backend/routes/stripeRoutes.js - Routes Stripe avec chemins corrigés
const express = require('express');
// CHEMINS CORRIGÉS: depuis backend/routes/, le config est dans ../../config/
const { stripe } = require('../../config/stripe');
const { getDatabase } = require('../../config/database');
const admin = require('firebase-admin');
const router = express.Router();

// Configuration Stripe Webhooks
const STRIPE_CONNECT_WEBHOOK_SECRET = process.env.STRIPE_CONNECT_WEBHOOK_SECRET || 'whsec_test_secret_temporaire';

// Helper pour échapper HTML
const escapeHtml = (text) => {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// Middleware de validation Stripe
const validateStripeData = (req, res, next) => {
  try {
    const { amount, currency, metadata } = req.body;
    
    // Validation basique
    if (amount && (typeof amount !== 'number' || amount < 50)) {
      return res.status(400).json({
        success: false,
        message: 'Montant invalide (minimum 0.50€)',
        error: 'invalid_amount'
      });
    }
    
    if (currency && !['eur', 'usd', 'gbp'].includes(currency.toLowerCase())) {
      return res.status(400).json({
        success: false,
        message: 'Devise non supportée',
        error: 'unsupported_currency'
      });
    }
    
    // Sanitisation des métadonnées
    if (metadata && typeof metadata === 'object') {
      Object.keys(metadata).forEach(key => {
        if (typeof metadata[key] === 'string') {
          metadata[key] = escapeHtml(metadata[key]);
        }
      });
    }
    
    next();
  } catch (error) {
    console.error('❌ Erreur validation Stripe:', error);
    res.status(400).json({
      success: false,
      message: 'Données invalides',
      error: 'validation_failed'
    });
  }
};

// POST /api/stripe/create-payment-intent - Créer un intent de paiement
router.post('/create-payment-intent', validateStripeData, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { amount, currency = 'eur', metadata = {}, description } = req.body;

    console.log('💳 Création PaymentIntent Stripe:', {
      amount,
      currency: currency.toLowerCase(),
      description: escapeHtml(description || 'Paiement MAKERHUB.PRO')
    });

    // Validation des paramètres requis
    if (!amount || typeof amount !== 'number') {
      return res.status(400).json({
        success: false,
        message: 'Montant requis et doit être un nombre',
        error: 'missing_amount'
      });
    }

    // Créer l'intent de paiement avec Stripe
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(amount * 100), // Convertir en centimes
      currency: currency.toLowerCase(),
      description: escapeHtml(description || 'Paiement MAKERHUB.PRO'),
      metadata: {
        source: 'makerhub_pro',
        timestamp: new Date().toISOString(),
        ...metadata
      },
      automatic_payment_methods: {
        enabled: true,
      },
    });

    // Sauvegarder l'intent dans Firebase (optionnel, pour tracking)
    try {
      const db = getDatabase();
      if (db) {
        await db.collection('payments').doc(paymentIntent.id).set({
          paymentIntentId: paymentIntent.id,
          amount: amount,
          currency: currency.toLowerCase(),
          status: paymentIntent.status,
          description: escapeHtml(description || 'Paiement MAKERHUB.PRO'),
          metadata: metadata,
          createdAt: new Date(),
          updatedAt: new Date()
        });
      }
    } catch (dbError) {
      console.warn('⚠️ Impossible de sauvegarder l\'intent en base:', dbError);
    }

    const processingTime = Date.now() - startTime;
    console.log(`✅ PaymentIntent créé en ${processingTime}ms:`, paymentIntent.id);

    res.json({
      success: true,
      message: 'Intent de paiement créé avec succès',
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
      amount: amount,
      currency: currency.toLowerCase(),
      processingTimeMs: processingTime
    });

  } catch (error) {
    console.error('❌ Erreur création PaymentIntent:', {
      error: error.message,
      type: error.type,
      code: error.code,
      timestamp: new Date().toISOString()
    });

    // Gestion des erreurs Stripe spécifiques
    let message = 'Erreur lors de la création du paiement';
    let errorCode = 'payment_creation_failed';

    if (error.type === 'StripeCardError') {
      message = 'Erreur de carte bancaire';
      errorCode = 'card_error';
    } else if (error.type === 'StripeRateLimitError') {
      message = 'Trop de requêtes, veuillez réessayer';
      errorCode = 'rate_limit_error';
    } else if (error.type === 'StripeInvalidRequestError') {
      message = 'Paramètres de paiement invalides';
      errorCode = 'invalid_request';
    } else if (error.type === 'StripeAPIError') {
      message = 'Erreur temporaire du service de paiement';
      errorCode = 'api_error';
    } else if (error.type === 'StripeConnectionError') {
      message = 'Problème de connexion au service de paiement';
      errorCode = 'connection_error';
    }

    res.status(500).json({
      success: false,
      message: message,
      error: errorCode,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/stripe/confirm-payment - Confirmer un paiement
router.post('/confirm-payment', async (req, res) => {
  try {
    const { paymentIntentId } = req.body;

    if (!paymentIntentId || typeof paymentIntentId !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'ID de PaymentIntent requis',
        error: 'missing_payment_intent_id'
      });
    }

    console.log('🔍 Confirmation paiement Stripe:', escapeHtml(paymentIntentId));

    // Récupérer l'intent depuis Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    // Mettre à jour en base si nécessaire
    try {
      const db = getDatabase();
      if (db) {
        await db.collection('payments').doc(paymentIntent.id).update({
          status: paymentIntent.status,
          updatedAt: new Date(),
          confirmedAt: paymentIntent.status === 'succeeded' ? new Date() : null
        });
      }
    } catch (dbError) {
      console.warn('⚠️ Impossible de mettre à jour le paiement en base:', dbError);
    }

    console.log(`✅ Statut paiement confirmé:`, {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100
    });

    res.json({
      success: true,
      message: 'Paiement confirmé',
      paymentIntent: {
        id: paymentIntent.id,
        status: paymentIntent.status,
        amount: paymentIntent.amount / 100,
        currency: paymentIntent.currency,
        description: paymentIntent.description
      }
    });

  } catch (error) {
    console.error('❌ Erreur confirmation paiement:', {
      error: error.message,
      type: error.type,
      code: error.code,
      timestamp: new Date().toISOString()
    });

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la confirmation du paiement',
      error: 'payment_confirmation_failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/stripe/payment/:id - Récupérer un paiement
router.get('/payment/:id', async (req, res) => {
  try {
    const { id } = req.params;

    if (!id || typeof id !== 'string') {
      return res.status(400).json({
        success: false,
        message: 'ID de paiement requis',
        error: 'missing_payment_id'
      });
    }

    const sanitizedId = escapeHtml(id);

    console.log('🔍 Récupération paiement Stripe:', sanitizedId);

    // Récupérer depuis Stripe
    const paymentIntent = await stripe.paymentIntents.retrieve(sanitizedId);

    // Données publiques seulement
    const safePaymentData = {
      id: paymentIntent.id,
      status: paymentIntent.status,
      amount: paymentIntent.amount / 100,
      currency: paymentIntent.currency,
      description: paymentIntent.description,
      created: new Date(paymentIntent.created * 1000),
      metadata: paymentIntent.metadata || {}
    };

    res.json({
      success: true,
      data: safePaymentData
    });

  } catch (error) {
    console.error('❌ Erreur récupération paiement:', error);

    if (error.type === 'StripeInvalidRequestError') {
      return res.status(404).json({
        success: false,
        message: 'Paiement non trouvé',
        error: 'payment_not_found'
      });
    }

    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du paiement',
      error: 'payment_retrieval_failed',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/stripe/webhooks - Webhooks Stripe
router.post('/webhooks', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // Vérifier la signature du webhook
    event = stripe.webhooks.constructEvent(req.body, sig, STRIPE_CONNECT_WEBHOOK_SECRET);
    console.log('🔔 Webhook Stripe reçu:', event.type);

  } catch (error) {
    console.error('❌ Erreur signature webhook Stripe:', error.message);
    return res.status(400).json({
      success: false,
      message: 'Signature webhook invalide',
      error: 'invalid_signature'
    });
  }

  try {
    // Gérer les différents types d'événements
    switch (event.type) {
      case 'payment_intent.succeeded':
        await handlePaymentSucceeded(event.data.object);
        break;
      
      case 'payment_intent.payment_failed':
        await handlePaymentFailed(event.data.object);
        break;
      
      case 'payment_intent.canceled':
        await handlePaymentCanceled(event.data.object);
        break;
      
      case 'charge.dispute.created':
        await handleDisputeCreated(event.data.object);
        break;
      
      default:
        console.log(`⚠️ Événement webhook Stripe non géré: ${event.type}`);
    }

    res.json({
      success: true,
      message: 'Webhook traité avec succès',
      eventType: event.type
    });

  } catch (error) {
    console.error('❌ Erreur traitement webhook Stripe:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors du traitement du webhook',
      error: 'webhook_processing_failed'
    });
  }
});

// Fonctions de gestion des événements webhooks
async function handlePaymentSucceeded(paymentIntent) {
  try {
    console.log('✅ Paiement réussi:', paymentIntent.id);
    
    const db = getDatabase();
    if (!db) return;

    // Mettre à jour en base
    await db.collection('payments').doc(paymentIntent.id).update({
      status: 'succeeded',
      succeededAt: new Date(),
      updatedAt: new Date(),
      stripeData: {
        amount_received: paymentIntent.amount_received,
        charges: paymentIntent.charges?.data?.length || 0
      }
    });

    // Ici on pourrait déclencher d'autres actions :
    // - Envoyer un email de confirmation
    // - Activer un service
    // - Mettre à jour le statut d'un abonnement
    // - etc.

  } catch (error) {
    console.error('❌ Erreur traitement paiement réussi:', error);
  }
}

async function handlePaymentFailed(paymentIntent) {
  try {
    console.log('❌ Paiement échoué:', paymentIntent.id);
    
    const db = getDatabase();
    if (!db) return;

    await db.collection('payments').doc(paymentIntent.id).update({
      status: 'failed',
      failedAt: new Date(),
      updatedAt: new Date(),
      failureReason: paymentIntent.last_payment_error?.message || 'Unknown error'
    });

    // Ici on pourrait :
    // - Envoyer un email de notification d'échec
    // - Logger pour analyse
    // - Déclencher une tentative de recouvrement
    // - etc.

  } catch (error) {
    console.error('❌ Erreur traitement paiement échoué:', error);
  }
}

async function handlePaymentCanceled(paymentIntent) {
  try {
    console.log('🚫 Paiement annulé:', paymentIntent.id);
    
    const db = getDatabase();
    if (!db) return;

    await db.collection('payments').doc(paymentIntent.id).update({
      status: 'canceled',
      canceledAt: new Date(),
      updatedAt: new Date()
    });

  } catch (error) {
    console.error('❌ Erreur traitement paiement annulé:', error);
  }
}

async function handleDisputeCreated(dispute) {
  try {
    console.log('⚠️ Litige créé:', dispute.id);
    
    const db = getDatabase();
    if (!db) return;

    // Sauvegarder le litige
    await db.collection('disputes').doc(dispute.id).set({
      disputeId: dispute.id,
      chargeId: dispute.charge,
      amount: dispute.amount / 100,
      currency: dispute.currency,
      reason: dispute.reason,
      status: dispute.status,
      evidence_due_by: new Date(dispute.evidence_details.due_by * 1000),
      createdAt: new Date(),
      updatedAt: new Date()
    });

    // Ici on pourrait :
    // - Envoyer une alerte par email
    // - Notifier l'équipe support
    // - Préparer la réponse automatique
    // - etc.

  } catch (error) {
    console.error('❌ Erreur traitement litige:', error);
  }
}

// GET /api/stripe/health - Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Stripe Routes - Fixed Paths',
    timestamp: new Date().toISOString(),
    version: '1.0.0-fixed-paths',
    features: {
      payment_intents: true,
      webhooks: true,
      payment_confirmation: true,
      dispute_handling: true,
      database_integration: true
    },
    stripe: {
      api_version: stripe.VERSION || 'unknown',
      webhook_secret_configured: !!STRIPE_CONNECT_WEBHOOK_SECRET
    }
  });
});

// Middleware de gestion d'erreurs spécifique à Stripe
router.use((error, req, res, next) => {
  console.error('⛔ Stripe routes error:', {
    error: error.message,
    type: error.type,
    code: error.code,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });

  // Erreurs Stripe spécifiques
  if (error.type && error.type.startsWith('Stripe')) {
    return res.status(400).json({
      success: false,
      message: 'Erreur de service de paiement',
      error: error.type,
      code: error.code,
      details: process.env.NODE_ENV === 'development' ? error.message : undefined,
      timestamp: new Date().toISOString()
    });
  }

  // Erreur générique
  res.status(500).json({
    success: false,
    message: 'Erreur interne du serveur de paiement',
    error: 'internal_server_error',
    timestamp: new Date().toISOString()
  });
});

console.log(`
💳 MAKERHUB Stripe Routes - CHEMINS CORRIGÉS
==========================================

✅ CHEMINS CORRIGÉS:
   - Stripe Config: ../../config/stripe (depuis backend/routes/)
   - Database: ../../config/database (depuis backend/routes/)

💰 Routes Stripe:
   POST   /api/stripe/create-payment-intent  - Créer intent de paiement
   POST   /api/stripe/confirm-payment        - Confirmer paiement
   GET    /api/stripe/payment/:id            - Récupérer paiement
   POST   /api/stripe/webhooks               - Webhooks Stripe
   GET    /api/stripe/health                 - Health check

🔔 Événements Webhooks Gérés:
   - payment_intent.succeeded    - Paiement réussi
   - payment_intent.payment_failed - Paiement échoué
   - payment_intent.canceled     - Paiement annulé
   - charge.dispute.created      - Litige créé

🛡️ Sécurité:
   - Validation signature webhooks
   - Sanitisation des données
   - Gestion erreurs Stripe
   - Logs détaillés
   - Protection XSS

📊 Fonctionnalités:
   - Intégration Firebase complète
   - Gestion multi-devises (EUR, USD, GBP)
   - Tracking des paiements
   - Gestion des litiges
   - Méthodes de paiement automatiques

🚀 Version: 1.0.0-fixed-paths
📅 Dernière mise à jour: ${new Date().toISOString()}
`);

module.exports = router;