'use strict';
const axios = require('axios');

class LanguageController {
  constructor() {
    // Mapping des codes de langue pour DeepL
    this.langMapping = {
      'pt-br': 'PT-BR', 
      'ptbr': 'PT-BR', 
      'zh': 'ZH',
      'pl': 'PL'
    };

    // 13 langues supportées uniquement
    this.supportedList = [
      { code: 'en', name: 'English', native: 'English', flag: '🇺🇸' },
      { code: 'fr', name: 'French', native: 'Français', flag: '🇫🇷' },
      { code: 'es', name: 'Spanish', native: 'Español', flag: '🇪🇸' },
      { code: 'de', name: 'German', native: 'Deutsch', flag: '🇩🇪' },
      { code: 'it', name: 'Italian', native: 'Italiano', flag: '🇮🇹' },
      { code: 'pt', name: 'Portuguese', native: 'Português', flag: '🇵🇹' },
      { code: 'ru', name: 'Russian', native: 'Русский', flag: '🇷🇺' },
      { code: 'zh', name: 'Chinese', native: '中文', flag: '🇨🇳' },
      { code: 'ja', name: 'Japanese', native: '日本語', flag: '🇯🇵' },
      { code: 'ko', name: 'Korean', native: '한국어', flag: '🇰🇷' },
      { code: 'tr', name: 'Turkish', native: 'Türkçe', flag: '🇹🇷' },
      { code: 'ar', name: 'Arabic', native: 'العربية', flag: '🇸🇦' },
      { code: 'pl', name: 'Polish', native: 'Polski', flag: '🇵🇱' }
    ];

    // Langues supportées par DeepL
    this.deeplSupported = new Set([
      'BG', 'CS', 'DA', 'DE', 'EL', 'EN', 'ES', 'ET', 'FI', 'FR', 'HU',
      'ID', 'IT', 'JA', 'KO', 'LT', 'LV', 'NB', 'NL', 'PL', 'PT', 'PT-BR',
      'RO', 'RU', 'SK', 'SL', 'SV', 'TR', 'UK', 'ZH', 'AR'
    ]);

    this.deeplApiKey = process.env.DEEPL_API_KEY || '';
    this.deeplApiUrl = process.env.DEEPL_API_URL || 'https://api.deepl.com/v2/translate';
    this.deeplUsageEndpoint = 'https://api.deepl.com/v2/usage';
  }

  normalizeLang = (lang) => {
    if (!lang) return null;
    const lower = String(lang).toLowerCase();
    return this.langMapping[lower] || lower.toUpperCase();
  };

  isDeepLSupported = (normalized) => this.deeplSupported.has(normalized);

  getSupportedLanguages = (req, res) => {
    res.json({
      success: true,
      languages: this.supportedList,
      total: this.supportedList.length,
      note: "13 langues supportées pour MAKERHUB."
    });
  };

  translateText = async (req, res) => {
    try {
      const { text, targetLanguage, sourceLanguage = 'EN' } = req.body || {};
      
      console.log('Translation request:', {
        hasText: !!text,
        targetLanguage,
        sourceLanguage,
        hasApiKey: !!this.deeplApiKey
      });

      if (!text || !targetLanguage) {
        return res.status(400).json({ 
          success: false, 
          error: 'Text and targetLanguage are required' 
        });
      }

      if (!this.deeplApiKey) {
        return res.status(500).json({
          success: false,
          error: 'DeepL API key not configured'
        });
      }

      const normalized = this.normalizeLang(targetLanguage);
      
      if (!this.isDeepLSupported(normalized)) {
        return res.status(400).json({ 
          success: false, 
          error: `Unsupported language '${targetLanguage}'.` 
        });
      }

      const response = await axios.post(this.deeplApiUrl, 
        new URLSearchParams({
          text: text,
          target_lang: normalized,
          auth_key: this.deeplApiKey
        }).toString(), 
        {
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': `DeepL-Auth-Key ${this.deeplApiKey}`
          }
        }
      );

      console.log('DeepL response status:', response.status);

      if (!response.data || !response.data.translations || !response.data.translations[0]) {
        throw new Error('Invalid response from DeepL');
      }

      const translatedText = response.data.translations[0].text;
      
      res.json({ 
        success: true, 
        translatedText,
        targetLanguage: normalized,
        sourceLanguage
      });
      
    } catch (error) {
      console.error('Translation error:', error.response?.data || error.message);
      res.status(500).json({ 
        success: false, 
        error: error.response?.data?.message || error.message 
      });
    }
  };

  translateLandingPage = async (req, res) => {
    try {
      const { content, targetLanguage, text, target_lang } = req.body || {};
      const finalText = text || content;
      const finalLang = this.normalizeLang(target_lang || targetLanguage);

      console.log('Landing translation request:', {
        hasContent: !!finalText,
        targetLanguage: finalLang,
        contentType: typeof finalText,
        hasApiKey: !!this.deeplApiKey
      });

      if (!finalText || !finalLang) {
        return res.status(400).json({ 
          success: false, 
          error: 'Missing required fields: content/text or targetLanguage' 
        });
      }

      if (!this.deeplApiKey) {
        return res.status(500).json({
          success: false,
          error: 'DeepL API key not configured'
        });
      }

      if (!this.isDeepLSupported(finalLang)) {
        return res.status(400).json({ 
          success: false, 
          error: `Unsupported language '${finalLang}'.` 
        });
      }

      let result = {};

      if (typeof finalText === 'object') {
        // Traduire chaque champ
        for (const [key, text] of Object.entries(finalText)) {
          if (text && typeof text === 'string') {
            try {
              console.log(`Translating field: ${key}`);
              
              const response = await axios.post(this.deeplApiUrl,
                new URLSearchParams({
                  text: text,
                  target_lang: finalLang,
                  auth_key: this.deeplApiKey
                }).toString(),
                {
                  headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                    'Authorization': `DeepL-Auth-Key ${this.deeplApiKey}`
                  }
                }
              );
              
              if (response.data && response.data.translations && response.data.translations[0]) {
                result[key] = response.data.translations[0].text;
              } else {
                result[key] = text; // Fallback
              }
            } catch (err) {
              console.error(`Error translating ${key}:`, err.response?.data || err.message);
              result[key] = text; // Fallback sur le texte original
            }
          } else {
            result[key] = text;
          }
        }
      } else {
        // Traduire comme texte simple
        const response = await axios.post(this.deeplApiUrl,
          new URLSearchParams({
            text: finalText,
            target_lang: finalLang,
            auth_key: this.deeplApiKey
          }).toString(),
          {
            headers: {
              'Content-Type': 'application/x-www-form-urlencoded',
              'Authorization': `DeepL-Auth-Key ${this.deeplApiKey}`
            }
          }
        );

        if (response.data && response.data.translations && response.data.translations[0]) {
          result = response.data.translations[0].text;
        } else {
          result = finalText;
        }
      }

      res.json({ 
        success: true, 
        translations: result,
        targetLanguage: finalLang 
      });
      
    } catch (error) {
      console.error('Landing translation error:', error.response?.data || error.message);
      res.status(500).json({ 
        success: false, 
        error: error.response?.data?.message || error.message 
      });
    }
  };

  getUsageInfo = async (req, res) => {
    try {
      if (!this.deeplApiKey) {
        return res.status(503).json({ 
          success: false, 
          error: 'DeepL API key not configured' 
        });
      }

      const { data } = await axios.get(this.deeplUsageEndpoint, {
        headers: { 
          'Authorization': `DeepL-Auth-Key ${this.deeplApiKey}` 
        },
        timeout: 10000
      });

      res.json({ 
        success: true, 
        usage: data 
      });
      
    } catch (error) {
      const status = error.response?.status || 500;
      console.error('Usage info error:', error.response?.data || error.message);
      res.status(status).json({ 
        success: false, 
        error: error.response?.data || error.message 
      });
    }
  };
}

// IMPORTANT: Exporter une instance, pas la classe
module.exports = new LanguageController();