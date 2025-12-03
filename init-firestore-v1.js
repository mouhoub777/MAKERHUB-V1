const admin = require('firebase-admin');
const serviceAccount = require('./firebase-service-account.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function initializeFirestoreV1() {
  console.log(' Initialisation Firestore MAKERHUB V1...\n');

  try {
    // 1. SUBSCRIPTIONS (CRITIQUE pour gérer les accès)
    console.log(' Création structure: subscriptions');
    await db.collection('subscriptions').doc('_structure').set({
      subscriptionId: 'sub_example',
      stripeSubscriptionId: 'sub_stripe_xxx',
      landingPageSlug: 'example',
      creatorId: 'uid_creator',
      customer: {
        email: 'client@email.com',
        stripeCustomerId: 'cus_xxx',
        telegramUserId: '123456789',
        telegramUsername: '@username',
        country: 'FR'
      },
      plan: {
        name: 'Premium Monthly',
        price: 67,
        currency: 'EUR',
        interval: 'month'
      },
      status: 'active',
      currentPeriodStart: admin.firestore.Timestamp.now(),
      currentPeriodEnd: admin.firestore.Timestamp.now(),
      cancelAtPeriodEnd: false,
      createdAt: admin.firestore.Timestamp.now(),
      telegramAccess: {
        hasAccess: true,
        joinedAt: admin.firestore.Timestamp.now()
      }
    });

    // 2. TELEGRAM_ACCESS (pour contrôler qui a accès)
    console.log('✅ Création structure: telegram_access');
    await db.collection('telegram_access').doc('_structure').set({
      telegramUserId: '123456789',
      channelId: '-1002645370167',
      subscriptionId: 'sub_xxx',
      status: 'active',
      grantedAt: admin.firestore.Timestamp.now(),
      expiresAt: admin.firestore.Timestamp.now(),
      username: '@username',
      firstName: 'Jean'
    });

    // 3. MEDIA_UPLOADS (pour images/vidéos)
    console.log('✅ Création structure: media_uploads');
    await db.collection('media_uploads').doc('_structure').set({
      mediaId: 'media_xxx',
      creatorId: 'uid_creator',
      landingPageSlug: 'example',
      fileName: 'image.jpg',
      fileType: 'image/jpeg',
      fileSize: 234567,
      originalUrl: 'https://firebasestorage.googleapis.com/...',
      thumbnailUrl: 'https://firebasestorage.googleapis.com/...',
      uploadedAt: admin.firestore.Timestamp.now(),
      usedIn: ['page1', 'page2']
    });

    // 4. Mise à jour des landingPages existantes
    console.log('\n Mise à jour des landingPages...');
    const landingPages = await db.collection('landingPages').get();
    
    const batch = db.batch();
    landingPages.forEach(doc => {
      const docRef = db.collection('landingPages').doc(doc.id);
      batch.update(docRef, {
        // Ajouter support médias
        media: {
          images: [],
          videos: [],
          documents: []
        },
        // Intégration Telegram
        telegram: {
          channelId: doc.data().telegramChannelId || '',
          channelUsername: '',
          botUsername: doc.data().telegramBotUsername || '',
          inviteLink: doc.data().telegramChannelLink || '',
          memberCount: 0,
          lastSync: admin.firestore.Timestamp.now()
        },
        // Multi-devise
        pricing: {
          basePrice: parseFloat(doc.data().prices?.[0]?.price || 0),
          baseCurrency: doc.data().currency || 'EUR',
          converted: {
            USD: 0,
            GBP: 0,
            CHF: 0
          }
        },
        // Analytics
        analytics: {
          views24h: 0,
          conversions24h: 0,
          conversionRate: 0,
          topCountries: [],
          topDevices: {}
        },
        // SEO
        seo: {
          metaTitle: doc.data().metaTitle || doc.data().title || '',
          metaDescription: doc.data().metaDescription || '',
          ogImage: '',
          keywords: []
        }
      });
    });
    await batch.commit();

    // 5. Nettoyer les documents de structure
    console.log('\n Nettoyage...');
    await db.collection('subscriptions').doc('_structure').delete();
    await db.collection('telegram_access').doc('_structure').delete();
    await db.collection('media_uploads').doc('_structure').delete();

    console.log('\n TERMINÉ ! Structure Firestore V1 créée avec succès !');
    console.log('\n Collections créées :');
    console.log('   - subscriptions (gestion abonnements)');
    console.log('   - telegram_access (contrôle accès)');
    console.log('   - media_uploads (stockage médias)');
    console.log('   - landingPages (mis à jour avec nouveaux champs)');
    
  } catch (error) {
    console.error(' Erreur:', error);
  }
  
  process.exit();
}

// Exécuter
initializeFirestoreV1();
