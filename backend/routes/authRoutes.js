// backend/routes/authRoutes.js - Routes d'authentification avec chemins corrigÃ©s
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const admin = require('firebase-admin'); // Ajout pour Firebase Admin
// CHEMIN CORRIGÃ‰: depuis backend/routes/, le config est dans ../../config/
const { getDatabase } = require('../../config/database');

const router = express.Router();

// Configuration JWT
const JWT_SECRET = process.env.JWT_SECRET || 'votre-clÃ©-secrÃ¨te-ultra-sÃ©curisÃ©e';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '15m'; // DurÃ©e courte pour JWT interne

// Fonction helper pour Ã©chapper HTML
const escapeHtml = (text) => {
  if (!text) return '';
  return text.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
};

// Middleware de validation email
const validateEmail = (req, res, next) => {
  const { email } = req.body;
  if (!email) {
    return res.status(400).json({
      success: false,
      message: 'Email requis'
    });
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({
      success: false,
      message: 'Format d\'email invalide'
    });
  }
  
  next();
};

// Middleware de validation mot de passe
const validatePassword = (req, res, next) => {
  const { password } = req.body;
  if (!password) {
    return res.status(400).json({
      success: false,
      message: 'Mot de passe requis'
    });
  }
  
  if (password.length < 6) {
    return res.status(400).json({
      success: false,
      message: 'Le mot de passe doit contenir au moins 6 caractÃ¨res'
    });
  }
  
  next();
};

// Middleware d'authentification JWT
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ 
      success: false,
      message: 'Token d\'authentification manquant' 
    });
  }

  jwt.verify(token, JWT_SECRET, (err, user) => {
    if (err) {
      return res.status(403).json({ 
        success: false,
        message: 'Token invalide ou expirÃ©' 
      });
    }
    req.user = user;
    next();
  });
};

// POST /api/auth/exchange - Ã‰change Firebase token â†’ JWT interne (NOUVELLE ROUTE)
router.post('/exchange', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        success: false,
        error: 'No Firebase token provided',
        message: 'Authorization header with Bearer token required'
      });
    }

    const firebaseToken = authHeader.split('Bearer ')[1];
    
    console.log('ðŸ”„ Exchange Firebase â†’ JWT requested');
    
    // VÃ©rifier le token Firebase avec Firebase Admin SDK
    let decodedToken;
    try {
      decodedToken = await admin.auth().verifyIdToken(firebaseToken);
    } catch (firebaseError) {
      console.error('âŒ Firebase token verification failed:', firebaseError.message);
      return res.status(401).json({ 
        success: false,
        error: 'Invalid Firebase token',
        message: 'The provided Firebase token is invalid or expired'
      });
    }
    
    // RÃ©cupÃ©rer les infos utilisateur depuis la base de donnÃ©es si nÃ©cessaire
    const db = getDatabase();
    let userData = {
      uid: decodedToken.uid,
      email: decodedToken.email || '',
      role: 'user' // Par dÃ©faut
    };
    
    // Si l'email existe, rÃ©cupÃ©rer le rÃ´le et autres infos
    if (decodedToken.email) {
      try {
        const userDoc = await db.collection('users').doc(decodedToken.email).get();
        if (userDoc.exists) {
          const dbUser = userDoc.data();
          userData.role = dbUser.role || 'user';
          userData.fullName = dbUser.fullName || '';
          userData.subscription = dbUser.subscription || 'free';
        }
      } catch (dbError) {
        console.warn('âš ï¸ Could not fetch user data from database:', dbError.message);
      }
    }
    
    // CrÃ©er le JWT interne avec expiration courte
    const jwtToken = jwt.sign(
      { 
        uid: userData.uid,
        email: userData.email,
        role: userData.role,
        fullName: userData.fullName,
        subscription: userData.subscription
      },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    console.log('âœ… JWT token issued for:', userData.email || userData.uid);

    res.json({ 
      success: true,
      token: jwtToken,
      expiresIn: JWT_EXPIRES_IN,
      user: {
        uid: userData.uid,
        email: userData.email,
        role: userData.role,
        fullName: userData.fullName,
        subscription: userData.subscription
      }
    });
  } catch (error) {
    console.error('âŒ Token exchange error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Internal server error',
      message: 'Failed to exchange token',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/auth/register - Inscription
router.post('/register', validateEmail, validatePassword, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { email, password, fullName } = req.body;

    console.log('ðŸš€ CrÃ©ation compte MAKERHUB.PRO:', { 
      email: escapeHtml(email), 
      fullName: escapeHtml(fullName || 'Non spÃ©cifiÃ©')
    });

    const db = getDatabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Service de base de donnÃ©es non disponible'
      });
    }

    // Validation des donnÃ©es
    if (!fullName || fullName.trim().length === 0) {
      return res.status(400).json({ 
        success: false, 
        message: 'Nom complet requis' 
      });
    }

    const sanitizedEmail = escapeHtml(email.toLowerCase().trim());
    const sanitizedFullName = escapeHtml(fullName.trim());

    // VÃ©rifier si l'email existe dÃ©jÃ 
    const emailQuery = await db.collection('users').where('email', '==', sanitizedEmail).get();
    if (!emailQuery.empty) {
      return res.status(400).json({ 
        success: false, 
        message: 'Cet email est dÃ©jÃ  enregistrÃ©' 
      });
    }

    // Hasher le mot de passe
    const hashedPassword = await bcrypt.hash(password, 12); // Salt rounds augmentÃ© pour plus de sÃ©curitÃ©

    // CrÃ©er le nouvel utilisateur
    const userId = Date.now().toString();
    const newUser = {
      id: userId,
      email: sanitizedEmail,
      password: hashedPassword,
      fullName: sanitizedFullName,
      role: 'user',
      subscription: 'free',
      isActive: true,
      emailVerified: false,
      createdAt: new Date(),
      updatedAt: new Date(),
      lastLoginAt: null,
      loginCount: 0
    };

    // Sauvegarder dans Firebase
    await db.collection('users').doc(sanitizedEmail).set(newUser);

    // CrÃ©er un token JWT
    const tokenPayload = { 
      id: newUser.id, 
      email: newUser.email, 
      fullName: newUser.fullName,
      role: newUser.role
    };
    
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' }); // Token long pour l'inscription

    const processingTime = Date.now() - startTime;
    console.log(`âœ… Utilisateur MAKERHUB.PRO crÃ©Ã© en ${processingTime}ms:`, newUser.email);

    res.json({
      success: true,
      message: 'Compte crÃ©Ã© avec succÃ¨s',
      token,
      user: {
        id: newUser.id,
        email: newUser.email,
        fullName: newUser.fullName,
        role: newUser.role,
        subscription: newUser.subscription,
        isActive: newUser.isActive
      },
      processingTimeMs: processingTime
    });

  } catch (error) {
    console.error('âŒ Erreur crÃ©ation compte:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Erreur serveur lors de l\'inscription',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/auth/login - Connexion
router.post('/login', validateEmail, async (req, res) => {
  const startTime = Date.now();
  
  try {
    const { email, password } = req.body;

    console.log('ðŸ” Connexion MAKERHUB.PRO:', escapeHtml(email));

    const db = getDatabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Service de base de donnÃ©es non disponible'
      });
    }

    const sanitizedEmail = escapeHtml(email.toLowerCase().trim());

    // Trouver l'utilisateur
    const userDoc = await db.collection('users').doc(sanitizedEmail).get();
    if (!userDoc.exists) {
      // Attendre un peu pour Ã©viter les attaques de timing
      await new Promise(resolve => setTimeout(resolve, 200));
      return res.status(401).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    const user = userDoc.data();

    // VÃ©rifier si le compte est actif
    if (!user.isActive) {
      return res.status(403).json({
        success: false,
        message: 'Compte dÃ©sactivÃ©. Contactez l\'administrateur.'
      });
    }

    // VÃ©rifier le mot de passe
    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      // Attendre un peu pour Ã©viter les attaques de timing
      await new Promise(resolve => setTimeout(resolve, 200));
      return res.status(401).json({ 
        success: false, 
        message: 'Email ou mot de passe incorrect' 
      });
    }

    // Mettre Ã  jour les statistiques de connexion
    try {
      await db.collection('users').doc(sanitizedEmail).update({
        lastLoginAt: new Date(),
        loginCount: (user.loginCount || 0) + 1,
        updatedAt: new Date()
      });
    } catch (updateError) {
      console.warn('âš ï¸ Impossible de mettre Ã  jour les stats de connexion:', updateError);
    }

    // CrÃ©er un token JWT
    const tokenPayload = { 
      id: user.id, 
      email: user.email, 
      fullName: user.fullName,
      role: user.role
    };
    
    const token = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: '24h' }); // Token long pour le login

    const processingTime = Date.now() - startTime;
    console.log(`âœ… Connexion rÃ©ussie MAKERHUB.PRO en ${processingTime}ms:`, user.email);

    res.json({
      success: true,
      message: 'Connexion rÃ©ussie',
      token,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        subscription: user.subscription,
        isActive: user.isActive,
        lastLoginAt: new Date(),
        loginCount: (user.loginCount || 0) + 1
      },
      processingTimeMs: processingTime
    });

  } catch (error) {
    console.error('âŒ Login error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      success: false, 
      message: 'Server error during login',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// GET /api/auth/profile - Profil utilisateur connectÃ©
router.get('/profile', authenticateToken, async (req, res) => {
  try {
    const db = getDatabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Service de base de donnÃ©es non disponible'
      });
    }

    const userDoc = await db.collection('users').doc(req.user.email).get();
    
    if (!userDoc.exists) {
      return res.status(404).json({ 
        success: false,
        message: 'Utilisateur non trouvÃ©' 
      });
    }

    const user = userDoc.data();

    res.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
        subscription: user.subscription,
        isActive: user.isActive,
        emailVerified: user.emailVerified,
        createdAt: user.createdAt,
        lastLoginAt: user.lastLoginAt,
        loginCount: user.loginCount || 0
      }
    });
  } catch (error) {
    console.error('âŒ Erreur rÃ©cupÃ©ration profil:', {
      error: error.message,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// PUT /api/auth/profile - Mettre Ã  jour le profil
router.put('/profile', authenticateToken, async (req, res) => {
  try {
    const { fullName } = req.body;
    
    if (!fullName || fullName.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Nom complet requis'
      });
    }

    const db = getDatabase();
    if (!db) {
      return res.status(503).json({
        success: false,
        message: 'Service de base de donnÃ©es non disponible'
      });
    }

    const sanitizedFullName = escapeHtml(fullName.trim());

    // Mettre Ã  jour le profil
    await db.collection('users').doc(req.user.email).update({
      fullName: sanitizedFullName,
      updatedAt: new Date()
    });

    console.log('âœ… Profil mis Ã  jour:', req.user.email);

    res.json({
      success: true,
      message: 'Profil mis Ã  jour avec succÃ¨s',
      user: {
        ...req.user,
        fullName: sanitizedFullName
      }
    });

  } catch (error) {
    console.error('âŒ Erreur mise Ã  jour profil:', {
      error: error.message,
      userId: req.user?.id,
      timestamp: new Date().toISOString()
    });
    
    res.status(500).json({
      success: false,
      message: 'Erreur serveur lors de la mise Ã  jour',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/auth/logout - DÃ©connexion (optionnel, pour logs)
router.post('/logout', authenticateToken, async (req, res) => {
  try {
    console.log('ðŸ”“ DÃ©connexion utilisateur:', req.user.email);
    
    // Ici on pourrait invalider le token cÃ´tÃ© serveur si on avait une blacklist
    // Pour l'instant, la dÃ©connexion est gÃ©rÃ©e cÃ´tÃ© client
    
    res.json({
      success: true,
      message: 'DÃ©connexion rÃ©ussie'
    });
    
  } catch (error) {
    console.error('âŒ Erreur dÃ©connexion:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la dÃ©connexion'
    });
  }
});

// POST /api/auth/refresh - Renouveler le token
router.post('/refresh', authenticateToken, async (req, res) => {
  try {
    // CrÃ©er un nouveau token avec les mÃªmes donnÃ©es
    const tokenPayload = { 
      id: req.user.id, 
      email: req.user.email, 
      fullName: req.user.fullName,
      role: req.user.role
    };
    
    const newToken = jwt.sign(tokenPayload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
    
    res.json({
      success: true,
      message: 'Token renouvelÃ©',
      token: newToken
    });
    
  } catch (error) {
    console.error('âŒ Token renewal error:', error);
    res.status(500).json({
      success: false,
      message: 'Error during token renewal'
    });
  }
});

// GET /api/auth/verify - VÃ©rifier la validitÃ© du token
router.get('/verify', authenticateToken, (req, res) => {
  res.json({
    success: true,
    message: 'Token valide',
    user: {
      id: req.user.id,
      email: req.user.email,
      fullName: req.user.fullName,
      role: req.user.role
    }
  });
});

// Route de health check
router.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Auth Routes - With Firebase Exchange',
    timestamp: new Date().toISOString(),
    version: '2.0.0-hybrid-auth',
    features: {
      registration: true,
      login: true,
      profile_management: true,
      jwt_tokens: true,
      firebase_exchange: true, // NOUVEAU
      password_hashing: true,
      email_validation: true
    },
    security: {
      bcrypt_rounds: 12,
      jwt_expiry: JWT_EXPIRES_IN,
      jwt_internal_expiry: '15m',
      input_sanitization: true,
      timing_attack_protection: true
    }
  });
});

// Middleware de gestion d'erreurs
router.use((error, req, res, next) => {
  console.error('â›” Auth routes error:', {
    error: error.message,
    stack: error.stack,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? error.message : undefined,
    timestamp: new Date().toISOString()
  });
});

console.log(`
ðŸ” MAKERHUB Auth Routes - ARCHITECTURE HYBRIDE
==============================================

âœ… CHEMINS CORRIGÃ‰S:
   - Config: ../../config/database (depuis backend/routes/)

ðŸ”‘ Routes Authentification:
   POST   /api/auth/exchange    - ðŸ†• Ã‰change Firebase â†’ JWT interne
   POST   /api/auth/register    - Inscription utilisateur
   POST   /api/auth/login       - Connexion utilisateur
   GET    /api/auth/profile     - Profil utilisateur
   PUT    /api/auth/profile     - Mise Ã  jour profil
   POST   /api/auth/logout      - DÃ©connexion (logs)
   POST   /api/auth/refresh     - Renouveler token
   GET    /api/auth/verify      - VÃ©rifier token
   GET    /api/auth/health      - Health check

ðŸ” Architecture Hybride:
   - Firebase Auth pour utilisateurs
   - JWT interne pour services (15min)
   - Ã‰change sÃ©curisÃ© Firebase â†’ JWT

ðŸ›¡ï¸ SÃ©curitÃ©:
   - Hachage bcrypt (12 rounds)
   - JWT avec expiration variable
   - Validation email format
   - Sanitisation HTML
   - Protection attaques timing
   - Middleware authentification

ðŸ“Š FonctionnalitÃ©s:
   - Gestion complÃ¨te utilisateurs
   - Statistiques connexion
   - Validation donnÃ©es robuste
   - Gestion d'erreurs sÃ©curisÃ©e
   - Logs dÃ©taillÃ©s

ðŸš€ Version: 2.0.0-hybrid-auth
ðŸ“… DerniÃ¨re mise Ã  jour: ${new Date().toISOString()}
`);

module.exports = router;
