// middleware/pageLoader.js

const db = require('../firebase');
const { renderTemplate } = require('../utils/templateRenderer');

/**
 * Crée un middleware pour charger et rendre une page dynamique depuis Firestore.
 * @param {string} collectionName Le nom de la collection à interroger.
 * @param {Function} generatorFn La fonction qui génère le HTML à partir des données.
 * @returns {Function} Le middleware Express.
 */
const loadDynamicPage = (collectionName, generatorFn) => {
  return async (req, res) => {
    try {
      // Les paramètres 'profile' et 'slug' sont attendus dans l'URL.
      const { profile, slug } = req.params;

      // Pour les pages avec slug2 (event, booking, etc.)
      let snapshot;
      if (req.path.endsWith('/event')) {
        // Route spéciale pour les événements live avec slug2="event"
        snapshot = await db.collection(collectionName)
          .where('slug', '==', profile)
          .where('slug2', '==', 'event')
          .limit(1)
          .get();
      } else if (req.path.endsWith('/booking')) {
        // Route spéciale pour les pages scheduler avec slug2="booking"
        snapshot = await db.collection(collectionName)
          .where('slug', '==', profile)
          .where('slug2', '==', 'booking')
          .limit(1)
          .get();
      } else {
        // Recherche normale
        snapshot = await db.collection(collectionName)
          .where('profile', '==', profile)
          .where('slug', '==', slug || '')
          .limit(1)
          .get();
      }

      // Si aucun document n'est trouvé, renvoyer une erreur 404.
      if (snapshot.empty) {
        return res.status(404).send('Page not found');
      }

      // Récupérer les données du document.
      const docData = snapshot.docs[0].data();
      
      // Générer le HTML en utilisant la fonction fournie.
      const html = await generatorFn(docData);
      
      // Envoyer le HTML généré au client.
      res.send(html);
    } catch (err) {
      console.error('Error loading page:', err);
      res.status(500).send('Internal server error');
    }
  };
};

module.exports = { loadDynamicPage };
