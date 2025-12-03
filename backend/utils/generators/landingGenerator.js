// src/services/landingGenerator.js - Version Corrigée (v2.2)
class LandingPageGenerator {
  constructor() {
    // ✅ Template intégré, plus besoin de fichier externe
    this.version = '2.2-centralized';
  }

  /**
   * ✅ Génère le HTML complet d'une landing page moderne
   */
  generateHTML(data) {
    try {
      console.log('🎨 Generating modern landing page HTML for:', data.brand);

      // Validation des données d'entrée
      this.validateGeneratorData(data);

      // Template HTML de base (moderne, identique à la preview)
      const template = this.getModernTemplate();

      // Préparer toutes les variables de remplacement
      const replacements = this.prepareReplacements(data);

      // Remplacer toutes les variables dans le template
      let html = template;
      Object.keys(replacements).forEach(key => {
        const placeholder = `{{${key}}}`;
        const value = replacements[key] || '';
        // ✅ Remplacement global pour éviter les placeholders non remplacés
        html = html.replace(new RegExp(placeholder.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), value);
      });

      // ✅ Vérification finale: pas de placeholders non remplacés
      const unreplacedPlaceholders = html.match(/\{\{[^}]+\}\}/g);
      if (unreplacedPlaceholders) {
        console.warn('⚠️ Unreplaced placeholders found:', unreplacedPlaceholders);
      }

      console.log('✅ Modern landing page HTML generated successfully');
      return html;

    } catch (error) {
      console.error('❌ Error generating landing page HTML:', error);
      throw error;
    }
  }

  /**
   * ✅ Validation des données d'entrée pour le générateur
   */
  validateGeneratorData(data) {
    const requiredFields = ['brand', 'channelName', 'slug'];
    const missingFields = requiredFields.filter(field => !data[field]);
    
    if (missingFields.length > 0) {
      throw new Error(`Missing required fields for generator: ${missingFields.join(', ')}`);
    }
    
    // Validation des couleurs
    if (data.borderColor && !this.isValidHexColor(data.borderColor)) {
      throw new Error(`Invalid border color: ${data.borderColor}`);
    }
    
    if (data.textColor && !this.isValidHexColor(data.textColor)) {
      throw new Error(`Invalid text color: ${data.textColor}`);
    }
    
    if (data.btnTextColor && !this.isValidHexColor(data.btnTextColor)) {
      throw new Error(`Invalid button text color: ${data.btnTextColor}`);
    }
  }

  /**
   * ✅ Vérification de couleur hexadécimale
   */
  isValidHexColor(color) {
    if (!color) return false;
    return /^#[0-9A-F]{6}$/i.test(color);
  }

  /**
   * ✅ Prépare toutes les variables de remplacement
   */
  prepareReplacements(data) {
    const {
      // Données de base
      slug = '',
      channelName = '',
      brand = 'Your Amazing Brand',
      slogan = 'Your subtitle here',
      description = '',
      banner = '',
      
      // Médias
      logoUrl = '',
      logoShape = 'circle',
      imageUrl = '',
      mediaUrls = [],
      
      // Style
      backgroundColor = 'linear-gradient(135deg, #ffffff 0%, #f8f9fa 25%, #ffffff 50%, #f5f6f7 75%, #ffffff 100%)',
      borderColor = '#ffd600',
      btnTextColor = '#000000',
      textColor = '#1a1a1a',
      fontFamily = 'Inter, sans-serif',
      
      // Contenu business
      prices = [],
      reviews = [],
      globalRating = '5',
      btnAccessText = 'Join Now',
      accessEmoji = '⚡',
      checkoutUrl = '#',
      
      // Intégrations
      creatorEmail = '[email]',
      telegramChannelId = '',
      analyticsCode = '',
      customCSS = '',
      
      // ✅ Nouveau formatage de texte
      textFormatting = {},
      descriptionBackgroundEnabled = false,
      backgroundOpacity = 30
    } = data;

    // Convertir borderColor en RGB pour les effets
    const borderColorRgb = this.hexToRgb(borderColor);

    // Préparer les éléments HTML
    const bannerHtml = this.generateBannerHtml(banner, borderColor);
    const logoHtml = this.generateLogoHtml(logoUrl, logoShape);
    const brandFormatted = this.applyTextFormatting(brand, textFormatting.brand);
    const sloganFormatted = this.applyTextFormatting(slogan, textFormatting.slogan);
    const descriptionHtml = this.generateDescriptionHtml(description, textFormatting.description, descriptionBackgroundEnabled, backgroundOpacity, borderColor);
    const mediaGalleryHtml = this.generateMediaGalleryHtml(mediaUrls);
    const pricesHtml = this.generatePricesHtml(prices, borderColor, btnTextColor);

    // Font family nettoyée
    const cleanFontFamily = this.cleanFontFamily(fontFamily);

    return {
      // Métadonnées
      slug,
      channelName,
      brand,
      slogan,
      description,
      
      // Style
      backgroundColor,
      borderColor,
      borderColorRgb,
      btnTextColor,
      textColor,
      fontFamily: cleanFontFamily,
      
      // Contenu formaté
      brandFormatted,
      sloganFormatted,
      
      // Éléments HTML
      bannerHtml,
      logoHtml,
      descriptionHtml,
      mediaGalleryHtml,
      pricesHtml,
      
      // Affichage conditionnel
      bannerDisplay: banner ? 'flex' : 'none',
      logoDisplay: logoUrl ? 'block' : 'none',
      descriptionDisplay: description ? 'block' : 'none',
      mediaGalleryDisplay: mediaUrls.length > 0 ? 'grid' : 'none',
      descriptionBackground: this.generateDescriptionBackground(descriptionBackgroundEnabled, backgroundOpacity, borderColor),
      logoShape: logoShape === 'circle' ? '50%' : '12px',
      
      // Business
      globalRating,
      btnAccessText,
      accessEmoji,
      checkoutUrl,
      creatorEmail,
      
      // Code personnalisé
      customCSS,
      analyticsCode
    };
  }

  /**
   * ✅ Génère le HTML de la bannière
   */
  generateBannerHtml(banner, borderColor) {
    if (!banner) return '';
    
    return `
    <div class="banner" style="border-color: ${borderColor}; color: ${borderColor};">
      <span class="banner-text">${this.escapeHtml(banner)}</span>
    </div>`;
  }

  /**
   * ✅ Génère le HTML du logo
   */
  generateLogoHtml(logoUrl, logoShape) {
    if (!logoUrl) return '';
    
    const shapeClass = logoShape === 'circle' ? 'circle' : 'square';
    
    return `
    <div class="logo-container">
      <img src="${logoUrl}" alt="Logo" class="logo ${shapeClass}">
    </div>`;
  }

  /**
   * ✅ Génère le HTML de la description avec background optionnel
   */
  generateDescriptionHtml(description, formatting, backgroundEnabled, opacity, borderColor) {
    if (!description) return '';
    
    const formattedDescription = this.applyTextFormatting(description, formatting);
    const backgroundStyle = backgroundEnabled ? this.generateDescriptionBackground(true, opacity, borderColor) : '';
    
    return `
    <div class="description" style="${backgroundStyle}">
      ${formattedDescription.replace(/\n/g, '<br>')}
    </div>`;
  }

  /**
   * ✅ Génère le background de la description
   */
  generateDescriptionBackground(enabled, opacity, borderColor) {
    if (!enabled) return '';
    
    const rgb = this.hexToRgb(borderColor);
    return `background: rgba(${rgb}, ${opacity / 100}); backdrop-filter: blur(10px); border: 1px solid rgba(${rgb}, 0.2); box-shadow: 0 4px 15px rgba(0, 0, 0, 0.1);`;
  }

  /**
   * ✅ Génère le HTML de la galerie médias
   */
  generateMediaGalleryHtml(mediaUrls) {
    if (!mediaUrls || mediaUrls.length === 0) return '';
    
    const mediaItems = mediaUrls.map(media => {
      if (media.type === 'video') {
        return `
        <div class="media-item">
          <video controls>
            <source src="${media.src}" type="${media.mimeType || 'video/mp4'}">
          </video>
        </div>`;
      } else {
        return `
        <div class="media-item">
          <img src="${media.src}" alt="Media">
        </div>`;
      }
    }).join('');

    return `
    <div class="media-gallery">
      ${mediaItems}
    </div>`;
  }

  /**
   * ✅ Génère le HTML des options de prix
   */
  generatePricesHtml(prices, borderColor, btnTextColor) {
    if (!prices || prices.length === 0) {
      return `
      <div class="payment-option-row selected" data-plan="monthly" data-text="67€ / mois" onclick="selectPaymentPlan(this, event)">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="payment-radio">
            <div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>
          </div>
          <div>
            <strong style="font-size: 16px; color: #333;">67€ / mois</strong>
          </div>
        </div>
      </div>`;
    }

    return prices.map((price, index) => {
      const isSelected = index === 0 ? 'selected' : '';
      const originalPrice = price.oldPrice ? `<span style="font-size: 14px; color: #999; text-decoration: line-through;">${price.oldPrice}€</span>` : '';
      const discount = price.discount ? `<span class="discount-badge">${price.discount}</span>` : '';
      
      return `
      <div class="payment-option-row ${isSelected}" data-plan="plan${index}" data-text="${price.price}€ / ${price.period}" onclick="selectPaymentPlan(this, event)">
        <div style="display: flex; align-items: center; gap: 12px;">
          <div class="payment-radio">${isSelected ? '<div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>' : ''}</div>
          <div>
            <strong style="font-size: 16px; color: #333;">${price.price}€ / ${price.period}</strong>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 8px;">
          ${originalPrice}
          ${discount}
        </div>
      </div>`;
    }).join('');
  }

  /**
   * ✅ Applique le formatage de texte (Bold/Italic)
   */
  applyTextFormatting(text, formatting) {
    if (!text || !formatting) return text;
    
    let formattedText = text;
    
    if (formatting.bold) {
      formattedText = `<strong>${formattedText}</strong>`;
    }
    
    if (formatting.italic) {
      formattedText = `<em>${formattedText}</em>`;
    }
    
    return formattedText;
  }

  /**
   * ✅ Nettoie le nom de la police
   */
  cleanFontFamily(fontFamily) {
    if (!fontFamily) return 'Inter, sans-serif';
    
    // Extraire le nom principal de la police
    const mainFont = fontFamily.split(',')[0].replace(/['"]/g, '').trim();
    return mainFont;
  }

  /**
   * ✅ Convertit une couleur hex en RGB
   */
  hexToRgb(hex) {
    if (!hex) return '255, 214, 0';
    
    hex = hex.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16) || 255;
    const g = parseInt(hex.substring(2, 4), 16) || 214;
    const b = parseInt(hex.substring(4, 6), 16) || 0;
    return `${r}, ${g}, ${b}`;
  }

  /**
   * ✅ Escape HTML pour éviter les injections
   */
  escapeHtml(text) {
    if (!text) return '';
    
    const map = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    };
    
    return text.replace(/[&<>"']/g, m => map[m]);
  }

  /**
   * ✅ Template HTML moderne (identique à la preview)
   */
  getModernTemplate() {
    return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>{{brand}} - Landing Page</title>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <link href="https://fonts.googleapis.com/css2?family={{fontFamily}}&display=swap" rel="stylesheet">
  <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    body {
      margin: 0;
      background: {{backgroundColor}};
      color: {{textColor}};
      font-family: {{fontFamily}}, -apple-system, BlinkMacSystemFont, sans-serif;
      line-height: 1.5;
      min-height: 100vh;
      font-size: 14px;
      word-wrap: break-word;
      overflow-wrap: break-word;
      hyphens: auto;
      white-space: normal;
    }

    .container {
      max-width: 400px;
      margin: 0 auto;
      padding: 40px 24px 120px 24px;
      position: relative;
      min-height: 100vh;
    }

    /* BANNER ANIMÉ */
    .banner {
      width: 95%;
      max-width: none;
      margin: 0 auto 16px auto;
      overflow: hidden;
      background: transparent;
      color: {{borderColor}};
      padding: 12px 24px;
      border-radius: 12px;
      box-sizing: border-box;
      font-weight: 600;
      font-family: inherit;
      border: 2px solid {{borderColor}};
      text-align: center;
      display: {{bannerDisplay}};
      height: 45px;
      align-items: center;
      justify-content: center;
      animation: bannerPulse 2s ease-in-out infinite alternate;
    }

    .banner-text {
      display: inline-block;
      white-space: nowrap;
      animation: scrollText 8s linear infinite;
    }

    @keyframes scrollText {
      0% { transform: translateX(100%); }
      100% { transform: translateX(-100%); }
    }

    @keyframes bannerPulse {
      0% { 
        transform: scale(1); 
        box-shadow: 0 0 10px rgba(0, 0, 0, 0.3);
      }
      100% { 
        transform: scale(1.02); 
        box-shadow: 0 0 20px rgba(0, 0, 0, 0.5);
      }
    }

    /* LOGO */
    .logo-container {
      text-align: center;
      margin-bottom: 24px;
      display: {{logoDisplay}};
    }

    .logo {
      width: 120px;
      height: 120px;
      object-fit: cover;
      border-radius: {{logoShape}};
      border: 3px solid rgba(255, 255, 255, 0.2);
      box-shadow: 0 12px 35px rgba(0,0,0,0.15), 0 6px 15px rgba(0,0,0,0.1);
      transition: all 0.3s ease;
    }

    /* TITRES */
    .main-title {
      font-size: 28px;
      font-weight: 700;
      font-family: inherit;
      color: inherit;
      text-align: center;
      margin: 8px 0;
      line-height: 1.2;
      word-break: break-word;
      overflow-wrap: break-word;
      hyphens: auto;
      letter-spacing: -0.3px;
    }

    .subtitle {
      font-size: 16px;
      font-family: inherit;
      font-weight: 400;
      color: inherit;
      text-align: center;
      margin: 8px 0 16px 0;
      word-break: break-word;
      overflow-wrap: break-word;
      hyphens: auto;
    }

    /* DESCRIPTION */
    .description {
      font-size: 16px;
      font-family: inherit;
      font-weight: 400;
      color: inherit;
      margin-bottom: 24px;
      line-height: 1.6;
      word-break: break-word;
      overflow-wrap: break-word;
      hyphens: auto;
      padding: 24px;
      border-radius: 12px;
      transition: all 0.3s ease;
      white-space: pre-wrap;
      display: {{descriptionDisplay}};
    }

    /* GALERIE MÉDIAS */
    .media-gallery {
      display: {{mediaGalleryDisplay}};
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
      gap: 16px;
      margin: 24px 0;
    }

    .media-item {
      position: relative;
      border-radius: 8px;
      overflow: hidden;
    }

    .media-item img,
    .media-item video {
      width: 100%;
      height: 200px;
      object-fit: cover;
      border-radius: 8px;
      display: block;
    }

    /* SECTION ACCÈS */
    .access-section {
      margin: 24px 0;
    }

    .access-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 16px;
      color: inherit;
    }

    .access-panel {
      background: transparent;
      border-radius: 12px;
      padding: 16px;
      display: flex;
      align-items: center;
      justify-content: space-between;
      cursor: pointer;
      transition: all 0.2s ease;
      border: none;
      box-shadow: none;
    }

    .access-panel:hover {
      background: rgba({{borderColorRgb}}, 0.05);
      border-radius: 12px;
      transform: translateY(-1px);
    }

    .access-content {
      display: flex;
      align-items: center;
      gap: 12px;
    }

    .access-emoji {
      width: 44px;
      height: 44px;
      background: {{borderColor}};
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      border: none;
      transition: all 0.3s ease;
      flex-shrink: 0;
      cursor: pointer;
    }

    .access-emoji:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba({{borderColorRgb}}, 0.3);
    }

    .access-lock {
      width: 40px;
      height: 40px;
      background: {{borderColor}};
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      color: {{btnTextColor}};
      font-size: 16px;
      border: 1px solid {{borderColor}};
      transition: all 0.3s ease;
      flex-shrink: 0;
      cursor: pointer;
    }

    .access-lock:hover {
      transform: scale(1.05);
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }

    .access-info {
      flex: 1;
    }

    .access-info-title {
      font-weight: 600;
      font-size: 16px;
      color: inherit;
      margin-bottom: 4px;
      line-height: 1.2;
    }

    .access-info-subtitle {
      font-size: 14px;
      color: inherit;
      opacity: 0.7;
      display: flex;
      align-items: center;
      gap: 4px;
    }

    .access-info-subtitle i {
      color: #0088cc;
      font-size: 14px;
    }

    /* SECTION REVIEWS */
    .reviews-section {
      margin: 24px 0;
    }

    .reviews-title {
      font-size: 24px;
      font-weight: bold;
      margin-bottom: 16px;
      color: inherit;
    }

    /* PAYMENT SHEET MOBILE STYLE */
    .payment-section-sticky {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #f5f5f5;
      border-radius: 16px 16px 0 0;
      box-shadow: 0 -4px 30px rgba(0,0,0,0.15);
      transform: translateY(calc(100% - 80px));
      transition: transform 0.4s ease;
      cursor: default;
      z-index: 10;
      margin: 3px;
      margin-bottom: 0;
    }

    .payment-handle {
      width: 40px;
      height: 4px;
      background: #c1c7cd;
      border-radius: 2px;
      margin: 12px auto;
      cursor: pointer;
      transition: background 0.2s ease;
    }
    
    .payment-handle:hover {
      background: #a8aeb5;
    }

    .payment-main-btn {
      padding: 18px 32px;
      background: {{borderColor}};
      color: {{btnTextColor}};
      text-align: center;
      font-weight: 600;
      font-size: 16px;
      border-radius: 25px;
      margin: 16px 20px;
      box-shadow: 0 4px 15px rgba({{borderColorRgb}}, 0.3);
      transition: all 0.3s ease;
      border: none;
      cursor: pointer;
      font-family: inherit;
    }

    .payment-main-btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 8px 25px rgba({{borderColorRgb}}, 0.5);
    }

    .payment-sheet-content {
      padding: 24px;
      max-height: 250px;
      overflow-y: auto;
      background: #f5f5f5;
    }

    .payment-option-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px;
      margin-bottom: 12px;
      border: 2px solid #e0e0e0;
      background: #f5f5f5;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .payment-option-row:hover {
      border-color: {{borderColor}};
      background: rgba({{borderColorRgb}}, 0.05);
    }

    .payment-option-row.selected {
      border-color: {{borderColor}};
      background: rgba({{borderColorRgb}}, 0.1);
    }

    .payment-radio {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      border: 2px solid #ddd;
      background: white;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-right: 12px;
    }

    .payment-option-row.selected .payment-radio {
      background: {{borderColor}};
      border-color: {{borderColor}};
    }

    .payment-option-row.selected .payment-radio::after {
      content: '';
      width: 8px;
      height: 8px;
      background: white;
      border-radius: 50%;
    }

    .discount-badge {
      background: {{borderColor}};
      color: {{btnTextColor}};
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 12px;
      font-weight: bold;
    }

    /* RESPONSIVE */
    @media (max-width: 480px) {
      .container {
        padding: 24px 16px 120px 16px;
      }
      
      .main-title {
        font-size: 24px;
      }
      
      .subtitle {
        font-size: 14px;
      }
      
      .description {
        font-size: 14px;
        padding: 16px;
      }
    }

    /* CUSTOM CSS */
    {{customCSS}}
  </style>
</head>

<body>
  <div class="container">
    {{bannerHtml}}
    {{logoHtml}}
    
    <h1 class="main-title">{{brandFormatted}}</h1>
    <h4 class="subtitle">{{sloganFormatted}}</h4>
    
    {{descriptionHtml}}
    {{mediaGalleryHtml}}
    
    <!-- SECTION ACCÈS -->
    <div class="access-section">
      <h2 class="access-title">Accès</h2>
      <div class="access-panel" onclick="redirectToCheckout()">
        <div class="access-content">
          <div class="access-emoji">{{accessEmoji}}</div>
          <div class="access-info">
            <div class="access-info-title">{{brand}}</div>
            <div class="access-info-subtitle">
              <i class="fab fa-telegram-plane"></i>Canal Telegram
            </div>
          </div>
        </div>
        <div class="access-lock">
          <i class="fas fa-lock"></i>
        </div>
      </div>
    </div>

    <!-- SECTION REVIEWS -->
    <div class="reviews-section">
      <h2 class="reviews-title">Reviews</h2>
    </div>
    
    <!-- PAYMENT BUTTON STICKY -->
    <div class="payment-section-sticky">
      <div class="payment-handle" onclick="togglePaymentSheet()"></div>
      <div class="payment-main-btn" onclick="togglePaymentSheet()">
        {{btnAccessText}}
      </div>
      <div class="payment-sheet-content">
        {{pricesHtml}}
        <div style="text-align: center; padding: 16px; color: #999; font-size: 14px; cursor: pointer; border-top: 1px solid #eee;" onclick="togglePaymentSheet()">
          <i class="fas fa-chevron-down"></i> <span>Tap to close</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    function togglePaymentSheet() {
      const sheet = document.querySelector('.payment-section-sticky');
      if (!sheet) return;
      
      const currentTransform = sheet.style.transform;
      
      if (currentTransform === '' || currentTransform === 'translateY(0px)') {
        sheet.style.transform = 'translateY(calc(100% - 80px))';
      } else {
        sheet.style.transform = 'translateY(0px)';
      }
    }

    function selectPaymentPlan(element, event) {
      if (event) event.stopPropagation();
      
      document.querySelectorAll('.payment-option-row').forEach(row => {
        row.classList.remove('selected');
        row.style.border = '2px solid #e0e0e0';
        row.style.background = '#f5f5f5';
        
        const radioButton = row.querySelector('.payment-radio');
        if (radioButton) {
          radioButton.style.background = 'white';
          radioButton.style.border = '2px solid #ddd';
          radioButton.innerHTML = '';
        }
      });
      
      element.classList.add('selected');
      element.style.border = '2px solid {{borderColor}}';
      element.style.background = 'rgba({{borderColorRgb}}, 0.1)';
      
      const radioButton = element.querySelector('.payment-radio');
      if (radioButton) {
        radioButton.style.background = '{{borderColor}}';
        radioButton.style.borderColor = '{{borderColor}}';
        radioButton.innerHTML = '<div style="width: 8px; height: 8px; background: white; border-radius: 50%;"></div>';
      }
      
      setTimeout(() => {
        window.location.href = '{{checkoutUrl}}';
      }, 300);
    }

    function redirectToCheckout() {
      window.location.href = '{{checkoutUrl}}';
    }

    {{analyticsCode}}
  </script>
</body>
</html>`;
  }
}

module.exports = LandingPageGenerator;