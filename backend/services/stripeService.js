// backend/services/stripeService.js - Service Stripe Connect MAKERHUB V1
'use strict';

const { stripe, STRIPE_CONFIG } = require('../config/stripe');
const firebaseService = require('./firebaseService');

/**
 * Service Stripe Connect pour les paiements
 */
class StripeService {
  constructor() {
    this.stripe = stripe;
    this.config = STRIPE_CONFIG;
  }

  // ==================== STRIPE CONNECT ====================

  /**
   * Créer un lien d'onboarding Stripe Connect
   */
  async createConnectAccountLink(userId, returnUrl, refreshUrl) {
    try {
      // Récupérer l'utilisateur
      const user = await firebaseService.getUserById(userId);
      if (!user) {
        throw new Error('User not found');
      }

      let accountId = user.stripeAccountId;

      // Créer un compte Connect si nécessaire
      if (!accountId) {
        const account = await this.stripe.accounts.create({
          type: 'express',
          email: user.email,
          metadata: {
            userId: userId,
            platform: 'makerhub'
          },
          capabilities: {
            card_payments: { requested: true },
            transfers: { requested: true }
          }
        });

        accountId = account.id;

        // Sauvegarder l'ID du compte
        await firebaseService.updateUser(userId, {
          stripeAccountId: accountId
        });
      }

      // Créer le lien d'onboarding
      const accountLink = await this.stripe.accountLinks.create({
        account: accountId,
        refresh_url: refreshUrl || `${this.config.BASE_URL}/payments.html?refresh=true`,
        return_url: returnUrl || `${this.config.BASE_URL}/payments.html?success=true`,
        type: 'account_onboarding'
      });

      return {
        url: accountLink.url,
        accountId: accountId
      };

    } catch (error) {
      console.error('❌ Create Connect account link error:', error);
      throw error;
    }
  }

  /**
   * Vérifier le statut d'un compte Connect
   */
  async getConnectAccountStatus(userId) {
    try {
      const user = await firebaseService.getUserById(userId);
      if (!user || !user.stripeAccountId) {
        return {
          connected: false,
          accountId: null,
          chargesEnabled: false,
          payoutsEnabled: false,
          detailsSubmitted: false
        };
      }

      const account = await this.stripe.accounts.retrieve(user.stripeAccountId);

      // Mettre à jour le statut dans Firebase
      if (account.charges_enabled && !user.stripeConnected) {
        await firebaseService.updateUser(userId, {
          stripeConnected: true
        });
      }

      return {
        connected: true,
        accountId: account.id,
        chargesEnabled: account.charges_enabled,
        payoutsEnabled: account.payouts_enabled,
        detailsSubmitted: account.details_submitted,
        email: account.email
      };

    } catch (error) {
      console.error('❌ Get Connect account status error:', error);
      throw error;
    }
  }

  /**
   * Créer un lien vers le dashboard Stripe Express
   */
  async createDashboardLink(userId) {
    try {
      const user = await firebaseService.getUserById(userId);
      if (!user || !user.stripeAccountId) {
        throw new Error('No Stripe account found');
      }

      const loginLink = await this.stripe.accounts.createLoginLink(user.stripeAccountId);
      return loginLink.url;

    } catch (error) {
      console.error('❌ Create dashboard link error:', error);
      throw error;
    }
  }

  // ==================== CHECKOUT SESSIONS ====================

  /**
   * Créer une session de paiement Checkout
   */
  async createCheckoutSession(options) {
    const {
      pageId,
      priceIndex = 0,
      creatorId,
      successUrl,
      cancelUrl,
      customerEmail,
      telegramUserId
    } = options;

    try {
      // Récupérer la page
      const page = await firebaseService.getLandingPageById(pageId);
      if (!page) {
        throw new Error('Page not found');
      }

      // Récupérer le créateur
      const creator = await firebaseService.getUserById(creatorId || page.userId);
      if (!creator || !creator.stripeAccountId) {
        throw new Error('Creator Stripe account not found');
      }

      // Récupérer le prix sélectionné
      const prices = page.prices || [];
      const selectedPrice = prices[priceIndex] || prices[0];
      
      if (!selectedPrice) {
        throw new Error('No price configured');
      }

      // Calculer la commission (5%)
      const amount = Math.round(selectedPrice.amount * 100); // En centimes
      const applicationFee = Math.round(amount * (this.config.PLATFORM_FEE_PERCENTAGE / 100));

      // Créer la session Checkout
      const session = await this.stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: selectedPrice.currency || 'eur',
            unit_amount: amount,
            product_data: {
              name: selectedPrice.name || page.brand || 'Subscription',
              description: selectedPrice.description || page.slogan || 'Access to premium content'
            }
          },
          quantity: 1
        }],
        payment_intent_data: {
          application_fee_amount: applicationFee,
          transfer_data: {
            destination: creator.stripeAccountId
          }
        },
        metadata: {
          pageId: pageId,
          creatorId: creator.id,
          priceIndex: priceIndex.toString(),
          telegramUserId: telegramUserId || '',
          platform: 'makerhub'
        },
        customer_email: customerEmail,
        success_url: successUrl || `${this.config.BASE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: cancelUrl || `${this.config.BASE_URL}/${page.profileName}/${page.channelName}`
      });

      return {
        sessionId: session.id,
        url: session.url
      };

    } catch (error) {
      console.error('❌ Create checkout session error:', error);
      throw error;
    }
  }

  /**
   * Récupérer une session Checkout
   */
  async getCheckoutSession(sessionId) {
    try {
      const session = await this.stripe.checkout.sessions.retrieve(sessionId, {
        expand: ['payment_intent', 'customer']
      });
      return session;
    } catch (error) {
      console.error('❌ Get checkout session error:', error);
      throw error;
    }
  }

  // ==================== WEBHOOKS ====================

  /**
   * Vérifier la signature d'un webhook
   */
  verifyWebhookSignature(payload, signature, secret) {
    try {
      return this.stripe.webhooks.constructEvent(payload, signature, secret);
    } catch (error) {
      console.error('❌ Webhook signature verification failed:', error);
      throw error;
    }
  }

  /**
   * Traiter un événement webhook
   */
  async handleWebhookEvent(event) {
    console.log(`📥 Webhook event: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed':
        return this.handleCheckoutCompleted(event.data.object);

      case 'payment_intent.succeeded':
        return this.handlePaymentSucceeded(event.data.object);

      case 'payment_intent.payment_failed':
        return this.handlePaymentFailed(event.data.object);

      case 'account.updated':
        return this.handleAccountUpdated(event.data.object);

      default:
        console.log(`⚠️ Unhandled webhook event: ${event.type}`);
        return { handled: false };
    }
  }

  /**
   * Traiter un paiement réussi (checkout.session.completed)
   */
  async handleCheckoutCompleted(session) {
    try {
      const metadata = session.metadata || {};
      const { pageId, creatorId, priceIndex, telegramUserId } = metadata;

      // Enregistrer la vente
      const sale = await firebaseService.createSale({
        sessionId: session.id,
        pageId: pageId,
        creatorId: creatorId,
        amount: session.amount_total / 100,
        currency: session.currency,
        customerEmail: session.customer_email || session.customer_details?.email,
        telegramUserId: telegramUserId,
        paymentIntent: session.payment_intent
      });

      // Collecter l'email
      if (session.customer_email || session.customer_details?.email) {
        await firebaseService.collectEmail({
          email: session.customer_email || session.customer_details.email,
          creatorId: creatorId,
          pageId: pageId,
          source: 'checkout',
          amount: session.amount_total / 100,
          currency: session.currency
        });
      }

      // Incrémenter les conversions
      if (pageId) {
        await firebaseService.incrementPageConversions(pageId);
      }

      console.log(`✅ Sale recorded: ${sale.id}`);
      return { handled: true, saleId: sale.id };

    } catch (error) {
      console.error('❌ Handle checkout completed error:', error);
      throw error;
    }
  }

  /**
   * Traiter un paiement réussi (payment_intent.succeeded)
   */
  async handlePaymentSucceeded(paymentIntent) {
    console.log(`✅ Payment succeeded: ${paymentIntent.id}`);
    return { handled: true };
  }

  /**
   * Traiter un paiement échoué
   */
  async handlePaymentFailed(paymentIntent) {
    console.log(`❌ Payment failed: ${paymentIntent.id}`);
    const metadata = paymentIntent.metadata || {};
    
    // Log l'échec (optionnel: envoyer une notification)
    return { handled: true, failed: true };
  }

  /**
   * Traiter une mise à jour de compte Connect
   */
  async handleAccountUpdated(account) {
    try {
      // Trouver l'utilisateur par stripeAccountId
      const userId = account.metadata?.userId;
      
      if (userId) {
        await firebaseService.updateUser(userId, {
          stripeConnected: account.charges_enabled
        });
        console.log(`✅ Account updated for user: ${userId}`);
      }

      return { handled: true };
    } catch (error) {
      console.error('❌ Handle account updated error:', error);
      throw error;
    }
  }

  // ==================== REFUNDS ====================

  /**
   * Créer un remboursement
   */
  async createRefund(paymentIntentId, amount = null) {
    try {
      const refundOptions = {
        payment_intent: paymentIntentId,
        reverse_transfer: true,
        refund_application_fee: true
      };

      if (amount) {
        refundOptions.amount = Math.round(amount * 100);
      }

      const refund = await this.stripe.refunds.create(refundOptions);
      return refund;

    } catch (error) {
      console.error('❌ Create refund error:', error);
      throw error;
    }
  }

  // ==================== BALANCE ====================

  /**
   * Récupérer le solde de la plateforme
   */
  async getPlatformBalance() {
    try {
      const balance = await this.stripe.balance.retrieve();
      return balance;
    } catch (error) {
      console.error('❌ Get platform balance error:', error);
      throw error;
    }
  }

  /**
   * Récupérer le solde d'un compte Connect
   */
  async getConnectAccountBalance(accountId) {
    try {
      const balance = await this.stripe.balance.retrieve({
        stripeAccount: accountId
      });
      return balance;
    } catch (error) {
      console.error('❌ Get Connect account balance error:', error);
      throw error;
    }
  }

  // ==================== TRANSFERS ====================

  /**
   * Lister les transferts vers un compte Connect
   */
  async listTransfers(accountId, limit = 10) {
    try {
      const transfers = await this.stripe.transfers.list({
        destination: accountId,
        limit: limit
      });
      return transfers.data;
    } catch (error) {
      console.error('❌ List transfers error:', error);
      throw error;
    }
  }
}

// Export singleton
module.exports = new StripeService();
