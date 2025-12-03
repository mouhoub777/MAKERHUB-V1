'use strict';
const express = require('express');
const router = express.Router();
const auth = require('../middleware/auth'); // Correction: import direct du middleware
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const admin = require('firebase-admin');

// Configuration Multer pour l'upload
const storage = multer.memoryStorage();
const upload = multer({
    storage: storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
        if (allowedTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Type de fichier non autorisé'));
        }
    }
});

// Récupérer la base de données
const getDatabase = () => {
    try {
        const { getDatabase: getDb } = require('../../config/database');
        return getDb();
    } catch (error) {
        console.error('Erreur accès database:', error);
        return null;
    }
};

// ==================== ROUTES PUBLIQUES ====================

// GET /api/landing/check/:slug - Vérifier disponibilité slug
router.get('/check/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const db = getDatabase();
        
        if (!db) {
            return res.status(503).json({ error: 'Database unavailable' });
        }
        
        const existing = await db.collection('landingPages')
            .where('slug', '==', slug)
            .limit(1)
            .get();
        
        res.json({
            available: existing.empty,
            slug: slug
        });
        
    } catch (error) {
        console.error('Error checking slug:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/landing/page/:slug - Obtenir page publique
router.get('/page/:slug', async (req, res) => {
    try {
        const { slug } = req.params;
        const db = getDatabase();
        
        if (!db) {
            return res.status(503).json({ error: 'Database unavailable' });
        }
        
        const snapshot = await db.collection('landingPages')
            .where('slug', '==', slug)
            .where('isActive', '==', true)
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return res.status(404).json({ error: 'Page not found' });
        }
        
        const page = snapshot.docs[0].data();
        
        // Incrémenter les vues
        await snapshot.docs[0].ref.update({
            viewCount: admin.firestore.FieldValue.increment(1),
            lastViewedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({
            success: true,
            page: {
                ...page,
                id: snapshot.docs[0].id
            }
        });
        
    } catch (error) {
        console.error('Error getting page:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// ==================== ROUTES PROTÉGÉES ====================

// POST /api/landing/create - Créer landing page
router.post('/create', auth, async (req, res) => {
    try {
        const { 
            slug, 
            brand, 
            description, 
            logoUrl,
            template,
            language,
            currency
        } = req.body;
        
        const db = getDatabase();
        
        if (!db) {
            return res.status(503).json({ error: 'Database unavailable' });
        }
        
        // Vérifier unicité du slug
        const existing = await db.collection('landingPages')
            .where('slug', '==', slug)
            .limit(1)
            .get();
        
        if (!existing.empty) {
            return res.status(409).json({ error: 'Slug already exists' });
        }
        
        const newPage = {
            slug,
            brand,
            description,
            logoUrl: logoUrl || '',
            template: template || 'default',
            language: language || 'fr',
            currency: currency || 'EUR',
            creatorId: req.user.uid,
            creatorEmail: req.user.email,
            isActive: false,
            viewCount: 0,
            subscriptionCount: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };
        
        const docRef = await db.collection('landingPages').add(newPage);
        
        res.json({
            success: true,
            pageId: docRef.id,
            slug: slug
        });
        
    } catch (error) {
        console.error('Error creating page:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/landing/list - Lister mes pages
router.get('/list', auth, async (req, res) => {
    try {
        const db = getDatabase();
        
        if (!db) {
            return res.status(503).json({ error: 'Database unavailable' });
        }
        
        const snapshot = await db.collection('landingPages')
            .where('creatorId', '==', req.user.uid)
            .orderBy('createdAt', 'desc')
            .get();
        
        const pages = snapshot.docs.map(doc => ({
            id: doc.id,
            ...doc.data()
        }));
        
        res.json({
            success: true,
            pages: pages,
            total: pages.length
        });
        
    } catch (error) {
        console.error('Error listing pages:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/landing/update/:slug - Mettre à jour page
router.put('/update/:slug', auth, async (req, res) => {
    try {
        const { slug } = req.params;
        const updates = req.body;
        const db = getDatabase();
        
        if (!db) {
            return res.status(503).json({ error: 'Database unavailable' });
        }
        
        const snapshot = await db.collection('landingPages')
            .where('slug', '==', slug)
            .where('creatorId', '==', req.user.uid)
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return res.status(404).json({ error: 'Page not found' });
        }
        
        const allowedFields = [
            'brand', 'slogan', 'description', 'logoUrl', 'template',
            'buttonText', 'buttonEmoji', 'prices', 'showPrices',
            'telegram', 'isActive'
        ];
        
        const filteredUpdates = {};
        for (const field of allowedFields) {
            if (updates.hasOwnProperty(field)) {
                filteredUpdates[field] = updates[field];
            }
        }
        
        filteredUpdates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
        
        await snapshot.docs[0].ref.update(filteredUpdates);
        
        res.json({
            success: true,
            message: 'Page updated successfully'
        });
        
    } catch (error) {
        console.error('Error updating page:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// DELETE /api/landing/delete/:slug - Supprimer page
router.delete('/delete/:slug', auth, async (req, res) => {
    try {
        const { slug } = req.params;
        const db = getDatabase();
        
        if (!db) {
            return res.status(503).json({ error: 'Database unavailable' });
        }
        
        const snapshot = await db.collection('landingPages')
            .where('slug', '==', slug)
            .where('creatorId', '==', req.user.uid)
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return res.status(404).json({ error: 'Page not found' });
        }
        
        await snapshot.docs[0].ref.delete();
        
        res.json({
            success: true,
            message: 'Page deleted successfully'
        });
        
    } catch (error) {
        console.error('Error deleting page:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// PUT /api/landing/status/:slug - Activer/désactiver page
router.put('/status/:slug', auth, async (req, res) => {
    try {
        const { slug } = req.params;
        const { isActive } = req.body;
        const db = getDatabase();
        
        if (!db) {
            return res.status(503).json({ error: 'Database unavailable' });
        }
        
        const snapshot = await db.collection('landingPages')
            .where('slug', '==', slug)
            .where('creatorId', '==', req.user.uid)
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return res.status(404).json({ error: 'Page not found' });
        }
        
        await snapshot.docs[0].ref.update({
            isActive: isActive === true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
        
        res.json({
            success: true,
            isActive: isActive
        });
        
    } catch (error) {
        console.error('Error updating status:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// GET /api/landing/stats/:slug - Statistiques page
router.get('/stats/:slug', auth, async (req, res) => {
    try {
        const { slug } = req.params;
        const db = getDatabase();
        
        if (!db) {
            return res.status(503).json({ error: 'Database unavailable' });
        }
        
        const snapshot = await db.collection('landingPages')
            .where('slug', '==', slug)
            .where('creatorId', '==', req.user.uid)
            .limit(1)
            .get();
        
        if (snapshot.empty) {
            return res.status(404).json({ error: 'Page not found' });
        }
        
        const page = snapshot.docs[0].data();
        
        res.json({
            success: true,
            stats: {
                viewCount: page.viewCount || 0,
                subscriptionCount: page.subscriptionCount || 0,
                revenue: page.revenue || 0,
                conversionRate: page.viewCount > 0 
                    ? ((page.subscriptionCount / page.viewCount) * 100).toFixed(2) 
                    : 0
            }
        });
        
    } catch (error) {
        console.error('Error getting stats:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/landing/upload/logo - Upload logo
router.post('/upload/logo', auth, upload.single('logo'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }
        
        const bucket = admin.storage().bucket();
        const fileName = `logos/${req.user.uid}/${Date.now()}_${req.file.originalname}`;
        const file = bucket.file(fileName);
        
        const stream = file.createWriteStream({
            metadata: {
                contentType: req.file.mimetype,
                metadata: {
                    uploadedBy: req.user.uid
                }
            }
        });
        
        stream.on('error', (err) => {
            console.error('Upload error:', err);
            res.status(500).json({ error: 'Upload failed' });
        });
        
        stream.on('finish', async () => {
            await file.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            
            res.json({
                success: true,
                url: publicUrl
            });
        });
        
        stream.end(req.file.buffer);
        
    } catch (error) {
        console.error('Error uploading logo:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

// POST /api/landing/upload/media - Upload media
router.post('/upload/media', auth, upload.array('media', 10), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }
        
        const bucket = admin.storage().bucket();
        const uploadedUrls = [];
        
        for (const file of req.files) {
            const fileName = `media/${req.user.uid}/${Date.now()}_${file.originalname}`;
            const bucketFile = bucket.file(fileName);
            
            await new Promise((resolve, reject) => {
                const stream = bucketFile.createWriteStream({
                    metadata: {
                        contentType: file.mimetype,
                        metadata: {
                            uploadedBy: req.user.uid
                        }
                    }
                });
                
                stream.on('error', reject);
                stream.on('finish', resolve);
                stream.end(file.buffer);
            });
            
            await bucketFile.makePublic();
            const publicUrl = `https://storage.googleapis.com/${bucket.name}/${fileName}`;
            uploadedUrls.push(publicUrl);
        }
        
        res.json({
            success: true,
            urls: uploadedUrls
        });
        
    } catch (error) {
        console.error('Error uploading media:', error);
        res.status(500).json({ error: 'Server error' });
    }
});

module.exports = router;