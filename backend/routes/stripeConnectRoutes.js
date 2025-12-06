const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const admin = require('firebase-admin');

// Middleware pour vérifier l'authentification
const requireAuth = require('../middleware/auth');

// GET /api/stripe-connect/stripe-status - Vérifier le statut Stripe Connect
router.get('/stripe-status', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    console.log('Checking Stripe status for user:', userId);
    
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    if (!userDoc.exists) {
      return res.json({ status: 'pending' });
    }
    
    const userData = userDoc.data();
    const stripeAccountId = userData.stripeAccountId;
    
    if (!stripeAccountId) {
      return res.json({ status: 'pending' });
    }
    
    const account = await stripe.accounts.retrieve(stripeAccountId);
    
    res.json({
      status: 'connected',
      payments_enabled: account.charges_enabled,
      payouts_enabled: account.payouts_enabled,
      documents_verified: !account.requirements.currently_due.length,
      account_id: stripeAccountId
    });
    
  } catch (error) {
    console.error('Stripe status error:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/stripe-connect/create-stripe-connect-link - Créer le lien d'onboarding
router.post('/create-stripe-connect-link', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    const userEmail = req.user.email;
    
    console.log('Creating Stripe Connect link for:', userEmail);
    
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    let stripeAccountId = userDoc.data()?.stripeAccountId;
    
    // Créer un nouveau compte si nécessaire
    if (!stripeAccountId) {
      const account = await stripe.accounts.create({
        type: 'express',
        country: 'FR',
        email: userEmail,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true }
        },
        business_type: 'individual',
        business_profile: {
          mcc: '5734',
          name: 'MAKERHUB Creator',
          product_description: 'Digital content and services'
        }
      });
      
      stripeAccountId = account.id;
      
      await admin.firestore()
        .collection('users')
        .doc(userId)
        .set({
          stripeAccountId: stripeAccountId,
          stripeConnectedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });
    }
    
    // ✅ CORRIGÉ: Force HTTPS pour Stripe Live mode
    const baseUrl = `https://${req.get('host')}`;
    
    const accountLink = await stripe.accountLinks.create({
      account: stripeAccountId,
      refresh_url: `${baseUrl}/payments.html`,
      return_url: `${baseUrl}/payments.html?stripe_connected=true`,
      type: 'account_onboarding'
    });
    
    console.log('Account link created:', accountLink.url);
    
    res.json({ 
      url: accountLink.url,
      account_id: stripeAccountId 
    });
    
  } catch (error) {
    console.error('Create connect link error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/stripe-connect/dashboard-link - Obtenir le lien du dashboard Stripe
router.get('/dashboard-link', requireAuth, async (req, res) => {
  try {
    const userId = req.user.uid;
    
    const userDoc = await admin.firestore()
      .collection('users')
      .doc(userId)
      .get();
    
    const stripeAccountId = userDoc.data()?.stripeAccountId;
    
    if (!stripeAccountId) {
      return res.status(400).json({ error: 'No Stripe account found' });
    }
    
    const loginLink = await stripe.accounts.createLoginLink(stripeAccountId);
    
    res.json({ url: loginLink.url });
    
  } catch (error) {
    console.error('Dashboard link error:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;