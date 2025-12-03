const express = require('express');
const router = express.Router();
const checkoutController = require('../controllers/checkoutController');

// Routes pour Stripe Checkout
router.post('/create-session', checkoutController.createCheckoutSession);
router.post('/create-prices', checkoutController.createPricesForAllCurrencies);
router.get('/prices/:productId', checkoutController.getPrices);
router.post('/customer-portal', checkoutController.createPortalSession);
router.post('/webhook', express.raw({type: 'application/json'}), checkoutController.handleWebhook);

module.exports = router;