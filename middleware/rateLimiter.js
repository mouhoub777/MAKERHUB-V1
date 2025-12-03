// middleware/rateLimiter.js - Rate limiting pour MAKERHUB
// Protection contre les abus (login, checkout, emails, API)

/**
 * Store en mémoire simple (pour dev)
 * En production, utiliser Redis
 */
const memoryStore = new Map();

/**
 * Nettoyer les entrées expirées périodiquement
 */
setInterval(() => {
  const now = Date.now();
  for (const [key, data] of memoryStore.entries()) {
    if (data.resetTime < now) {
      memoryStore.delete(key);
    }
  }
}, 60000); // Nettoyage toutes les minutes

/**
 * Créer un middleware de rate limiting
 * @param {Object} options - Options de configuration
 * @param {string} options.key - Préfixe de la clé
 * @param {number} options.limit - Nombre maximum de requêtes
 * @param {number} options.window - Fenêtre de temps en secondes
 * @param {string} options.message - Message d'erreur personnalisé
 * @param {boolean} options.skipSuccessfulRequests - Ignorer les requêtes réussies
 */
const createRateLimiter = (options = {}) => {
  const {
    key = 'ratelimit',
    limit = 100,
    window = 900, // 15 minutes par défaut
    message = 'Trop de tentatives, veuillez réessayer plus tard',
    skipSuccessfulRequests = false
  } = options;

  return async (req, res, next) => {
    try {
      // Identifier le client (IP ou user ID)
      const identifier = req.user?.uid || req.ip || req.connection?.remoteAddress || 'unknown';
      const storeKey = `${key}:${identifier}`;
      const now = Date.now();

      // Récupérer ou créer l'entrée
      let data = memoryStore.get(storeKey);
      
      if (!data || data.resetTime < now) {
        // Nouvelle fenêtre
        data = {
          count: 0,
          resetTime: now + (window * 1000)
        };
      }

      // Incrémenter le compteur
      data.count++;
      memoryStore.set(storeKey, data);

      // Calculer le temps restant
      const ttl = Math.ceil((data.resetTime - now) / 1000);

      // Ajouter les headers de rate limiting
      res.setHeader('X-RateLimit-Limit', limit);
      res.setHeader('X-RateLimit-Remaining', Math.max(0, limit - data.count));
      res.setHeader('X-RateLimit-Reset', new Date(data.resetTime).toISOString());

      // Vérifier si la limite est dépassée
      if (data.count > limit) {
        res.setHeader('Retry-After', ttl);
        
        return res.status(429).json({
          success: false,
          error: message,
          retryAfter: ttl,
          limit,
          window
        });
      }

      // Si on veut skip les requêtes réussies
      if (skipSuccessfulRequests) {
        const originalSend = res.send;
        res.send = function(responseData) {
          const statusCode = res.statusCode;
          
          // Décrémenter si requête réussie
          if (statusCode < 400) {
            const currentData = memoryStore.get(storeKey);
            if (currentData && currentData.count > 0) {
              currentData.count--;
              memoryStore.set(storeKey, currentData);
            }
          }
          
          return originalSend.call(this, responseData);
        };
      }

      next();
    } catch (error) {
      console.error('Erreur rate limiter:', error);
      // En cas d'erreur, on laisse passer la requête
      next();
    }
  };
};

// ==========================================
// RATE LIMITERS SPÉCIFIQUES MAKERHUB
// ==========================================

/**
 * Login: 5 tentatives par 15 minutes par IP
 * Protection contre le brute force
 */
const loginRateLimiter = createRateLimiter({
  key: 'ratelimit:login',
  limit: 5,
  window: 900, // 15 minutes
  message: 'Trop de tentatives de connexion. Veuillez attendre 15 minutes.',
  skipSuccessfulRequests: true
});

/**
 * Stripe Checkout: 10 tentatives par 5 minutes par IP
 * Protection contre la fraude
 */
const checkoutRateLimiter = createRateLimiter({
  key: 'ratelimit:checkout',
  limit: 10,
  window: 300, // 5 minutes
  message: 'Trop de tentatives de paiement. Veuillez patienter avant de réessayer.'
});

/**
 * Ajout de canal Telegram: 20 tentatives par heure par IP
 */
const telegramChannelRateLimiter = createRateLimiter({
  key: 'ratelimit:telegram:channel',
  limit: 20,
  window: 3600, // 1 heure
  message: 'Limite d\'ajout de canaux atteinte. Veuillez attendre une heure.'
});

/**
 * Ajout membre Telegram: 100 par heure
 * Pour les webhooks Stripe
 */
const telegramMemberRateLimiter = createRateLimiter({
  key: 'ratelimit:telegram:member',
  limit: 100,
  window: 3600, // 1 heure
  message: 'Limite d\'ajout de membres atteinte.'
});

/**
 * API générale: 100 requêtes par minute par utilisateur
 */
const apiRateLimiter = createRateLimiter({
  key: 'ratelimit:api',
  limit: 100,
  window: 60, // 1 minute
  message: 'Limite d\'API atteinte. Veuillez ralentir vos requêtes.'
});

/**
 * Envoi d'emails: 50 par heure par utilisateur
 */
const emailSendRateLimiter = createRateLimiter({
  key: 'ratelimit:email:send',
  limit: 50,
  window: 3600, // 1 heure
  message: 'Limite d\'envoi d\'emails atteinte. Veuillez attendre une heure.'
});

/**
 * Collecte d'emails: 200 par heure par page
 * Pour les landing pages
 */
const emailCollectRateLimiter = createRateLimiter({
  key: 'ratelimit:email:collect',
  limit: 200,
  window: 3600, // 1 heure
  message: 'Limite de collecte d\'emails atteinte.'
});

/**
 * Création de landing pages: 10 par heure par utilisateur
 */
const landingPageRateLimiter = createRateLimiter({
  key: 'ratelimit:landing',
  limit: 10,
  window: 3600, // 1 heure
  message: 'Limite de création de landing pages atteinte. Veuillez attendre une heure.'
});

/**
 * Reset password: 3 tentatives par heure par email
 */
const resetPasswordRateLimiter = createRateLimiter({
  key: 'ratelimit:reset',
  limit: 3,
  window: 3600, // 1 heure
  message: 'Trop de demandes de réinitialisation. Veuillez attendre une heure.'
});

/**
 * Webhook Stripe: 1000 par minute
 */
const webhookRateLimiter = createRateLimiter({
  key: 'ratelimit:webhook',
  limit: 1000,
  window: 60, // 1 minute
  message: 'Limite de webhook atteinte.'
});

/**
 * Inscription: 5 par heure par IP
 */
const signupRateLimiter = createRateLimiter({
  key: 'ratelimit:signup',
  limit: 5,
  window: 3600, // 1 heure
  message: 'Trop de tentatives d\'inscription. Veuillez attendre une heure.'
});

// ==========================================
// FONCTIONS UTILITAIRES
// ==========================================

/**
 * Réinitialiser le rate limit d'un utilisateur
 */
const resetRateLimit = (key, identifier) => {
  const storeKey = `${key}:${identifier}`;
  memoryStore.delete(storeKey);
  return true;
};

/**
 * Obtenir le statut du rate limit
 */
const getRateLimitStatus = (key, identifier) => {
  const storeKey = `${key}:${identifier}`;
  const data = memoryStore.get(storeKey);
  const now = Date.now();
  
  if (!data || data.resetTime < now) {
    return {
      attempts: 0,
      ttl: 0,
      resetAt: null
    };
  }
  
  return {
    attempts: data.count,
    ttl: Math.ceil((data.resetTime - now) / 1000),
    resetAt: new Date(data.resetTime).toISOString()
  };
};

/**
 * Middleware pour bloquer une IP spécifique
 */
const blockIP = (blockedIPs = []) => {
  return (req, res, next) => {
    const ip = req.ip || req.connection?.remoteAddress;
    
    if (blockedIPs.includes(ip)) {
      return res.status(403).json({
        success: false,
        error: 'Accès refusé'
      });
    }
    
    next();
  };
};

// ==========================================
// EXPORTS
// ==========================================

module.exports = {
  // Factory
  createRateLimiter,
  
  // Rate limiters spécifiques
  loginRateLimiter,
  checkoutRateLimiter,
  telegramChannelRateLimiter,
  telegramMemberRateLimiter,
  apiRateLimiter,
  emailSendRateLimiter,
  emailCollectRateLimiter,
  landingPageRateLimiter,
  resetPasswordRateLimiter,
  webhookRateLimiter,
  signupRateLimiter,
  
  // Utilitaires
  resetRateLimit,
  getRateLimitStatus,
  blockIP
};
