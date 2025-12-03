// backend/controllers/landingController.js - Version Simplifiée (v2.2) - PHASE 1
const landingService = require('../services/landingService');

/**
 * ✅ CRÉATION - Délégation simple au service centralisé - PHASE 1 MODIFIÉ
 */
const createLandingPage = async (req, res) => {
  try {
    console.log('🚀 Creating landing page with data:', req.body);
    
    // NOUVEAU - Validation Phase 1
    if (!req.body.profileName) {
      return res.status(400).json({
        success: false,
        message: 'profileName est requis pour créer une landing page'
      });
    }
    
    if (!req.body.channelName) {
      return res.status(400).json({
        success: false,
        message: 'channelName est requis pour créer une landing page'
      });
    }
    
    const result = await landingService.createLandingPageInFirestore(req.body);
    
    res.status(201).json({
      success: true,
      message: 'Landing page créée avec succès',
      data: result
    });
  } catch (error) {
    console.error('❌ Erreur création landing page:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la landing page',
      error: error.message
    });
  }
};

/**
 * ✅ MISE À JOUR - Délégation au service
 */
const updateLandingPageController = async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🔄 Updating landing page ${id} with:`, req.body);
    
    const result = await landingService.updateLandingPage(id, req.body);
    
    res.status(200).json({
      success: true,
      message: 'Landing page mise à jour avec succès',
      data: result
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour landing page:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour',
      error: error.message
    });
  }
};

/**
 * ✅ RÉCUPÉRATION - Délégation simple
 */
const getLandingPage = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log('📖 Fetching landing page:', slug);
    
    const landingPage = await landingService.getLandingPageBySlug(slug);
    
    if (!landingPage) {
      return res.status(404).json({
        success: false,
        error: 'Landing page non trouvée'
      });
    }
    
    res.status(200).json({
      success: true,
      landingPage: landingPage
    });
  } catch (error) {
    console.error('❌ Erreur récupération landing page:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération',
      details: error.message
    });
  }
};

/**
 * ✅ SUPPRESSION - Délégation simple
 */
const deleteLandingPageController = async (req, res) => {
  try {
    const { slug } = req.params;
    console.log('🗑️ Deleting landing page:', slug);
    
    await landingService.deleteLandingPage(slug);
    
    res.status(200).json({
      success: true,
      message: 'Landing page supprimée avec succès'
    });
  } catch (error) {
    console.error('❌ Erreur suppression landing page:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la suppression',
      details: error.message
    });
  }
};

/**
 * ✅ LISTE PAGINÉE - Délégation simple
 */
const getAllLandingPagesController = async (req, res) => {
  try {
    const options = {
      page: parseInt(req.query.page) || 1,
      limit: parseInt(req.query.limit) || 10,
      creatorId: req.query.creatorId,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
      search: req.query.search
    };
    
    const result = await landingService.getAllLandingPages(options);
    
    res.status(200).json({
      success: true,
      landingPages: result.landingPages,
      pagination: result.pagination
    });
  } catch (error) {
    console.error('❌ Erreur récupération des pages:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des pages',
      details: error.message
    });
  }
};

/**
 * ✅ STATISTIQUES - Délégation simple
 */
const getLandingPageStatsController = async (req, res) => {
  try {
    const { slug } = req.params;
    
    const stats = await landingService.getLandingPageStats(slug);
    
    if (!stats) {
      return res.status(404).json({
        success: false,
        error: 'Landing page non trouvée'
      });
    }
    
    res.status(200).json({
      success: true,
      stats: stats
    });
  } catch (error) {
    console.error('❌ Erreur statistiques:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des statistiques',
      details: error.message
    });
  }
};

/**
 * ✅ MISE À JOUR DU STATUT - Délégation simple
 */
const updateLandingPageStatusController = async (req, res) => {
  try {
    const { slug } = req.params;
    const { isActive } = req.body;
    
    if (typeof isActive !== 'boolean') {
      return res.status(400).json({
        success: false,
        error: 'isActive doit être un booléen'
      });
    }
    
    const updatedPage = await landingService.updateLandingPageStatus(slug, isActive);
    
    if (!updatedPage) {
      return res.status(404).json({
        success: false,
        error: 'Landing page non trouvée'
      });
    }
    
    res.status(200).json({
      success: true,
      message: `Landing page ${isActive ? 'activée' : 'désactivée'} avec succès`,
      landingPage: updatedPage
    });
  } catch (error) {
    console.error('❌ Erreur mise à jour statut:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la mise à jour du statut',
      details: error.message
    });
  }
};

/**
 * ✅ APPLICATION DE TEMPLATE - Délégation simple
 */
const applyTemplateController = async (req, res) => {
  try {
    const { slug } = req.params;
    const { templateId } = req.body;
    
    if (!templateId) {
      return res.status(400).json({
        success: false,
        error: 'templateId requis'
      });
    }
    
    const updatedPage = await landingService.applyTemplateToLandingPage(slug, templateId);
    
    if (!updatedPage) {
      return res.status(404).json({
        success: false,
        error: 'Landing page non trouvée'
      });
    }
    
    res.status(200).json({
      success: true,
      message: 'Template appliqué avec succès',
      landingPage: updatedPage
    });
  } catch (error) {
    console.error('❌ Erreur application template:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de l\'application du template',
      details: error.message
    });
  }
};

/**
 * ✅ TEMPLATES DISPONIBLES - Délégation simple
 */
const getAvailableTemplates = async (req, res) => {
  try {
    const templateIds = [
      'white-minimal', 'ice-crystal', 'navy-blue', 'rose-gold', 'rose-sunset',
      'lava', 'neon-mint-classic', 'orchid-bloom', 'aurora', 'sunset',
      'holographic-classic', 'metallic-silver', 'nature-harmony', 'electric-yellow',
      'earth-tone', 'midnight-dark', 'sakura-bloom', 'forest-green', 'electric-neon',
      'business-gradient'
    ];
    
    const templates = {};
    templateIds.forEach(id => {
      templates[id] = {
        id: id,
        name: id.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
        preview: `/templates/${id}-preview.jpg`,
        description: `Template ${id} avec style personnalisé`
      };
    });
    
    res.status(200).json({
      success: true,
      templates: templates
    });
  } catch (error) {
    console.error('❌ Erreur récupération templates:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la récupération des templates',
      details: error.message
    });
  }
};

/**
 * ✅ PREVIEW SLUG - Délégation simple - PHASE 1 MODIFIÉ
 */
const previewSlug = async (req, res) => {
  try {
    const { channelName, profileName } = req.body;
    
    if (!channelName) {
      return res.status(400).json({
        success: false,
        error: 'channelName requis'
      });
    }
    
    // Génération simple de slug
    const slug = channelName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    
    // PHASE 1 - Utiliser profileName si fourni
    const profile = profileName || '[profilename]';
    
    res.status(200).json({
      success: true,
      input: channelName,
      slug: slug,
      url: `www.makerhub.pro/${profile}/${slug}`
    });
  } catch (error) {
    console.error('❌ Erreur génération slug:', error);
    res.status(500).json({
      success: false,
      error: 'Erreur lors de la génération du slug',
      details: error.message
    });
  }
};

// ✅ EXPORT SIMPLIFIÉ - Contrôleurs comme délégateurs purs
module.exports = {
  createLandingPage,
  updateLandingPage: updateLandingPageController,
  getLandingPage,
  deleteLandingPage: deleteLandingPageController,
  getAllLandingPages: getAllLandingPagesController,
  getLandingPageStats: getLandingPageStatsController,
  updateLandingPageStatus: updateLandingPageStatusController,
  applyTemplate: applyTemplateController,
  getAvailableTemplates,
  previewSlug
};