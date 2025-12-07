// server.js - MAKERHUB V1 - Serveur Node.js Principal
// VERSION CORRIGÉE - Webhook proxy AVANT body parser
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
  console.error('❌ Firebase connection error:', error.message);
}

// ==================== TRUST PROXY (pour ngrok/HTTPS) ====================
app.set('trust proxy', 1);

// ==================== PYTHON SERVICE URL ====================
const pythonServiceUrl = process.env.PYTHON_SERVICE_URL || 'http://localhost:5001';

// ==================== WEBHOOK PROXY - AVANT TOUT BODY PARSER ====================
// ✅ CRITIQUE: Le proxy webhook doit être AVANT express.json() pour que le body brut soit transmis
app.use('/webhook', createProxyMiddleware({
  target: pythonServiceUrl,
  changeOrigin: true,
  timeout: 30000,
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('ngrok-skip-browser-warning', 'true');
    console.log('🔔 Webhook reçu, transmission à Python...');
  },
  onProxyRes: (proxyRes, req, res) => {
    console.log(`🔔 Webhook traité, status: ${proxyRes.statusCode}`);
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error Webhook:', err.message);
    res.status(503).json({
      success: false,
      error: 'Service Webhook indisponible'
    });
  }
}));

console.log('🔔 Proxy configured sur /webhook (AVANT body parser)');

// ==================== MIDDLEWARES ====================

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
  allowedHeaders: ['Content-Type', 'Authorization', 'x-user-id', 'x-user-email', 'stripe-signature']
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
  message: { error: 'Too many requests, please try again later' }
});
app.use('/api/', apiLimiter);

// Body parsers (APRÈS le webhook proxy)
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

// ==================== AUTRES PROXIES PYTHON ====================

app.use('/api/python', createProxyMiddleware({
  target: pythonServiceUrl,
  changeOrigin: true,
  pathRewrite: { '^/api/python': '' },
  timeout: 10000,
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('ngrok-skip-browser-warning', 'true');
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error Python:', err.message);
    res.status(503).json({
      success: false,
      error: 'Service Python indisponible'
    });
  }
}));

console.log('🐍 Proxy configured sur /api/python/*');

// ==================== PROXY CHECKOUT VERS PYTHON ====================
app.use('/checkout', createProxyMiddleware({
  target: pythonServiceUrl,
  changeOrigin: true,
  timeout: 30000,
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('ngrok-skip-browser-warning', 'true');
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error Checkout:', err.message);
    res.status(503).json({
      success: false,
      error: 'Service Checkout indisponible'
    });
  }
}));

console.log('💳 Proxy configured sur /checkout/*');

// ==================== PROXY SUCCESS/CANCEL VERS PYTHON ====================
app.use('/success', createProxyMiddleware({
  target: pythonServiceUrl,
  changeOrigin: true,
  timeout: 10000,
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('ngrok-skip-browser-warning', 'true');
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error Success:', err.message);
    res.status(503).send('<html><body><h1>Service indisponible</h1></body></html>');
  }
}));

app.use('/cancel', createProxyMiddleware({
  target: pythonServiceUrl,
  changeOrigin: true,
  timeout: 10000,
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('ngrok-skip-browser-warning', 'true');
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error Cancel:', err.message);
    res.status(503).send('<html><body><h1>Service indisponible</h1></body></html>');
  }
}));

console.log('✅ Proxy configured');

// ==================== PROXY API TELEGRAM VERS PYTHON ====================
app.use('/api/telegram', createProxyMiddleware({
  target: pythonServiceUrl,
  changeOrigin: true,
  timeout: 30000,
  onProxyReq: (proxyReq, req, res) => {
    proxyReq.setHeader('ngrok-skip-browser-warning', 'true');
  },
  onError: (err, req, res) => {
    console.error('❌ Proxy error Telegram:', err.message);
    res.status(503).json({
      success: false,
      error: 'Service Telegram indisponible'
    });
  }
}));

console.log('📱 Proxy configured sur /api/telegram/*');

// ==================== FICHIERS STATIQUES ====================
app.use(express.static(path.join(__dirname, 'frontend')));
app.use('/pages', express.static(path.join(__dirname, 'frontend/pages')));
app.use('/assets', express.static(path.join(__dirname, 'frontend/assets')));
app.use('/public', express.static(path.join(__dirname, 'public')));
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
app.use('/api/subscription', require('./backend/routes/subscriptionRoutes'));

// ==================== ROUTES PAGES HTML ====================
app.get('/', (req, res) => {
  res.redirect('/auth.html');
});

const pages = [
  'auth', 'dashboard', 'createLanding', 'telegramsubscription',
  'emails', 'statistiques', 'avis', 'prix', 'ajoutcanal', 'payments', 'plans'
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
async function translateLandingContentIfNeeded(landingData, targetLang, docId) {
  const sourceLang = (landingData.sourceLanguage || 'fr').toLowerCase().substring(0, 2);
  const target = targetLang.toLowerCase().substring(0, 2);
  
  if (target === sourceLang) {
    console.log(`   🌐 Langue source (${sourceLang}) = langue demandée, pas de traduction`);
    return landingData;
  }
  
  const translations = landingData.translations || {};
  const existingTranslation = translations[target];
  
  if (existingTranslation && existingTranslation.slogan) {
    console.log(`   🌐 Traduction ${target} trouvée dans Firebase`);
    return landingData;
  }
  
  console.log(`   🌐 Traduction ${target} manquante, tentative avec DeepL...`);
  
  try {
    const DEEPL_API_KEY = process.env.DEEPL_API_KEY;
    if (!DEEPL_API_KEY) {
      console.log(`   ⚠️ DEEPL_API_KEY non configurée, traduction impossible`);
      return landingData;
    }
    
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
      console.log(`   ⚠️ No content to translate`);
      return landingData;
    }
    
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
    
    const fetch = (await import('node-fetch')).default;
    
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
      console.error(`   ❌ DeepL error: ${response.status} - ${errorText}`);
      return landingData;
    }
    
    const result = await response.json();
    
    if (!result.translations || result.translations.length !== textsToTranslate.length) {
      console.error(`   ❌ Invalid DeepL response`);
      return landingData;
    }
    
    const newTranslation = {};
    fields.forEach((field, index) => {
      newTranslation[field] = result.translations[index].text;
    });
    
    console.log(`   ✅ Traduction ${target} générée avec DeepL`);
    
    if (db && docId) {
      db.collection('landingPages').doc(docId).update({
        [`translations.${target}`]: newTranslation,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      }).then(() => {
        console.log(`   💾 Traduction ${target} sauvegardée dans Firebase`);
      }).catch(err => {
        console.error(`   ❌ Translation save error:`, err.message);
      });
    }
    
    landingData.translations = landingData.translations || {};
    landingData.translations[target] = newTranslation;
    
    return landingData;
    
  } catch (error) {
    console.error(`   ❌ DeepL translation error:`, error.message);
    return landingData;
  }
}

// ==================== ROUTES LANDING PAGES DYNAMIQUES ====================
app.get('/:profile/:slug', async (req, res, next) => {
  try {
    const { profile, slug } = req.params;
    const requestedLang = req.query.lang || null;
    
    const excludedPrefixes = [
      'api', 'pages', 'assets', 'css', 'js', 'images', 
      'public', 'static', 'config', 'utils', 'webhook', 
      'uploads', 'frontend', 'backend', 'node_modules',
      'checkout', 'success', 'cancel'
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
          <a href="/dashboard.html">Back to dashboard</a>
        </body>
        </html>
      `);
    }
    
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
              <p>This page is not published yet.</p>
              <p style="color:#666;">Connect a Telegram channel to activate it.</p>
              <a href="/dashboard.html" style="color:#007bff;">Back to dashboard</a>
            </body>
            </html>
          `);
        }
      }
    }
    
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
            <p>The page you are looking for does not exist or has been deleted.</p>
            <div class="path">/${profile}/${slug}</div>
            <a href="/telegramsubscription.html">← Back to pages</a>
          </div>
        </body>
        </html>
      `);
    }
    
    const landingDoc = landingQuery.docs[0];
    let landingData = landingDoc.data();
    
    console.log(`   ✅ Page trouvée: ${landingData.brand || landingData.title || slug}`);
    
    const sourceLang = (landingData.sourceLanguage || 'fr').toLowerCase().substring(0, 2);
    const lang = requestedLang || sourceLang;
    
    console.log(`   🌐 Langue: ${lang} (source: ${sourceLang})`);
    
    if (lang !== sourceLang) {
      landingData = await translateLandingContentIfNeeded(landingData, lang, landingDoc.id);
    }
    
    try {
      const LandingGenerator = require('./backend/services/landingService');
      const html = await LandingGenerator.generateHTML(landingData, lang);
      
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
      <a href="/dashboard.html">Back to dashboard</a>
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
  console.log(`   💰 Plans: http://localhost:${PORT}/plans.html`);
  console.log('');
  console.log('🔗 API ENDPOINTS:');
  console.log(`   ❤️  Health: http://localhost:${PORT}/api/health`);
  console.log(`   💳 Stripe: http://localhost:${PORT}/api/stripe-status`);
  console.log(`   💰 Subscription: http://localhost:${PORT}/api/subscription/*`);
  console.log(`   🐍 Python: http://localhost:${PORT}/api/python/health`);
  console.log(`   💰 Checkout: http://localhost:${PORT}/checkout/{pageId}`);
  console.log(`   📱 Telegram: http://localhost:${PORT}/api/telegram/*`);
  console.log(`   🔔 Webhook: http://localhost:${PORT}/webhook`);
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