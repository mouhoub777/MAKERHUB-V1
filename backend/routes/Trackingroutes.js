// backend/routes/trackingRoutes.js - Routes pour tracker les vues et clics
const express = require('express');
const router = express.Router();
const admin = require('firebase-admin');
const db = admin.firestore();

/**
 * POST /api/track/view/:slug
 * Incrémente le compteur de vues d'une landing page
 */
router.post('/view/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        if (!slug) {
            return res.status(400).json({ error: 'Slug requis' });
        }
        
        // Incrémenter viewCount
        await db.collection('landingPages').doc(slug).update({
            viewCount: admin.firestore.FieldValue.increment(1)
        });
        
        console.log(`📊 View tracked for: ${slug}`);
        res.json({ success: true });
        
    } catch (error) {
        console.error('Erreur tracking view:', error);
        res.status(500).json({ error: 'Erreur tracking' });
    }
});

/**
 * POST /api/track/click/:slug
 * Incrémente le compteur de clics d'une landing page
 */
router.post('/click/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        
        if (!slug) {
            return res.status(400).json({ error: 'Slug requis' });
        }
        
        // Incrémenter clickCount
        await db.collection('landingPages').doc(slug).update({
            clickCount: admin.firestore.FieldValue.increment(1)
        });
        
        console.log(`📊 Click tracked for: ${slug}`);
        res.json({ success: true });
        
    } catch (error) {
        console.error('Erreur tracking click:', error);
        res.status(500).json({ error: 'Erreur tracking' });
    }
});

module.exports = router;