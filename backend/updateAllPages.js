const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.cert(serviceAccount)
});

const db = admin.firestore();

async function updateAllPagesToShowPrices() {
  try {
    console.log(' Début de la mise à jour des pages...');
    const snapshot = await db.collection('landingPages').get();
    
    if (snapshot.empty) {
      console.log(' Aucune page trouvée');
      return;
    }
    
    console.log(` ${snapshot.size} pages trouvées`);
    const batch = db.batch();
    let updateCount = 0;
    
    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.showPrices !== true) {
        console.log(` Mise à jour de: ${data.channelName} (${data.slug})`);
        batch.update(doc.ref, {
          showPrices: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        updateCount++;
      }
    });
    
    if (updateCount > 0) {
      await batch.commit();
      console.log(` ${updateCount} pages mises à jour avec succès!`);
    } else {
      console.log('ℹ Toutes les pages ont déjà showPrices: true');
    }
    
    process.exit(0);
  } catch (error) {
    console.error(' Erreur:', error);
    process.exit(1);
  }
}

updateAllPagesToShowPrices();
