const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount)
});

const db = admin.firestore();

async function updateAllPagesToShowPrices() {
  try {
    console.log('Mise a jour de toutes les pages...');
    const snapshot = await db.collection('landingPages').get();
    
    if (snapshot.empty) {
      console.log('Aucune page trouvee');
      return;
    }
    
    console.log('Nombre de pages trouvees: ' + snapshot.size);
    
    const promises = [];
    snapshot.forEach(doc => {
      const data = doc.data();
      promises.push(
        doc.ref.update({
          showPrices: true,
          updatedAt: admin.firestore.FieldValue.serverTimestamp()
        })
      );
      console.log('Mise a jour: ' + data.slug + ' (' + data.channelName + ')');
    });
    
    await Promise.all(promises);
    console.log('Toutes les pages ont ete mises a jour avec showPrices: true');
    process.exit(0);
    
  } catch (error) {
    console.error('Erreur:', error);
    process.exit(1);
  }
}

updateAllPagesToShowPrices();
