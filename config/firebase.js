// config/firebase.js - Configuration Firebase centralisée CORRIGÉE
(function() {
  'use strict';
  
  console.log('🔥 Loading Firebase configuration...');
  
  // Configuration Firebase avec VOS vraies clés
  const firebaseConfig = {
    apiKey: "AIzaSyDCdErRIPkomQvtTVGtMbfUuU9q4S_HH1w",
    authDomain: "autosub-ab7b1.firebaseapp.com",
    projectId: "autosub-ab7b1",
    storageBucket: "autosub-ab7b1.firebasestorage.app",
    messagingSenderId: "1044620755836",
    appId: "1:1044620755836:web:6c7e5c96c0e8b92c3e8a48",
    databaseURL: "https://autosub-ab7b1-default-rtdb.firebaseio.com"
  };
  
  // Initialize Firebase if not already initialized
  if (typeof firebase !== 'undefined') {
    console.log('✅ Firebase SDK loaded');
    
    if (firebase.apps.length === 0) {
      try {
        firebase.initializeApp(firebaseConfig);
        console.log('✅ Firebase initialized successfully');
      } catch (error) {
        console.error('❌ Firebase initialization error:', error);
        return;
      }
    } else {
      console.log('✅ Firebase already initialized');
    }
    
    // Créer les services
    try {
      const auth = firebase.auth();
      const db = firebase.firestore();
      
      console.log('✅ Firebase Auth service created');
      console.log('✅ Firebase Firestore service created');
      
      // Vérifier si Storage est disponible
      let storage = null;
      if (typeof firebase.storage === 'function') {
        storage = firebase.storage();
        console.log('✅ Firebase Storage loaded successfully');
      } else {
        console.warn('⚠️ Firebase Storage not loaded - add storage script to HTML');
      }
      
      // Configure Firestore settings
      db.settings({
        ignoreUndefinedProperties: true,
        merge: true
      });
      console.log('✅ Firestore settings configured');
      
      // IMPORTANT: Exposer les services de DEUX façons pour compatibilité
      // 1. Dans window.firebaseServices
      window.firebaseServices = {
        app: firebase.app(),
        auth: auth,
        db: db,
        storage: storage,
        functions: null
      };
      
      // 2. Directement sur window
      window.firebaseAuth = auth;
      window.firebaseDb = db;
      window.firebaseStorage = storage;
      
      console.log('✅ Firebase services exposed globally (both ways)');
      
      // Set persistence for offline support
      auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL)
        .then(() => {
          console.log('✅ Firebase persistence set to LOCAL');
        })
        .catch(error => {
          console.error('Firebase persistence error:', error);
        });
      
      // Dispatch event when Firebase is ready
      window.dispatchEvent(new Event('firebaseReady'));
      console.log('📢 firebaseReady event dispatched');
      
    } catch (error) {
      console.error('❌ Error creating Firebase services:', error);
    }
  } else {
    console.error('❌ Firebase SDK not loaded. Check your script tags.');
  }
  
  // Helper functions
  window.checkAuth = function() {
    return new Promise((resolve, reject) => {
      if (!window.firebaseAuth) {
        reject(new Error('Firebase auth not available'));
        return;
      }
      
      const unsubscribe = window.firebaseAuth.onAuthStateChanged(user => {
        unsubscribe();
        if (user) {
          resolve(user);
        } else {
          reject(new Error('User not authenticated'));
        }
      });
    });
  };
  
  window.getCurrentUser = function() {
    return window.firebaseAuth ? window.firebaseAuth.currentUser : null;
  };
  
  window.getIdToken = async function() {
    const user = window.getCurrentUser();
    if (!user) {
      throw new Error('User not authenticated');
    }
    return await user.getIdToken();
  };
  
  // Fonction pour vérifier si Firebase est prêt
  window.waitForFirebase = function() {
    return new Promise((resolve) => {
      if (window.firebaseAuth && window.firebaseDb) {
        resolve();
        return;
      }
      
      const checkInterval = setInterval(() => {
        if (window.firebaseAuth && window.firebaseDb) {
          clearInterval(checkInterval);
          resolve();
        }
      }, 100);
      
      // Timeout après 10 secondes
      setTimeout(() => {
        clearInterval(checkInterval);
        resolve(); // Résoudre même en cas de timeout
      }, 10000);
    });
  };
  
  // Fonction de debug
  window.debugFirebase = function() {
    console.log('=== Firebase Debug Info ===');
    console.log('Firebase SDK:', typeof firebase !== 'undefined' ? '✅ Loaded' : '❌ Not loaded');
    console.log('Firebase Apps:', firebase && firebase.apps ? firebase.apps.length : 'N/A');
    console.log('Auth Service:', window.firebaseAuth ? '✅ Available' : '❌ Not available');
    console.log('Firestore Service:', window.firebaseDb ? '✅ Available' : '❌ Not available');
    console.log('Storage Service:', window.firebaseStorage ? '✅ Available' : '❌ Not available');
    console.log('firebaseServices object:', window.firebaseServices);
    console.log('========================');
    return {
      sdk: typeof firebase !== 'undefined',
      apps: firebase && firebase.apps ? firebase.apps.length : 0,
      auth: !!window.firebaseAuth,
      db: !!window.firebaseDb,
      storage: !!window.firebaseStorage
    };
  };
  
  console.log('🚀 Firebase configuration complete. Use window.debugFirebase() for debug info.');
  
})();