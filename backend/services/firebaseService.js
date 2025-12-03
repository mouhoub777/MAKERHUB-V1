// backend/services/firebaseService.js - Service Firebase MAKERHUB V1
'use strict';

const { getDatabase, getAuth, getStorageBucket, admin } = require('../config/database');

/**
 * Service Firebase pour les opérations courantes
 */
class FirebaseService {
  constructor() {
    this.db = null;
    this.auth = null;
    this.storage = null;
  }

  /**
   * Initialisation lazy des services
   */
  init() {
    if (!this.db) {
      this.db = getDatabase();
      this.auth = getAuth();
      this.storage = getStorageBucket();
    }
  }

  // ==================== USERS ====================

  /**
   * Créer un nouvel utilisateur
   */
  async createUser(userData) {
    this.init();
    const { email, profileName, uid } = userData;
    
    const userDoc = {
      email: email.toLowerCase(),
      profileName: profileName.toLowerCase(),
      profileSlug: profileName.toLowerCase().replace(/[^a-z0-9]/g, ''),
      plan: 'free',
      stripeAccountId: null,
      stripeConnected: false,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    if (uid) {
      await this.db.collection('users').doc(uid).set(userDoc);
      return { id: uid, ...userDoc };
    } else {
      const ref = await this.db.collection('users').add(userDoc);
      return { id: ref.id, ...userDoc };
    }
  }

  /**
   * Récupérer un utilisateur par ID
   */
  async getUserById(userId) {
    this.init();
    const doc = await this.db.collection('users').doc(userId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Récupérer un utilisateur par email
   */
  async getUserByEmail(email) {
    this.init();
    const snapshot = await this.db.collection('users')
      .where('email', '==', email.toLowerCase())
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Récupérer un utilisateur par profileName
   */
  async getUserByProfileName(profileName) {
    this.init();
    const snapshot = await this.db.collection('users')
      .where('profileName', '==', profileName.toLowerCase())
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Mettre à jour un utilisateur
   */
  async updateUser(userId, updateData) {
    this.init();
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await this.db.collection('users').doc(userId).update(updateData);
    return this.getUserById(userId);
  }

  /**
   * Vérifier si un profileName est disponible
   */
  async isProfileNameAvailable(profileName) {
    const user = await this.getUserByProfileName(profileName);
    return !user;
  }

  // ==================== LANDING PAGES ====================

  /**
   * Créer une landing page
   */
  async createLandingPage(pageData) {
    this.init();
    const doc = {
      ...pageData,
      views: 0,
      conversions: 0,
      isActive: true,
      status: 'draft',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const ref = await this.db.collection('landingPages').add(doc);
    return { id: ref.id, ...doc };
  }

  /**
   * Récupérer une landing page par ID
   */
  async getLandingPageById(pageId) {
    this.init();
    const doc = await this.db.collection('landingPages').doc(pageId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Récupérer une landing page par slug
   */
  async getLandingPageBySlug(profileName, channelName) {
    this.init();
    const snapshot = await this.db.collection('landingPages')
      .where('profileName', '==', profileName.toLowerCase())
      .where('channelName', '==', channelName.toLowerCase())
      .limit(1)
      .get();
    
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  /**
   * Récupérer les landing pages d'un utilisateur
   */
  async getLandingPagesByUser(userId) {
    this.init();
    const snapshot = await this.db.collection('landingPages')
      .where('userId', '==', userId)
      .orderBy('createdAt', 'desc')
      .get();
    
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Mettre à jour une landing page
   */
  async updateLandingPage(pageId, updateData) {
    this.init();
    updateData.updatedAt = admin.firestore.FieldValue.serverTimestamp();
    await this.db.collection('landingPages').doc(pageId).update(updateData);
    return this.getLandingPageById(pageId);
  }

  /**
   * Supprimer une landing page
   */
  async deleteLandingPage(pageId) {
    this.init();
    await this.db.collection('landingPages').doc(pageId).delete();
    return true;
  }

  /**
   * Incrémenter les vues d'une page
   */
  async incrementPageViews(pageId) {
    this.init();
    await this.db.collection('landingPages').doc(pageId).update({
      views: admin.firestore.FieldValue.increment(1)
    });
  }

  /**
   * Incrémenter les conversions d'une page
   */
  async incrementPageConversions(pageId) {
    this.init();
    await this.db.collection('landingPages').doc(pageId).update({
      conversions: admin.firestore.FieldValue.increment(1)
    });
  }

  // ==================== EMAILS ====================

  /**
   * Collecter un email
   */
  async collectEmail(emailData) {
    this.init();
    const { email, creatorId, pageId, source, amount, currency } = emailData;

    // Vérifier si l'email existe déjà pour ce créateur
    const existing = await this.db.collection('collected_emails')
      .where('email', '==', email.toLowerCase())
      .where('creatorId', '==', creatorId)
      .limit(1)
      .get();

    if (!existing.empty) {
      // Mettre à jour l'existant
      const docId = existing.docs[0].id;
      await this.db.collection('collected_emails').doc(docId).update({
        lastSource: source,
        lastPageId: pageId,
        totalAmount: admin.firestore.FieldValue.increment(amount || 0),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      return { id: docId, updated: true };
    }

    // Créer un nouvel enregistrement
    const doc = {
      email: email.toLowerCase(),
      creatorId,
      pageId,
      source,
      amount: amount || 0,
      currency: currency || 'EUR',
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const ref = await this.db.collection('collected_emails').add(doc);
    return { id: ref.id, created: true };
  }

  /**
   * Récupérer les emails d'un créateur
   */
  async getEmailsByCreator(creatorId, options = {}) {
    this.init();
    const { limit = 100, pageId } = options;

    let query = this.db.collection('collected_emails')
      .where('creatorId', '==', creatorId)
      .orderBy('createdAt', 'desc');

    if (pageId) {
      query = query.where('pageId', '==', pageId);
    }

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Compter les emails d'un créateur
   */
  async countEmailsByCreator(creatorId) {
    this.init();
    const snapshot = await this.db.collection('collected_emails')
      .where('creatorId', '==', creatorId)
      .get();
    return snapshot.size;
  }

  /**
   * Supprimer un email
   */
  async deleteEmail(emailId) {
    this.init();
    await this.db.collection('collected_emails').doc(emailId).delete();
    return true;
  }

  // ==================== SALES ====================

  /**
   * Enregistrer une vente
   */
  async createSale(saleData) {
    this.init();
    const doc = {
      ...saleData,
      status: 'completed',
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const ref = await this.db.collection('sales').add(doc);
    return { id: ref.id, ...doc };
  }

  /**
   * Récupérer les ventes d'un créateur
   */
  async getSalesByCreator(creatorId, options = {}) {
    this.init();
    const { limit = 100, startDate, endDate } = options;

    let query = this.db.collection('sales')
      .where('creatorId', '==', creatorId)
      .orderBy('createdAt', 'desc');

    if (limit) {
      query = query.limit(limit);
    }

    const snapshot = await query.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Calculer le revenu total d'un créateur
   */
  async getTotalRevenue(creatorId) {
    this.init();
    const snapshot = await this.db.collection('sales')
      .where('creatorId', '==', creatorId)
      .where('status', '==', 'completed')
      .get();

    let total = 0;
    snapshot.docs.forEach(doc => {
      total += doc.data().amount || 0;
    });
    return total;
  }

  // ==================== TELEGRAM MEMBERS ====================

  /**
   * Ajouter un membre Telegram
   */
  async addTelegramMember(memberData) {
    this.init();
    const doc = {
      ...memberData,
      status: 'active',
      joinedAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const ref = await this.db.collection('telegram_members').add(doc);
    return { id: ref.id, ...doc };
  }

  /**
   * Récupérer les membres d'une page
   */
  async getTelegramMembersByPage(pageId) {
    this.init();
    const snapshot = await this.db.collection('telegram_members')
      .where('pageId', '==', pageId)
      .where('status', '==', 'active')
      .orderBy('joinedAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Désactiver un membre
   */
  async deactivateTelegramMember(memberId) {
    this.init();
    await this.db.collection('telegram_members').doc(memberId).update({
      status: 'inactive',
      deactivatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    return true;
  }

  // ==================== REVIEWS ====================

  /**
   * Ajouter un avis
   */
  async addReview(reviewData) {
    this.init();
    const doc = {
      ...reviewData,
      createdAt: admin.firestore.FieldValue.serverTimestamp()
    };

    const ref = await this.db.collection('reviews').add(doc);
    return { id: ref.id, ...doc };
  }

  /**
   * Récupérer les avis d'une page
   */
  async getReviewsByPage(pageId) {
    this.init();
    const snapshot = await this.db.collection('reviews')
      .where('pageId', '==', pageId)
      .orderBy('createdAt', 'desc')
      .get();

    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Supprimer un avis
   */
  async deleteReview(reviewId) {
    this.init();
    await this.db.collection('reviews').doc(reviewId).delete();
    return true;
  }

  /**
   * Calculer la moyenne des avis
   */
  async getAverageRating(pageId) {
    this.init();
    const snapshot = await this.db.collection('reviews')
      .where('pageId', '==', pageId)
      .get();

    if (snapshot.empty) return { average: 0, count: 0 };

    let total = 0;
    snapshot.docs.forEach(doc => {
      total += doc.data().rating || 0;
    });

    return {
      average: total / snapshot.size,
      count: snapshot.size
    };
  }

  // ==================== STATISTICS ====================

  /**
   * Récupérer les statistiques d'un utilisateur
   */
  async getUserStats(userId) {
    this.init();

    // Compter les pages
    const pagesSnapshot = await this.db.collection('landingPages')
      .where('userId', '==', userId)
      .get();

    let totalViews = 0;
    let totalConversions = 0;
    pagesSnapshot.docs.forEach(doc => {
      const data = doc.data();
      totalViews += data.views || 0;
      totalConversions += data.conversions || 0;
    });

    // Compter les emails
    const emailsCount = await this.countEmailsByCreator(userId);

    // Calculer le revenu
    const totalRevenue = await this.getTotalRevenue(userId);

    return {
      totalPages: pagesSnapshot.size,
      totalViews,
      totalConversions,
      conversionRate: totalViews > 0 ? ((totalConversions / totalViews) * 100).toFixed(2) : 0,
      totalEmails: emailsCount,
      totalRevenue
    };
  }

  // ==================== STORAGE ====================

  /**
   * Uploader un fichier
   */
  async uploadFile(filePath, fileBuffer, contentType) {
    this.init();
    if (!this.storage) {
      throw new Error('Storage not configured');
    }

    const file = this.storage.file(filePath);
    await file.save(fileBuffer, {
      metadata: { contentType },
      public: true
    });

    const [url] = await file.getSignedUrl({
      action: 'read',
      expires: '03-01-2500'
    });

    return url;
  }

  /**
   * Supprimer un fichier
   */
  async deleteFile(filePath) {
    this.init();
    if (!this.storage) return false;

    try {
      await this.storage.file(filePath).delete();
      return true;
    } catch (error) {
      console.error('Delete file error:', error);
      return false;
    }
  }
}

// Export singleton
module.exports = new FirebaseService();
