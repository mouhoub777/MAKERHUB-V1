// middleware/validation.js - Middleware de validation et sanitisation
const validator = require('validator');

// Langues supportées
const SUPPORTED_LANGUAGES = [
  'EN', 'ZH', 'JA', 'KO', 'DE', 'FR', 'ES', 'RU', 
  'AR', 'IT', 'NL', 'PT', 'TR', 'HE', 'SV', 'NO', 
  'DA', 'FI', 'PL', 'CS', 'EL', 'LT', 'LV', 'ET'
];

// Mapping des drapeaux pour validation
const LANGUAGE_FLAGS = {
  'EN': '🇺🇸', 'ZH': '🇨🇳', 'JA': '🇯🇵', 'KO': '🇰🇷',
  'DE': '🇩🇪', 'FR': '🇫🇷', 'ES': '🇪🇸', 'RU': '🇷🇺',
  'AR': '🇸🇦', 'IT': '🇮🇹', 'NL': '🇳🇱', 'PT': '🇵🇹',
  'TR': '🇹🇷', 'HE': '🇮🇱', 'SV': '🇸🇪', 'NO': '🇳🇴',
  'DA': '🇩🇰', 'FI': '🇫🇮', 'PL': '🇵🇱', 'CS': '🇨🇿',
  'EL': '🇬🇷', 'LT': '🇱🇹', 'LV': '🇱🇻', 'ET': '🇪🇪'
};

const LANGUAGE_NAMES = {
  'EN': 'Anglais', 'ZH': 'Chinois simplifié', 'JA': 'Japonais', 'KO': 'Coréen',
  'DE': 'Allemand', 'FR': 'Français', 'ES': 'Espagnol', 'RU': 'Russe',
  'AR': 'Arabe', 'IT': 'Italien', 'NL': 'Néerlandais', 'PT': 'Portugais',
  'TR': 'Turc', 'HE': 'Hébreu', 'SV': 'Suédois', 'NO': 'Norvégien',
  'DA': 'Danois', 'FI': 'Finnois', 'PL': 'Polonais', 'CS': 'Tchèque',
  'EL': 'Grec', 'LT': 'Lituanien', 'LV': 'Letton', 'ET': 'Estonien'
};

// Valider une URL Telegram
function validateTelegramUrl(url) {
  if (!url || typeof url !== 'string') {
    return false;
  }
  
  const telegramRegex = /^https:\/\/t\.me\/[a-zA-Z0-9_]+$/;
  return telegramRegex.test(url.trim());
}

// Valider un userId
function validateUserId(userId) {
  if (!userId || typeof userId !== 'string') {
    return false;
  }
  
  // Peut être un email, un UUID, ou un identifiant alphanumérique
  return userId.length >= 3 && userId.length <= 100 && 
         /^[a-zA-Z0-9@._-]+$/.test(userId);
}

// Valider un email
function validateEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }
  
  return validator.isEmail(email);
}

// Valider une langue cible
function validateTargetLanguage(language) {
  if (!language || typeof language !== 'object') {
    return { isValid: false, error: 'Langue invalide' };
  }
  
  const { code, name, flag, targetChannel } = language;
  
  // Vérifier le code de langue
  if (!code || !SUPPORTED_LANGUAGES.includes(code)) {
    return { isValid: false, error: `Code de langue non supporté: ${code}` };
  }
  
  // Vérifier le nom
  if (!name || name !== LANGUAGE_NAMES[code]) {
    return { isValid: false, error: `Nom de langue incorrect pour ${code}` };
  }
  
  // Vérifier le drapeau
  if (!flag || flag !== LANGUAGE_FLAGS[code]) {
    return { isValid: false, error: `Drapeau incorrect pour ${code}` };
  }
  
  // Vérifier le canal cible
  if (!validateTelegramUrl(targetChannel)) {
    return { isValid: false, error: `URL du canal cible invalide pour ${name}` };
  }
  
  return { isValid: true };
}

// Middleware principal de validation
function validateConfig(req, res, next) {
  try {
    const { userId, email, sourceChannel, targetLanguages } = req.body;
    
    const errors = [];
    
    // Valider userId
    if (!validateUserId(userId)) {
      errors.push('userId invalide (3-100 caractères alphanumérique)');
    }
    
    // Valider email
    if (!validateEmail(email)) {
      errors.push('Email invalide');
    }
    
    // Valider le canal source
    if (!validateTelegramUrl(sourceChannel)) {
      errors.push('URL du canal source invalide');
    }
    
    // Valider les langues cibles
    if (!Array.isArray(targetLanguages)) {
      errors.push('targetLanguages doit être un tableau');
    } else {
      // Vérifier le nombre de langues
      if (targetLanguages.length === 0) {
        errors.push('Au moins une langue cible requise');
      } else if (targetLanguages.length > 5) {
        errors.push('Maximum 5 langues cibles autorisées');
      }
      
      // Valider chaque langue
      const languageCodes = new Set();
      targetLanguages.forEach((lang, index) => {
        const validation = validateTargetLanguage(lang);
        
        if (!validation.isValid) {
          errors.push(`Langue ${index + 1}: ${validation.error}`);
        } else {
          // Vérifier les doublons
          if (languageCodes.has(lang.code)) {
            errors.push(`Langue ${lang.code} dupliquée`);
          }
          languageCodes.add(lang.code);
        }
      });
    }
    
    // Si des erreurs sont trouvées, les retourner
    if (errors.length > 0) {
      return res.status(400).json({
        error: 'Données de configuration invalides',
        details: errors
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Erreur validation middleware:', error);
    res.status(500).json({
      error: 'Erreur lors de la validation des données'
    });
  }
}

// Sanitiser les données de configuration
function sanitizeConfig(data) {
  const {
    userId,
    email,
    sourceChannel,
    targetLanguages,
    settings = {}
  } = data;
  
  return {
    userId: validator.escape(userId.trim()),
    email: validator.normalizeEmail(email.trim()),
    sourceChannel: sourceChannel.trim(),
    sourceChannelUsername: sourceChannel.split('/').pop().replace('@', ''),
    targetLanguages: targetLanguages.map(lang => ({
      code: lang.code.toUpperCase().trim(),
      name: LANGUAGE_NAMES[lang.code.toUpperCase()],
      flag: LANGUAGE_FLAGS[lang.code.toUpperCase()],
      targetChannel: lang.targetChannel.trim(),
      channelId: null,
      isActive: true
    })),
    settings: {
      translateImages: Boolean(settings.translateImages),
      translateCaptions: settings.translateCaptions !== false, // true par défaut
      preserveFormatting: settings.preserveFormatting !== false, // true par défaut
      addSourceLink: Boolean(settings.addSourceLink),
      delayBetweenMessages: Math.min(Math.max(
        parseInt(settings.delayBetweenMessages) || 2000, 
        1000
      ), 10000)
    },
    statistics: {
      totalMessages: 0,
      translatedToday: 0,
      lastActivity: null,
      errorCount: 0
    }
  };
}

// Validation pour les requêtes de webhook
function validateWebhookData(req, res, next) {
  try {
    const { update_id, message, channel_post } = req.body;
    
    // Vérifier que c'est bien un update Telegram
    if (typeof update_id !== 'number') {
      return res.status(400).json({
        error: 'Format de webhook Telegram invalide'
      });
    }
    
    // Il doit y avoir soit un message soit un channel_post
    if (!message && !channel_post) {
      return res.status(400).json({
        error: 'Aucun message ou channel_post trouvé'
      });
    }
    
    next();
    
  } catch (error) {
    console.error('Erreur validation webhook:', error);
    res.status(500).json({
      error: 'Erreur lors de la validation du webhook'
    });
  }
}

// Validation pour les paramètres de requête communs
function validateQueryParams(req, res, next) {
  const { userId, limit, offset } = req.query;
  
  const errors = [];
  
  // Valider userId si présent
  if (userId && !validateUserId(userId)) {
    errors.push('userId invalide dans les paramètres de requête');
  }
  
  // Valider limit si présent
  if (limit && (!Number.isInteger(Number(limit)) || Number(limit) < 1 || Number(limit) > 100)) {
    errors.push('limit doit être un entier entre 1 et 100');
  }
  
  // Valider offset si présent
  if (offset && (!Number.isInteger(Number(offset)) || Number(offset) < 0)) {
    errors.push('offset doit être un entier positif');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Paramètres de requête invalides',
      details: errors
    });
  }
  
  next();
}

// Validation pour l'ID MongoDB
function validateObjectId(req, res, next) {
  const { id } = req.params;
  
  if (!id || !id.match(/^[0-9a-fA-F]{24}$/)) {
    return res.status(400).json({
      error: 'ID de configuration invalide'
    });
  }
  
  next();
}

// Sanitiser le HTML et éviter les injections XSS
function sanitizeHtml(text) {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  return validator.escape(text.trim());
}

// Valider les paramètres de traduction
function validateTranslationParams(req, res, next) {
  const { text, targetLanguage, sourceLanguage } = req.body;
  
  const errors = [];
  
  // Valider le texte
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    errors.push('Texte à traduire requis');
  } else if (text.length > 10000) {
    errors.push('Texte trop long (maximum 10000 caractères)');
  }
  
  // Valider la langue cible
  if (!targetLanguage || !SUPPORTED_LANGUAGES.includes(targetLanguage.toUpperCase())) {
    errors.push('Langue cible invalide');
  }
  
  // Valider la langue source si fournie
  if (sourceLanguage && sourceLanguage !== 'auto' && 
      !SUPPORTED_LANGUAGES.includes(sourceLanguage.toUpperCase())) {
    errors.push('Langue source invalide');
  }
  
  if (errors.length > 0) {
    return res.status(400).json({
      error: 'Paramètres de traduction invalides',
      details: errors
    });
  }
  
  next();
}

module.exports = {
  validateConfig,
  sanitizeConfig,
  validateWebhookData,
  validateQueryParams,
  validateObjectId,
  validateTranslationParams,
  sanitizeHtml,
  validateTelegramUrl,
  validateUserId,
  validateEmail,
  SUPPORTED_LANGUAGES,
  LANGUAGE_FLAGS,
  LANGUAGE_NAMES
};