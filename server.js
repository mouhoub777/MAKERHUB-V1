// server.js - MAKERHUB V1 - Serveur Node.js Principal
// VERSION CORRIGÉE - Traduction à la demande avec DeepL
'use strict';

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { createProxyMiddleware } = require('http-proxy-middleware');

// ✅ Configuration Firebase (config/ à la racine)
const { getDatabase, admin } = require('./config/database');
const { stripe } = require('./config/stripe');

// Créer l'application Express
const app = express();
const PORT = process.env.NODE_PORT || process.env.PORT || 3000;
const isDevelopment = process.env.NODE_ENV !== 'production';

// Variables de tracking
let serverStartTime = Date.now();
let totalRequests = 0;

// Référence à la base de données
let db = null;

// ==================== INITIALISATION ====================
console.log('🚀 MAKERHUB V1 - Démarrage du serveur...');

try {
  db = getDatabase();
  console.log('✅ Firebase Firestore connecté');
} catch (error) {
  console.error('❌ Erreur connexion Firebase:', error.message);
}

// ==================== MIDDLEWARES ====================

// Webhook Stripe - AVANT les autres middlewares (body brut requis)
app.use('/webhook/stripe', express.raw({ type: 'application/json' }));
app.use('/api/webhook', express.raw({ type: 'application/json' }));

// Configuration CORS
const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    
    if (isDevelopment && (origin.includes('localhost') || origin.includes('127.0.0.1'))) {
      return callback(null, true);
    }
    
    const allowedOrigins = [
      'https://makerhub.pro',
      'https://www.makerhub.pro',
      'https://api.makerhub.pro'
    ];
    
    if (allowedOrigins.indexOf(origin) !== -1 || isDevelopment) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-email']
};

app.use(cors(corsOptions));

// Sécurité Helmet - CSP configuré pour production
if (isDevelopment) {
  app.use(helmet({
    contentSecurityPolicy: false,
    crossOriginEmbedderPolicy: false
  }));
  console.log('🔓 CSP désactivé (mode développement)');
} else {
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'", "https://cdnjs.cloudflare.com", "https://js.stripe.com", "https://www.gstatic.com"],
        scriptSrcAttr: ["'unsafe-inline'"],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com", "data:"],
        imgSrc: ["'self'", "data:", "https:", "blob:"],
        connectSrc: ["'self'", "https://api.stripe.com", "https://*.firebaseio.com", "https://*.googleapis.com", "wss://*.firebaseio.com"],
        frameSrc: ["'self'", "https://js.stripe.com", "https://hooks.stripe.com"]
      }
    },
    crossOriginEmbedderPolicy: false
  }));
  console.log('🔒 CSP activé (mode production)');
}

// Rate Limiting
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: isDevelopment ? 1000 : 100,
  message: { error: 'Trop de requêtes, veuillez réessayer plus tard' }
});
app.use('/api/', apiLimiter);

// Body parsers (APRÈS le webhook Stripe)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Logging
app.use((req, res, next) => {
  totalRequests++;
  if (!isDevelopment || !req.url.includes('/assets/')) {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
  }
  next();
});

// ==================== PROXY PYTHON ====================
const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

app.use('/api/python', createProxyMiddleware({
  target: pythonServiceUrl,
  changeOrigin: true,
  pathRewrite: { '^/api/python': '' },
  timeout: 10000,
  onError: (err, req, res) => {
    console.error('❌ Erreur proxy Python:', err.message);
    res.status(503).json({
      success: false,
      error: 'Service Python indisponible'
    });
  }
}));

console.log('🐍 Proxy Python configuré sur /api/python/*');

// ==================== FICHIERS STATIQUES ====================
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/pages', express.static(path.join(__dirname, 'frontend/pages')));
app.use('/assets', express.static(path.join(__dirname, 'frontend/assets')));
app.use('/config', express.static(path.join(__dirname, 'config')));
app.use('/utils', express.static(path.join(__dirname, 'utils')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ==================== ROUTES API ====================

// Health Check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'MAKERHUB V1 Node.js',
    port: PORT,
    uptime: Math.floor((Date.now() - serverStartTime) / 1000),
    requests: totalRequests,
    database: db ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// Statut Stripe
app.get('/api/stripe-status', async (req, res) => {
  try {
    const userId = req.headers['x-user-id'] || req.query.userId;
    
    if (!userId || !db) {
      return res.json({
        connected: false,
        message: 'User ID required or database unavailable'
      });
    }
    
    const userDoc = await db.collection('users').doc(userId).get();
    
    if (!userDoc.exists) {
      return res.json({ connected: false });
    }
    
    const userData = userDoc.data();
    const stripeAccountId = userData.stripeAccountId;
    
    if (!stripeAccountId) {
      return res.json({ connected: false });
    }
    
    const account = await stripe.accounts.retrieve(stripeAccountId);
    
    res.json({
      connected: true,
      accountId: stripeAccountId,
      chargesEnabled: account.charges_enabled,
      payoutsEnabled: account.payouts_enabled,
      detailsSubmitted: account.details_submitted
    });
    
  } catch (error) {
    console.error('❌ Erreur stripe-status:', error);
    res.json({ connected: false, error: error.message });
  }
});

// ==================== ROUTES API V1 ====================
app.use('/api/landing', require('./backend/routes/landingRoutes'));
app.use('/api/stripe', require('./backend/routes/stripeRoutes'));
app.use('/api/stripe-connect', require('./backend/routes/stripeConnectRoutes'));
app.use('/api/auth', require('./backend/routes/authRoutes'));
app.use('/api/checkout', require('./backend/routes/checkoutRoutes'));
app.use('/api/tracking', require('./backend/routes/Trackingroutes'));
app.use('/api/landing-checkout', require('./backend/routes/landingCheckoutRoutes'));

// ==================== WEBHOOK STRIPE ====================
app.post('/webhook/stripe', async (req, res) => {
  try {
    const sig = req.headers['stripe-signature'];
    
    if (!process.env.STRIPE_WEBHOOK_SECRET) {
      console.warn('⚠️ STRIPE_WEBHOOK_SECRET non configuré');
      return res.status(200).json({ received: true });
    }

    const event = stripe.webhooks.constructEvent(
      req.body, 
      sig, 
      process.env.STRIPE_WEBHOOK_SECRET
    );
    
    console.log('📥 Webhook Stripe reçu:', event.type);
    
    switch (event.type) {
      case 'checkout.session.completed':
        const session = event.data.object;
        console.log('💰 Paiement réussi:', session.id);
        
        if (db) {
          await db.collection('sales').add({
            sessionId: session.id,
            amount: session.amount_total / 100,
            currency: session.currency,
            customerEmail: session.customer_email,
            creatorId: session.metadata?.creator_id,
            pageId: session.metadata?.page_id,
            status: 'completed',
            createdAt: admin.firestore.FieldValue.serverTimestamp()
          });
        }
        break;
        
      case 'account.updated':
        const account = event.data.object;
        console.log('🔄 Compte Stripe mis à jour:', account.id);
        break;
        
      case 'payment_intent.succeeded':
        console.log('✅ Payment intent succeeded');
        break;
        
      case 'payment_intent.payment_failed':
        console.log('❌ Payment intent failed');
        break;
        
      default:
        console.log(`⚡ Événement non traité: ${event.type}`);
    }
    
    res.json({ received: true });
    
  } catch (error) {
    console.error('❌ Erreur webhook Stripe:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
});

// ==================== ROUTES PAGES HTML ====================
app.get('/', (req, res) => {
  res.redirect('/auth.html');
});

const pages = [
  'auth', 'dashboard', 'createLanding', 'telegramsubscription',
  'emails', 'statistiques', 'avis', 'prix', 'ajoutcanal', 'payments'
];

pages.forEach(page => {
  app.get(`/${page}.html`, (req, res) => {
    res.sendFile(path.join(__dirname, `frontend/pages/${page}.html`));
  });
});

app.get('/:page.html', (req, res, next) => {
  const pageName = req.params.page;
  const pagePath = path.join(__dirname, 'frontend/pages', `${pageName}.html`);
  
  fs.access(pagePath, fs.constants.F_OK, (err) => {
    if (!err) {
      res.sendFile(pagePath);
    } else {
      next();
    }
  });
});

// ==================== TRADUCTION À LA DEMANDE AVEC DEEPL ====================
/**
 * Traduire le contenu d'une landing page avec DeepL si nécessaire
 * @param {Object} landingData - Données de la landing page
 * @param {string} targetLang - Langue cible (ex: 'en', 'es', 'pt')
 * @param {string} docId - ID du document Firebase pour sauvegarder
 * @returns {Object} - Données avec traductions appliquées
 */
async function translateLandingContentIfNeeded(landingData, targetLang, docId) {
  // Normaliser les codes de langue
  const sourceLang = (landingData.sourceLanguage || 'fr').toLowerCase().substring(0, 2);
  const target = targetLang.toLowerCase().substring(0, 2);
  
  // Si la langue cible est la langue source, pas besoin de traduire
  if (target === sourceLang) {
    console.log(`   🌐 Langue source (${sourceLang}) = langue demandée, pas de traduction`);
    return landingData;
  }
  
  // Vérifier si la traduction existe déjà dans Firebase
  const translations = landingData.translations || {};
  const existingTranslation = translations[target];
  
  // Si traduction existe et n'est pas null/vide, l'utiliser
  if (existingTranslation && existingTranslation.slogan) {
    console.log(`   🌐 Traduction ${target} trouvée dans Firebase`);
    return landingData;
  }
  
  // Sinon, essayer de traduire avec DeepL
  console.log(`   🌐 Traduction ${target} manquante, tentative avec DeepL...`);
  
  try {
    // Vérifier si DeepL est configuré
    const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
    if (!DEEPL_API_KEY) {
      console.log(`   ⚠️ DEEPL_API_KEY non configurée, traduction impossible`);
      return landingData;
    }
    
    // Préparer les textes à traduire
    const textsToTranslate = [];
    const fields = [];
    
    if (landingData.banner) {
      textsToTranslate.push(landingData.banner);
      fields.push('banner');
    }
    if (landingData.slogan) {
      textsToTranslate.push(landingData.slogan);
      fields.push('slogan');
    }
    if (landingData.description) {
      textsToTranslate.push(landingData.description);
      fields.push('description');
    }
    if (landingData.buttonText) {
      textsToTranslate.push(landingData.buttonText);
      fields.push('buttonText');
    }
    
    if (textsToTranslate.length === 0) {
      console.log(`   ⚠️ Aucun contenu à traduire`);
      return landingData;
    }
    
    // Mapper les codes de langue pour DeepL
    const deeplLangMap = {
      'en': 'EN',
      'es': 'ES',
      'pt': 'PT-PT',
      'de': 'DE',
      'it': 'IT',
      'ru': 'RU',
      'zh': 'ZH',
      'ja': 'JA',
      'ko': 'KO',
      'tr': 'TR',
      'ar': 'AR',
      'pl': 'PL',
      'fr': 'FR'
    };
    
    const deeplTarget = deeplLangMap[target] || target.toUpperCase();
    const deeplSource = deeplLangMap[sourceLang] || sourceLang.toUpperCase();
    
    // Appeler l'API DeepL
    const fetch = (await import('node-fetch')).default;
    
    // Utiliser l'API gratuite ou pro selon la clé
    const apiUrl = DEEPL_API_KEY.includes(':fx') 
      ? 'https://api-free.deepl.com/v2/translate'
      : 'https://api.deepl.com/v2/translate';
    
    const response = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${DEEPL_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        text: textsToTranslate,
        source_lang: deeplSource,
        target_lang: deeplTarget
      })
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error(`   ❌ Erreur DeepL: ${response.status} - ${errorText}`);
      return landingData;
    }
    
    const result = await response.json();
    
    if (!result.translations || result.translations.length !== textsToTranslate.length) {
      console.error(`   ❌ Réponse DeepL invalide`);
      return landingData;
    }
    
    // Construire l'objet de traduction
    const newTranslation = {};
    fields.forEach((field, index) => {
      newTranslation[field] = result.translations[index].text;
    });
    
    console.log(`   ✅ Traduction ${target} générée avec DeepL`);
    
    // Sauvegarder dans Firebase (async, ne pas attendre)
    if (db && docId) {
      db.collection('landingPages').doc(docId).update({
        [`translations.${target}`]: newTranslation,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        console.log(`   💾 Traduction ${target} sauvegardée dans Firebase`);
      }).catch(err => {
        console.error(`   ❌ Erreur sauvegarde traduction:`, err.message);
      });
    }
    
    // Appliquer la traduction aux données
    landingData.translations = landingData.translations || {};
    landingData.translations[target] = newTranslation;
    
    return landingData;
    
  } catch (error) {
    console.error(`   ❌ Erreur traduction DeepL:`, error.message);
    return landingData;
  }
}

// ==================== ROUTES LANDING PAGES DYNAMIQUES ====================
app.get('/:profile/:slug', async (req, res, next) => {
  try {
    const { profile, slug } = req.params;
    
    // ✅ Récupérer la langue demandée (null si pas spécifiée)
    const requestedLang = req.query.lang || null;
    
    // Préfixes exclus
    const excludedPrefixes = [
      'api', 'pages', 'assets', 'css', 'js', 'images', 
      'public', 'static', 'config', 'utils', 'webhook', 
      'uploads', 'frontend', 'backend', 'node_modules'
    ];
    
    if (excludedPrefixes.includes(profile.toLowerCase())) {
      return next();
    }
    
    if (slug.includes('.')) {
      return next();
    }
    
    console.log(`📄 Accès landing page: ${profile}/${slug}${requestedLang ? ` (lang=${requestedLang})` : ''}`);
    
    if (!db) {
      return res.status(503).send(`
        <!DOCTYPE html>
        <html>
        <head><title>Service non disponible</title></head>
        <body style="text-align:center;padding:50px;font-family:Arial,sans-serif;">
          <h1>503 - Service non disponible</h1>
          <p>La base de données n'est pas connectée.</p>
          <a href="/dashboard.html">Retour au dashboard</a>
        </body>
        </html>
      `);
    }
    
    // Recherche de la landing page
    let landingQuery = await db.collection('landingPages')
      .where('profileName', '==', profile)
      .where('slug', '==', slug)
      .where('isActive', '==', true)
      .limit(1)
      .get();
    
    if (landingQuery.empty) {
      console.log(`   → Recherche avec channelSlug...`);
      landingQuery = await db.collection('landingPages')
        .where('profileName', '==', profile)
        .where('channelSlug', '==', slug)
        .where('isActive', '==', true)
        .limit(1)
        .get();
    }
    
    if (landingQuery.empty) {
      console.log(`   → Recherche sans filtre isActive...`);
      landingQuery = await db.collection('landingPages')
        .where('profileName', '==', profile)
        .where('slug', '==', slug)
        .limit(1)
        .get();
        
      if (landingQuery.empty) {
        landingQuery = await db.collection('landingPages')
          .where('profileName', '==', profile)
          .where('channelSlug', '==', slug)
          .limit(1)
          .get();
      }
      
      if (!landingQuery.empty) {
        const pageData = landingQuery.docs[0].data();
        if (!pageData.isActive) {
          return res.status(403).send(`
            <!DOCTYPE html>
            <html>
            <head><title>Page non active</title></head>
            <body style="text-align:center;padding:50px;font-family:Arial,sans-serif;">
              <h1>🚧 Page en cours de création</h1>
              <p>Cette page n'est pas encore publiée.</p>
              <p style="color:#666;">Connectez un canal Telegram pour l'activer.</p>
              <a href="/dashboard.html" style="color:#007bff;">Retour au dashboard</a>
            </body>
            </html>
          `);
        }
      }
    }
    
    // Page non trouvée
    if (landingQuery.empty) {
      console.log(`   ❌ Page non trouvée: ${profile}/${slug}`);
      return res.status(404).send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>Page non trouvée - MAKERHUB</title>
          <style>
            body {
              font-family: 'Inter', Arial, sans-serif;
              text-align: center;
              padding: 50px;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              margin: 0;
              display: flex;
              align-items: center;
              justify-content: center;
            }
            .container {
              background: white;
              padding: 40px 60px;
              border-radius: 16px;
              box-shadow: 0 20px 60px rgba(0,0,0,0.3);
              max-width: 500px;
            }
            h1 { font-size: 72px; margin: 0; color: #667eea; }
            h2 { color: #333; margin: 10px 0 20px; }
            p { color: #666; margin: 15px 0; }
            .path {
              background: #f5f5f5;
              padding: 10px 20px;
              border-radius: 8px;
              font-family: monospace;
              color: #e74c3c;
              margin: 20px 0;
            }
            a {
              display: inline-block;
              margin-top: 20px;
              padding: 12px 30px;
              background: #667eea;
              color: white;
              text-decoration: none;
              border-radius: 8px;
              font-weight: 600;
              transition: transform 0.2s, box-shadow 0.2s;
            }
            a:hover {
              transform: translateY(-2px);
              box-shadow: 0 5px 20px rgba(102, 126, 234, 0.4);
            }
          </style>
        </head>
        <body>
          <div class="container">
            <h1>404</h1>
            <h2>Page non trouvée</h2>
            <p>La page que vous recherchez n'existe pas ou a été supprimée.</p>
            <div class="path">/${profile}/${slug}</div>
            <a href="/telegramsubscription.html">← Retour aux pages</a>
          </div>
        </body>
        </html>
      `);
    }
    
    // ✅ Page trouvée - Générer le HTML
    const landingDoc = landingQuery.docs[0];
    let landingData = landingDoc.data();
    
    console.log(`   ✅ Page trouvée: ${landingData.brand || landingData.title || slug}`);
    
    // ✅ CORRECTION: Déterminer la langue à utiliser
    // Si ?lang est spécifié, utiliser cette langue
    // Sinon, utiliser la langue source de la page (ou 'fr' par défaut)
    const sourceLang = (landingData.sourceLanguage || 'fr').toLowerCase().substring(0, 2);
    const lang = requestedLang || sourceLang;
    
    console.log(`   🌐 Langue: ${lang} (source: ${sourceLang})`);
    
    // ✅ TRADUCTION À LA DEMANDE: Si langue différente de la source
    if (lang !== sourceLang) {
      landingData = await translateLandingContentIfNeeded(landingData, lang, landingDoc.id);
    }
    
    // Générer le HTML
    try {
      const LandingGenerator = require('./backend/services/landingService');
      const html = await LandingGenerator.generateHTML(landingData, lang);
      
      // Incrémenter les vues (async)
      db.collection('landingPages').doc(landingDoc.id).update({
        viewCount: admin.firestore.FieldValue.increment(1),
        lastViewedAt: admin.firestore.FieldValue.serverTimestamp()
      }).catch(err => console.error('Erreur increment views:', err));
      
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(html);
      
    } catch (genError) {
      console.error('❌ Erreur génération HTML:', genError);
      
      res.send(`
        <!DOCTYPE html>
        <html>
        <head>
          <title>${landingData.brand || landingData.title || 'MAKERHUB'}</title>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <style>
            body { font-family: Arial, sans-serif; text-align: center; padding: 50px; }
            h1 { color: #333; }
            p { color: #666; }
            .error { background: #fff3cd; padding: 15px; border-radius: 8px; margin: 20px 0; }
          </style>
        </head>
        <body>
          <h1>${landingData.brand || landingData.title || 'Page'}</h1>
          <p>${landingData.description || ''}</p>
          <div class="error">
            <strong>⚠️ Erreur de rendu</strong><br>
            Le template de cette page n'a pas pu être généré.<br>
            <small>${genError.message}</small>
          </div>
          <a href="/telegramsubscription.html">Retour</a>
        </body>
        </html>
      `);
    }
    
  } catch (error) {
    console.error('❌ Erreur route landing page:', error);
    next(error);
  }
});

// ==================== GESTION DES ERREURS ====================
app.use((err, req, res, next) => {
  console.error('❌ Erreur serveur:', err);
  res.status(500).json({
    error: 'Erreur interne du serveur',
    message: isDevelopment ? err.message : 'Une erreur est survenue'
  });
});

// 404 Handler
app.use((req, res) => {
  if (req.path.startsWith('/api/')) {
    return res.status(404).json({
      error: 'Route API non trouvée',
      path: req.path
    });
  }
  
  res.status(404).send(`
    <!DOCTYPE html>
    <html>
    <head><title>404 - Non trouvé</title></head>
    <body style="text-align:center;padding:50px;font-family:Arial,sans-serif;">
      <h1>404 - Page non trouvée</h1>
      <p>La ressource demandée n'existe pas.</p>
      <p style="color:#999;">${req.path}</p>
      <a href="/dashboard.html">Retour au dashboard</a>
    </body>
    </html>
  `);
});

// ==================== DÉMARRAGE DU SERVEUR ====================
app.listen(PORT, () => {
  console.log('\n========================================');
  console.log('🎉 MAKERHUB V1 - SERVEUR DÉMARRÉ');
  console.log('========================================');
  console.log(`📍 Port: ${PORT}`);
  console.log(`🌐 URL: http://localhost:${PORT}`);
  console.log(`🔧 Mode: ${isDevelopment ? 'DEVELOPMENT' : 'PRODUCTION'}`);
  console.log(`⏱️  Temps de démarrage: ${Date.now() - serverStartTime}ms`);
  console.log('');
  console.log('📊 PAGES DISPONIBLES:');
  console.log(`   🔐 Auth: http://localhost:${PORT}/auth.html`);
  console.log(`   📊 Dashboard: http://localhost:${PORT}/dashboard.html`);
  console.log(`   📝 Landing: http://localhost:${PORT}/createLanding.html`);
  console.log(`   📱 Telegram: http://localhost:${PORT}/telegramsubscription.html`);
  console.log(`   📧 Emails: http://localhost:${PORT}/emails.html`);
  console.log(`   💳 Payments: http://localhost:${PORT}/payments.html`);
  console.log('');
  console.log('🔗 API ENDPOINTS:');
  console.log(`   ❤️  Health: http://localhost:${PORT}/api/health`);
  console.log(`   💳 Stripe: http://localhost:${PORT}/api/stripe-status`);
  console.log(`   🐍 Python: http://localhost:${PORT}/api/python/health`);
  console.log('');
  console.log('📄 LANDING PAGES:');
  console.log(`   Format: http://localhost:${PORT}/{profileName}/{slug}`);
  console.log(`   Exemple: http://localhost:${PORT}/fxxx/10-places`);
  console.log(`   Avec langue: http://localhost:${PORT}/fxxx/10-places?lang=en`);
  console.log('');
  console.log('🌐 TRADUCTION À LA DEMANDE:');
  console.log(`   DeepL API: ${process.env.DEEPL_API_KEY ? '✅ Configurée' : '❌ Non configurée'}`);
  console.log('========================================\n');
});

module.exports = app;