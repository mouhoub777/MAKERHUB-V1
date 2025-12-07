const admin = require('firebase-admin');

// Middleware d'authentification Firebase
const auth = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'] || req.headers['Authorization'];
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ 
        error: 'Token manquant',
        message: 'Header Authorization requis: Bearer <ID_TOKEN>' 
      });
    }
    
    const token = authHeader.split(' ')[1];
    
    if (!token) {
      return res.status(401).json({ 
        error: 'Token manquant' 
      });
    }
    
    const decodedToken = await admin.auth().verifyIdToken(token);
    
    req.user = {
      uid: decodedToken.uid,
      email: decodedToken.email || null,
      emailVerified: !!decodedToken.email_verified,
    };
    
    console.log('Auth successful for user:', req.user.email || req.user.uid);
    
    return next();
    
  } catch (error) {
    console.error('Firebase authentication error:', error?.message || error);
    
    if (error.code === 'auth/id-token-expired') {
      return res.status(401).json({ 
        error: 'Token expirÃ©',
        message: 'Please log in again' 
      });
    }
    
    return res.status(401).json({ 
      error: 'Invalid token',
      message: error.message 
    });
  }
};

module.exports = auth;
