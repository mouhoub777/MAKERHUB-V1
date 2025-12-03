const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function fixPricesType() {
  try {
    console.log('Conversion des prix en nombres...');
    const snapshot = await db.collection('landingPages').get();
    
    const promises = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.prices && Array.isArray(data.prices)) {
        const fixedPrices = data.prices.map(price => ({
          ...price,
          price: Number(price.price) || 0,
          freeTrialDays: Number(price.freeTrialDays) || 7
        }));
        
        promises.push(
          doc.ref.update({
            prices: fixedPrices,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
          })
        );
        console.log('Fix prix pour: ' + data.slug);
      }
    });
    
    await Promise.all(promises);
    console.log('Tous les prix sont maintenant des nombres!');
    process.exit(0);
    
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

fixPricesType();
