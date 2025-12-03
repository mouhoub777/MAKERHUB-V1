// C:\Users\Asus\Downloads\Brandlynk\config\database.js
const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

let db = null;
let auth = null;
let storage = null;

// ==========================================
// INITIALISATION DE FIREBASE
// ==========================================
function initializeDatabase() {
  try {
    // Vérifier si Firebase est déjà initialisé
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        storageBucket: process.env.FIREBASE_STORAGE_BUCKET || 'autosub-ab7b1.firebasestorage.app'
      });
      console.log('✅ Firebase initialized successfully');
    } else {
      console.log('✅ Firebase already initialized');
    }

    // Initialiser Firestore
    db = admin.firestore();
    
    // Note: db.settings() ne peut être appelé qu'une fois avant toute utilisation
    // Ces paramètres sont maintenant définis par défaut dans les versions récentes

    // Initialiser Auth
    auth = admin.auth();
    
    // Initialiser Storage
    storage = admin.storage();
    
    console.log('✅ All Firebase services initialized');
    
    return db;
  } catch (error) {
    console.error('❌ Error initializing Firebase:', error);
    throw error;
  }
}

// ==========================================
// OBTENIR LA BASE DE DONNÉES
// ==========================================
function getDatabase() {
  if (!db) {
    db = initializeDatabase();
  }
  return db;
}

// ==========================================
// OBTENIR LE SERVICE D'AUTHENTIFICATION
// ==========================================
function getAuth() {
  if (!auth) {
    initializeDatabase();
  }
  return auth;
}

// ==========================================
// OBTENIR LE SERVICE DE STOCKAGE
// ==========================================
function getStorage() {
  if (!storage) {
    initializeDatabase();
  }
  return storage;
}

// ==========================================
// OBTENIR LE BUCKET DE STOCKAGE
// ==========================================
function getStorageBucket() {
  if (!storage) {
    initializeDatabase();
  }
  return storage.bucket();
}

// ==========================================
// CRÉER UN UTILISATEUR FIREBASE
// ==========================================
async function createFirebaseUser(email, password, displayName = null) {
  try {
    const auth = getAuth();
    
    const userRecord = await auth.createUser({
      email: email,
      password: password,
      displayName: displayName,
      emailVerified: false
    });
    
    console.log('✅ Firebase user created:', userRecord.uid);
    return userRecord;
  } catch (error) {
    console.error('❌ Error creating Firebase user:', error);
    throw error;
  }
}

// ==========================================
// VÉRIFIER UN TOKEN FIREBASE
// ==========================================
async function verifyFirebaseToken(idToken) {
  try {
    const auth = getAuth();
    const decodedToken = await auth.verifyIdToken(idToken);
    return decodedToken;
  } catch (error) {
    console.error('❌ Error verifying Firebase token:', error);
    throw error;
  }
}

// ==========================================
// GÉNÉRER UN LIEN DE VÉRIFICATION EMAIL
// ==========================================
async function generateEmailVerificationLink(email) {
  try {
    const auth = getAuth();
    const link = await auth.generateEmailVerificationLink(email);
    return link;
  } catch (error) {
    console.error('❌ Error generating email verification link:', error);
    throw error;
  }
}

// ==========================================
// GÉNÉRER UN LIEN DE RÉINITIALISATION DE MOT DE PASSE
// ==========================================
async function generatePasswordResetLink(email) {
  try {
    const auth = getAuth();
    const link = await auth.generatePasswordResetLink(email);
    return link;
  } catch (error) {
    console.error('❌ Error generating password reset link:', error);
    throw error;
  }
}

// ==========================================
// UPLOAD DE FICHIER VERS STORAGE
// ==========================================
async function uploadFile(filePath, buffer, contentType = 'application/octet-stream') {
  try {
    const bucket = getStorageBucket();
    const file = bucket.file(filePath);
    
    await file.save(buffer, {
      metadata: {
        contentType: contentType
      },
      public: true
    });
    
    // Obtenir l'URL publique
    const publicUrl = `https://storage.googleapis.com/${bucket.name}/${filePath}`;
    
    console.log('✅ File uploaded:', publicUrl);
    return publicUrl;
  } catch (error) {
    console.error('❌ Error uploading file:', error);
    throw error;
  }
}

// ==========================================
// SUPPRIMER UN FICHIER DE STORAGE
// ==========================================
async function deleteFile(filePath) {
  try {
    const bucket = getStorageBucket();
    const file = bucket.file(filePath);
    
    await file.delete();
    console.log('✅ File deleted:', filePath);
    return true;
  } catch (error) {
    console.error('❌ Error deleting file:', error);
    throw error;
  }
}

// ==========================================
// CRÉER UNE RÉFÉRENCE TIMESTAMP
// ==========================================
function getTimestamp() {
  return admin.firestore.FieldValue.serverTimestamp();
}

// ==========================================
// CRÉER UN BATCH POUR OPÉRATIONS MULTIPLES
// ==========================================
function createBatch() {
  const db = getDatabase();
  return db.batch();
}

// ==========================================
// CRÉER UNE TRANSACTION
// ==========================================
async function runTransaction(updateFunction) {
  const db = getDatabase();
  return db.runTransaction(updateFunction);
}

// ==========================================
// FONCTION UTILITAIRE: VÉRIFIER LA CONNEXION
// ==========================================
async function checkConnection() {
  try {
    const db = getDatabase();
    // Tenter une lecture simple pour vérifier la connexion
    await db.collection('_health').doc('check').get();
    console.log('✅ Database connection successful');
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    return false;
  }
}

// ==========================================
// FONCTION UTILITAIRE: OBTENIR LES STATISTIQUES
// ==========================================
async function getDatabaseStats() {
  try {
    const db = getDatabase();
    
    // Compter les documents dans chaque collection principale
    const collections = ['users', 'profiles', 'lead-pages', 'live-events', 'subscribers'];
    const stats = {};
    
    for (const collectionName of collections) {
      const snapshot = await db.collection(collectionName).get();
      stats[collectionName] = snapshot.size;
    }
    
    return {
      success: true,
      stats: stats,
      timestamp: new Date().toISOString()
    };
  } catch (error) {
    console.error('❌ Error getting database stats:', error);
    throw error;
  }
}

// ==========================================
// FONCTION UTILITAIRE: NETTOYER LES DONNÉES EXPIRÉES
// ==========================================
async function cleanupExpiredData() {
  try {
    const db = getDatabase();
    const now = new Date();
    
    // Nettoyer les vérifications expirées
    const verificationsSnapshot = await db.collection('verifications')
      .where('expiresAt', '<', now.toISOString())
      .get();
    
    const batch = db.batch();
    let deletedCount = 0;
    
    verificationsSnapshot.forEach(doc => {
      batch.delete(doc.ref);
      deletedCount++;
    });
    
    await batch.commit();
    
    console.log(`✅ Cleaned up ${deletedCount} expired verifications`);
    
    return {
      success: true,
      deletedCount: deletedCount
    };
  } catch (error) {
    console.error('❌ Error cleaning up expired data:', error);
    throw error;
  }
}

// ==========================================
// FONCTION UTILITAIRE: BACKUP D'UNE COLLECTION
// ==========================================
async function backupCollection(collectionName) {
  try {
    const db = getDatabase();
    const snapshot = await db.collection(collectionName).get();
    
    const data = [];
    snapshot.forEach(doc => {
      data.push({
        id: doc.id,
        data: doc.data()
      });
    });
    
    const backup = {
      collection: collectionName,
      timestamp: new Date().toISOString(),
      count: data.length,
      data: data
    };
    
    // Sauvegarder dans une collection de backup
    await db.collection('_backups').add(backup);
    
    console.log(`✅ Backed up ${data.length} documents from ${collectionName}`);
    
    return backup;
  } catch (error) {
    console.error('❌ Error backing up collection:', error);
    throw error;
  }
}

// ==========================================
// FONCTION UTILITAIRE: RESTAURER UNE COLLECTION
// ==========================================
async function restoreCollection(backupId) {
  try {
    const db = getDatabase();
    
    // Récupérer le backup
    const backupDoc = await db.collection('_backups').doc(backupId).get();
    if (!backupDoc.exists) {
      throw new Error('Backup not found');
    }
    
    const backup = backupDoc.data();
    const batch = db.batch();
    
    // Restaurer chaque document
    backup.data.forEach(item => {
      const docRef = db.collection(backup.collection).doc(item.id);
      batch.set(docRef, item.data);
    });
    
    await batch.commit();
    
    console.log(`✅ Restored ${backup.data.length} documents to ${backup.collection}`);
    
    return {
      success: true,
      collection: backup.collection,
      restoredCount: backup.data.length
    };
  } catch (error) {
    console.error('❌ Error restoring collection:', error);
    throw error;
  }
}

// ==========================================
// INITIALISATION AU DÉMARRAGE
// ==========================================
// Auto-initialiser au chargement du module
if (process.env.AUTO_INIT_DB !== 'false') {
  initializeDatabase();
}

// ==========================================
// EXPORT DE TOUTES LES FONCTIONS
// ==========================================
module.exports = {
  // Fonctions principales
  initializeDatabase,
  getDatabase,
  getAuth,
  getStorage,
  getStorageBucket,
  
  // Fonctions d'authentification
  createFirebaseUser,
  verifyFirebaseToken,
  generateEmailVerificationLink,
  generatePasswordResetLink,
  
  // Fonctions de stockage
  uploadFile,
  deleteFile,
  
  // Fonctions utilitaires
  getTimestamp,
  createBatch,
  runTransaction,
  checkConnection,
  getDatabaseStats,
  cleanupExpiredData,
  backupCollection,
  restoreCollection,
  
  // Export direct d'admin pour cas spéciaux
  admin
};